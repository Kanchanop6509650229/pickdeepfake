from django.shortcuts import render
from django.http import HttpResponse
from django.core.files.storage import FileSystemStorage
import os
import cv2
import numpy as np
import tensorflow as tf
import dlib
from django.conf import settings
from django.shortcuts import render, redirect
from django.http import JsonResponse
from .models import UploadedImage, Prediction
from .models import UserPrediction
from django.views.decorators.csrf import csrf_exempt
from keras.models import load_model
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, models
from keras.layers import Layer
from imutils import face_utils
import requests
import base64
import json
from PIL import Image
from authlib.integrations.django_client import OAuth
from django.urls import reverse
from functools import wraps
from django.core.cache import cache
from datetime import datetime, timedelta
from django.utils.dateparse import parse_datetime
from django.utils.timezone import make_aware
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Q

# Initialize Auth0
oauth = OAuth()
oauth.register(
    "auth0",
    client_id=settings.AUTH0_CLIENT_ID,
    client_secret=settings.AUTH0_CLIENT_SECRET,
    client_kwargs={
        "scope": "openid profile email",
    },
    server_metadata_url=f'https://{settings.AUTH0_DOMAIN}/.well-known/openid-configuration'
)

def check_login_status(request):
    is_logged_in = 'user' in request.session and 'userinfo' in request.session['user']
    return JsonResponse({'is_logged_in': is_logged_in})

def login(request):
    return oauth.auth0.authorize_redirect(
        request, request.build_absolute_uri(reverse("callback"))
    )

def callback(request):
    token = oauth.auth0.authorize_access_token(request)
    request.session["user"] = token
    return redirect(reverse("detecting"))

def logout(request):
    request.session.clear()
    return redirect(
        f"https://{settings.AUTH0_DOMAIN}/v2/logout?"
        f"client_id={settings.AUTH0_CLIENT_ID}&returnTo={request.build_absolute_uri(reverse('detecting'))}"
    )

def requires_auth(f):
    @wraps(f)
    def decorated(request, *args, **kwargs):
        if "user" not in request.session:
            return redirect("login")
        return f(request, *args, **kwargs)
    return decorated

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

@csrf_exempt
def delete_history_item(request):
    if request.method == 'POST' and 'user' in request.session and 'userinfo' in request.session['user']:
        data = json.loads(request.body)
        image_name = data.get('image_name')
        created_at = data.get('created_at')
        try:
            # Parse the created_at string to a datetime object
            created_at_datetime = make_aware(parse_datetime(created_at))

            UserPrediction.objects.filter(
                Q(username=request.session['user']['userinfo']['sub']) &
                Q(image_name=image_name) &
                (Q(created_at=created_at_datetime) | Q(created_at__startswith=created_at[:19]))
            ).delete()
            return JsonResponse({'success': True})
        except Exception as e:
            print(f"Error deleting history item: {e}")
            return JsonResponse({'success': False})
    return JsonResponse({'success': False})

@csrf_exempt
def delete_all_history(request):
    if request.method == 'POST' and 'user' in request.session and 'userinfo' in request.session['user']:
        try:
            UserPrediction.objects.filter(username=request.session['user']['userinfo']['sub']).delete()
            return JsonResponse({'success': True})
        except Exception as e:
            print(f"Error deleting all history: {e}")
            return JsonResponse({'success': False})
    return JsonResponse({'success': False})

def load_history(request):
    if 'user' in request.session and 'userinfo' in request.session['user']:
        predictions = UserPrediction.objects.filter(username=request.session['user']['userinfo']['sub']).order_by('-created_at')
        history = []
        for pred in predictions:
            prediction_details = json.loads(pred.prediction_details)
            
            results = prediction_details[0]['results']
            search_results = prediction_details[1]['search_results']
            
            history.append({
                'imageName': pred.image_name,
                'prediction': results['final_prediction']['predicted_class'],
                'imageData': f'data:image/jpeg;base64,{base64.b64encode(pred.image).decode()}',
                'fullResults': {
                    'results': results,
                    'search_results': search_results
                },
                'createdAt': pred.created_at.isoformat()  
            })
        return JsonResponse({'history': history}, encoder=DjangoJSONEncoder)
    else:
        return JsonResponse({'history': []})

def reverse_image_search(image_path):
    search_url = f"{settings.BING_SEARCH_ENDPOINT}/v7.0/images/visualsearch"
    headers = {
        "Ocp-Apim-Subscription-Key": settings.BING_SEARCH_API_KEY
    }
    
    with open(image_path, "rb") as f:
        image_data = f.read()
    
    form = {
        'image': ('image', image_data),
    }
    
    params = {
        'safeSearch': 'Off'
    }
    
    try:
        response = requests.post(search_url, headers=headers, files=form, params=params)
        response.raise_for_status()
        search_results = response.json()
        
        pages = search_results.get('tags', [{}])[0].get('actions', [{}])[0].get('data', {}).get('value', [])
        
        return [{
            'name': page.get('name'),
            'url': page.get('hostPageUrl'),
            'thumbnail': page.get('thumbnailUrl')
        } for page in pages[:20]]
    except Exception as e:
        print(f"Error in reverse image search: {e}")
        return []

def index(request):
    return render(request, "index.html")

@csrf_exempt
def detecting(request):
    if request.method == 'POST' and request.FILES['image']:
        image = request.FILES['image']
        fs = FileSystemStorage()
        filename = fs.save(image.name, image)
        file_path = fs.path(filename)
        
        try:
            results = extract_and_predict(file_path, models)
            search_results = reverse_image_search(file_path)

            # Check for NaN values in results
            if has_nan_values(results):
                raise ValueError("Invalid prediction results: NaN values detected")

            combined_data = [
                {"results": results},
                {"search_results": search_results}
            ]

            # Save to database only if prediction is successful and user is logged in
            if 'user' in request.session and 'userinfo' in request.session['user']:
                with open(file_path, 'rb') as f:
                    original_image = f.read()
                
                user_prediction = UserPrediction(
                    username=request.session['user']['userinfo']['sub'],
                    image_name=image.name,
                    image=original_image,
                    prediction_details=json.dumps(combined_data)
                )
                user_prediction.save()
            
            return JsonResponse({'results': results, 'search_results': search_results})
        except Exception as e:
            # Log the error or handle it as needed
            return JsonResponse({'error': str(e)}, status=500)
        finally:
            # This block will always execute, even if an exception occurs
            fs.delete(filename)
    
    return render(request, "detecting.html")

@csrf_exempt
def predict(request):
    if "user" in request.session and 'userinfo' in request.session['user']:
        return detecting(request)
    else:
        client_ip = get_client_ip(request)
        
        if request.method == 'POST' and request.FILES.get('image'):
            predict_count = cache.get(f"predictcount{client_ip}", 0)

            if predict_count >= 10:
                reset_time = cache.get(f"predict_resettime{client_ip}")
                return JsonResponse({
                    "error": "Prediction limit reached. Please log in for unlimited predictions.",
                    "remaining_predictions": 0,
                    "reset_time": reset_time.isoformat() if reset_time else None
                }, status=403)

            if predict_count == 0:
                reset_time = datetime.now() + timedelta(hours=6)
                cache.set(f"predict_resettime{client_ip}", reset_time, 6 * 60 * 60)
            else:
                reset_time = cache.get(f"predict_resettime{client_ip}")

            cache.set(f"predictcount{client_ip}", predict_count + 1, 6 * 60 * 60)
            remaining_predictions = 10 - (predict_count + 1)

            response = detecting(request)

            if isinstance(response, HttpResponse):
                try:
                    response_data = json.loads(response.content.decode('utf-8'))
                except json.JSONDecodeError:
                    return response
            elif isinstance(response, JsonResponse):
                response_data = json.loads(response.content.decode('utf-8'))
            else:
                return response

            response_data['remaining_predictions'] = remaining_predictions
            response_data['reset_time'] = reset_time.isoformat() if reset_time else None

            return JsonResponse(response_data)
        
        return get_initial_prediction_info(request)

@csrf_exempt
def get_initial_prediction_info(request):
    if "user" in request.session and 'userinfo' in request.session['user']:
        return JsonResponse({
            "remaining_predictions": None,  # Unlimited for logged-in users
            "reset_time": None
        })
    else:
        client_ip = get_client_ip(request)
        predict_count = cache.get(f"predictcount{client_ip}", 0)
        reset_time = cache.get(f"predict_resettime{client_ip}")

        if predict_count == 0:
            reset_time = None
        elif not reset_time:
            reset_time = datetime.now() + timedelta(hours=6)
            cache.set(f"predict_resettime{client_ip}", reset_time, 6 * 60 * 60)

        remaining_predictions = max(0, 10 - predict_count)

        return JsonResponse({
            "remaining_predictions": remaining_predictions,
            "reset_time": reset_time.isoformat() if reset_time else None
        })
    
def has_nan_values(results):
    """
    Recursively check for NaN values in the results dictionary.
    """
    import math

    if isinstance(results, dict):
        return any(has_nan_values(value) for value in results.values())
    elif isinstance(results, list):
        return any(has_nan_values(item) for item in results)
    elif isinstance(results, float):
        return math.isnan(results)
    else:
        return False

MODELS_DIR = os.path.join(settings.BASE_DIR, 'models')
shape_predictor_path = os.path.join(MODELS_DIR, 'shape_predictor_68_face_landmarks.dat/shape_predictor_68_face_landmarks.dat')

print(f"BASE_DIR: {settings.BASE_DIR}")
print(f"MODELS_DIR: {MODELS_DIR}")
print(f"Shape predictor path: {shape_predictor_path}")
print(f"File exists: {os.path.exists(shape_predictor_path)}")

# Update the path to the models folder
MODELS_DIR = os.path.join(settings.BASE_DIR, 'models')

# Load the model with the custom objects
# Load the models
models = {
    'รูปเต็ม': tf.keras.models.load_model(os.path.join(MODELS_DIR, 'trainedmodel_final_full_image.h5')),
    'ใบหน้า': tf.keras.models.load_model(os.path.join(MODELS_DIR, 'trainedmodel_final_full_face.h5')),
    'ดวงตา': tf.keras.models.load_model(os.path.join(MODELS_DIR, 'trainedmodel_final_eye.h5')),
    'ปาก': tf.keras.models.load_model(os.path.join(MODELS_DIR, 'trainedmodel_final_mouth.h5')),
    'จมูก': tf.keras.models.load_model(os.path.join(MODELS_DIR, 'trainedmodel_final_nose.h5')),
    'กระจกตา': tf.keras.models.load_model(os.path.join(MODELS_DIR, 'trainedmodel_final_cornea.h5'))
}

# Initialize dlib's face detector and predictor
detector = dlib.get_frontal_face_detector()
predictor = dlib.shape_predictor(shape_predictor_path)

def variance_of_laplacian(image):
    # Compute the Laplacian of the image and then return the focus
    # measure, which is simply the variance of the Laplacian
    return cv2.Laplacian(image, cv2.CV_64F).var()

def extract_and_predict(file_path, models):
    # Define the class mapping
    class_mapping = {0: "ภาพปลอม", 1: "ภาพจริง"}
    
    # Read the full image and predict once
    full_img = cv2.imread(file_path)
    if full_img is None:
        raise ValueError("Unable to read the image file.")
    
    full_img_resized = cv2.resize(full_img, (224, 224))
    full_img_array = np.expand_dims(full_img_resized, axis=0)
    full_img_class, full_img_prob, full_img_prediction = predict_image(full_img_array, models['รูปเต็ม'])
    
    if full_img_class is None or full_img_prob is None or full_img_prediction is None:
        raise ValueError("Failed to predict on the full image.")
    
    # Extract face parts
    all_face_parts = extract_face_parts(file_path)
    
    if not all_face_parts:
        return {
            'all_results': [{
                'รูปเต็ม': {
                    'predicted_class': class_mapping[int(full_img_class)],
                    'predicted_prob': float(full_img_prob),
                    'prediction': full_img_prediction.tolist(),
                    'bbox': (0, 0, full_img.shape[1], full_img.shape[0])
                }
            }],
            'final_prediction': {
                'predicted_class': class_mapping[int(full_img_class)],
                'predicted_prob': float(full_img_prob),
                'prediction': full_img_prediction.tolist()
            }
        }
    
    # Define base weights for each part
    base_weights = {
        'รูปเต็ม': 0.25,
        'ใบหน้า': 0.30,
        'ดวงตา': 0.20,
        'กระจกตา': 0.15,
        'จมูก': 0.05,
        'ปาก': 0.05
    }

    all_results = []
    weighted_predictions = []
    
    for face_parts in all_face_parts:
        results = {
            'รูปเต็ม': {
                'predicted_class': class_mapping[int(full_img_class)],
                'predicted_prob': float(full_img_prob),
                'prediction': full_img_prediction.tolist(),
                'bbox': (0, 0, full_img.shape[1], full_img.shape[0])
            }
        }
        face_weighted_pred = base_weights['รูปเต็ม'] * full_img_prediction[1]
        total_weight = base_weights['รูปเต็ม']
        
        # Initialize counters for eyes and corneas
        eye_count = 0
        cornea_count = 0

        # Initialize a dictionary to keep track of used weights
        used_weights = {'รูปเต็ม': base_weights['รูปเต็ม']}
        
        for part, img in face_parts.items():
            if img is None:
                continue
            
            # Check if the image part is too blurry
            blur_score = variance_of_laplacian(img)
            if blur_score < 10:  # Adjust this threshold as needed
                print(f"Skipping {part} due to excessive blur")
                continue
            
            img_resized = cv2.resize(img, (224, 224))
            img_array = np.expand_dims(img_resized, axis=0)
            
            # Choose the appropriate model for each part
            if part in ['ดวงตาซ้าย', 'ดวงตาขวา']:
                model_key = 'ดวงตา'
                eye_count += 1
            elif part in ['กระจกตาซ้าย', 'กระจกตาขวา']:
                model_key = 'กระจกตา'
                cornea_count += 1
            elif part in models:
                model_key = part
            else:
                continue  # Skip parts without a model
            
            predicted_class, predicted_prob, prediction = predict_image(img_array, models[model_key])
            
            if predicted_class is None or predicted_prob is None or prediction is None:
                print(f"Skipping {part} due to prediction failure")
                continue
            
            # Calculate weight based on the number of eyes/corneas detected
            if model_key == 'ดวงตา':
                weight = base_weights['ดวงตา'] / (2 if eye_count == 2 else 1)
            elif model_key == 'กระจกตา':
                weight = base_weights['กระจกตา'] / (2 if cornea_count == 2 else 1)
            else:
                weight = base_weights.get(model_key, 0)
            
            face_weighted_pred += weight * prediction[1]  # Choose index 1 for the probability of "Real" class
            total_weight += weight
            
            # Update used weights
            if model_key in used_weights:
                used_weights[model_key] += weight
            else:
                used_weights[model_key] = weight
            
            results[part] = {
                'predicted_class': class_mapping[int(predicted_class)],
                'predicted_prob': float(predicted_prob),
                'prediction': prediction.tolist(),
                'bbox': face_parts[part + '_bbox'] if part + '_bbox' in face_parts else None
            }
        
        # Redistribute unused weights
        unused_weight = sum(base_weights.values()) - sum(used_weights.values())
        if unused_weight > 0:
            weight_factor = 1 + (unused_weight / sum(used_weights.values()))
            face_weighted_pred *= weight_factor
        
        if total_weight > 0:
            face_weighted_pred /= total_weight
            weighted_predictions.append(face_weighted_pred)
        
        all_results.append(results)
    
    # Calculate final result
    if weighted_predictions:
        final_prediction = np.nanmean(weighted_predictions)
        final_class = 1 if final_prediction > 0.5 else 0
        final_prob = final_prediction if final_class == 1 else 1 - final_prediction
    else:
        # Fallback to full image prediction if no face parts were successfully processed
        final_class = full_img_class
        final_prob = full_img_prob
        final_prediction = full_img_prediction[1]
    
    return {
        'all_results': all_results,
        'final_prediction': {
            'predicted_class': class_mapping[int(final_class)],
            'predicted_prob': float(final_prob),
            'prediction': [1 - final_prediction, final_prediction]
        }
    }

def extract_face_parts(image_path):
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = detector(gray, 1)
    
    if len(faces) == 0:
        return None
    
    all_face_parts = []
    for rect in faces:
        # Check for blur
        face_roi = gray[rect.top():rect.bottom(), rect.left():rect.right()]
        blur_score = variance_of_laplacian(face_roi)
        if blur_score < 20:
            continue
        
        face_parts = {}
        shape = predictor(gray, rect)
        shape = face_utils.shape_to_np(shape)
        
        # Extract full image
        face_parts['รูปเต็ม'] = img
        face_parts['รูปเต็ม_bbox'] = (0, 0, img.shape[1], img.shape[0])
        
        # Extract full face
        (x, y, w, h) = (rect.left(), rect.top(), rect.width(), rect.height())
        face_parts['ใบหน้า'] = img[y:y+h, x:x+w]
        face_parts['ใบหน้า_bbox'] = (x, y, w, h)
        
        # Extract other parts (eyes, eyebrows, mouth, nose, corneas)
        parts = {
            'ดวงตาซ้าย': shape[36:42],
            'ดวงตาขวา': shape[42:48],
            'ปาก': shape[48:60],
            'จมูก': shape[27:36],
            'กระจกตาซ้าย': [shape[37], shape[38], shape[40], shape[41]],
            'กระจกตาขวา': [shape[43], shape[44], shape[46], shape[47]]
        }
        
        for part_name, part_points in parts.items():
            (x, y, w, h) = cv2.boundingRect(np.array(part_points))
            face_parts[part_name] = img[y:y+h, x:x+w] if w > 0 and h > 0 else None
            face_parts[part_name + '_bbox'] = (x, y, w, h)
        
        all_face_parts.append(face_parts)
    
    return all_face_parts

def predict_image(img_array, model):
    img_array = tf.keras.applications.xception.preprocess_input(img_array)
    prediction = model.predict(img_array)
    predicted_class = np.argmax(prediction, axis=1)
    predicted_prob = np.max(prediction, axis=1)
    return predicted_class[0], predicted_prob[0], prediction[0]