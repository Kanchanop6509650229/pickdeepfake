from django.db import models
import json

class UploadedImage(models.Model):
    image = models.ImageField(upload_to='uploads/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

class Prediction(models.Model):
    image = models.ForeignKey(UploadedImage, on_delete=models.CASCADE)
    part_name = models.CharField(max_length=50)
    predicted_class = models.IntegerField()
    predicted_prob = models.FloatField()
    prediction = models.JSONField()

class UserPrediction(models.Model):
    username = models.CharField(max_length=255)
    image_name = models.CharField(max_length=255)
    image = models.BinaryField()
    prediction_details = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    def set_prediction_details(self, details):
        self.prediction_details = json.dumps(details)

    def get_prediction_details(self):
        return json.loads(self.prediction_details)

    class Meta:
        db_table = 'user_predictions'  # Specify the correct table name
        managed = False  # Tell Django not to manage this table (create, alter, delete)