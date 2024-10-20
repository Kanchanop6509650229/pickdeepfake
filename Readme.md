# PickDeepFake - Web Application Installation Guide

## Table of Contents
- [Prerequisites](#prerequisites)
- [Installation Steps](#installation-steps)
  - [Step 1: Installing Dependencies](#step-1-installing-dependencies)
  - [Step 2: MySQL Database Setup](#step-2-mysql-database-setup)
  - [Step 3: Auth0 Configuration](#step-3-auth0-configuration)
  - [Step 4: Django Settings](#step-4-django-settings)
  - [Step 5: Running the Server](#step-5-running-the-server)
- [Known Issues](#known-issues)
- [User Guide](#user-guide)

## Prerequisites
- Python
- MySQL
- Auth0 Account

## Installation Steps

### Step 1: Installing Dependencies

1. Create and activate virtual environment:
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# For Unix:
source venv/bin/activate
# For Windows:
venv\Scripts\activate
```

2. Update wheel library:
```bash
python -m pip install --upgrade pip setuptools wheel
```

3. Install required packages:
```bash
pip install -r requirements.txt
```

4. Install dlib:
   - Download `dlib-19.24.2-cp312-cp312-win_amd64.whl` from [GitHub](https://github.com/Silufer/dlib-python)
   - Install using:
```bash
python -m pip install "path/to/downloaded/file"
```

### Step 2: MySQL Database Setup

1. Install MySQL if not already installed
2. Create new MySQL Connection:
   - Hostname: 127.0.0.1
   - Port: 3306
   - Set your preferred Connection Name, Username, and Password
3. Access your MySQL Connection
4. Execute `setupsql.sql` script
5. Update `settings.py` with your MySQL credentials:
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'your_database_name',
        'USER': 'your_username',
        'PASSWORD': 'your_password',
        'HOST': '127.0.0.1',
        'PORT': '3306',
    }
}
```

### Step 3: Auth0 Configuration

1. Create an Auth0 account and application
2. Configure application settings:
   - Allowed Callback URLs: `http://127.0.0.1:8000/callback/`
   - Allowed Logout URLs: `http://127.0.0.1:8000/detecting/`
   - Allowed Web Origins: `http://127.0.0.1:8000/`
3. Update `settings.py` with Auth0 credentials:
```python
AUTH0_DOMAIN = 'your-domain'
AUTH0_CLIENT_ID = 'your-client-id'
AUTH0_CLIENT_SECRET = 'your-client-secret'
```

### Step 4: Django Settings

1. Verify database configuration in `settings.py`
2. Verify Auth0 configuration
3. Update `SECRET_KEY` with a secure value
4. Set `DEBUG = False` for production

### Step 5: Running the Server

```bash
# Navigate to project directory
cd path/to/PickDeepFake

# Start server
python manage.py runserver
```

Access the website at: http://127.0.0.1:8000

## Known Issues

1. Server termination message after Ctrl+C:
```
forrtl: error (200): program aborting due to control-C event
```
(This doesn't affect functionality)

2. First image deletion might fail on initial server run for logged-in users
3. For non-logged-in users, Ctrl+F5 refresh may reset usage count to 10/10
4. Very blurry images may not be processed (protection mechanism in `views.py`)
5. Small images may not display properly in full-screen mode

## User Guide

1. Access website at http://127.0.0.1:8000
2. Click "เริ่มการตรวจสอบภาพ" to access the image analysis page
![image](https://github.com/user-attachments/assets/c48b00d9-fc3e-4297-be9c-1a9185edcfe1)

3. Non-logged-in users get 10 free uses (resets every 6 hours)
![image](https://github.com/user-attachments/assets/98184de9-a79e-4da2-bd8c-50dcc9ff6a83)
![image](https://github.com/user-attachments/assets/f58356b9-6ba3-4bda-999c-dc573e001c72)

4. Click website logo to return to homepage
![image](https://github.com/user-attachments/assets/746ae7f1-a583-45ef-badb-8152614b0651)

5. Click "แนบรูปภาพ" to upload an image
![image](https://github.com/user-attachments/assets/cb7d6b56-2a50-4439-92d7-d122ace75076)

6. Click uploaded image for full-screen view
![image](https://github.com/user-attachments/assets/ea9c8048-f929-4ba0-9ef9-19f6177c7609)
![image](https://github.com/user-attachments/assets/8b0c6d90-6411-4017-90ef-6df84145becd)


7. Click "เริ่มการตรวจสอบภาพ" to start analysis
![image](https://github.com/user-attachments/assets/02ce401f-ff7b-4f72-85e7-c382e3ca88d1)
![image](https://github.com/user-attachments/assets/e60263f2-ada4-445b-93df-cdaa5660ea9d)

8. Analysis results include:
   - Remaining usage count
   - Analysis results below image
   - Image source information
   - Analysis history (right side)
![image](https://github.com/user-attachments/assets/e0893f89-cd4d-4d7d-8043-1b0247ce42b0)


### Authentication Features

- Click "เข้าสู่ระบบ" for unlimited usage
![image](https://github.com/user-attachments/assets/ee10777e-81ec-46bb-b305-b3b95e34b60a)

- Login options:
  - Email/Username and password
  - Google SSO
- New users can register via "Sign Up"
- Logged-in users get:
  - Unlimited analysis
  - Persistent analysis history
  - Ability to delete history (individual or all)
![image](https://github.com/user-attachments/assets/33ac2264-f0ba-432c-82da-d971e47cb45c)


---

ข้อตกลงในการใช้ซอฟต์แวร์
ซอฟต์แวร์นี้เป็นผลงานที่พัฒนาขึ้นโดย นายกาญจนพ บัวรอด, นายพนพล จุ่นเจิม และนางสาวศิวพร ลมสูงเนิน  จาก มหาวิทยาลัยธรรมศาสตร์ ภายใต้การดูแลของ รศ.ดร.ธนาธร ทะนานทอง ภายใต้โครงการระบบปัญญาประดิษฐ์สำหรับการตรวจสอบภาพปลอมบนสื่อสังคมออนไลน์ ซึ่งสนับสนุนโดย สำนักงานพัฒนาวิทยาศาสตร์และเทคโนโลยีแห่งชาติโดยมีวัตถุประสงค์เพื่อส่งเสริมให้นักเรียนและนักศึกษาได้เรียนรู้และฝึกทักษะในการพัฒนาซอฟต์แวร์ลิขสิทธิ์ของซอฟต์แวร์นี้จึงเปน็ ของผู้พัฒนา ซึ่งผู้พัฒนาได้อนุญาตให้สำนักงานพัฒนาวิทยาศาสตร์และเทคโนโลยีแห่งชาติเผยแพร่ซอฟต์แวร์นี้ตาม “ต้นฉบับ” โดยไม่มีการแก้ไขดัดแปลงใด ๆ ทั้งสิ้น ให้แก่บุคคลทั่วไปได้ใช้เพื่อประโยชน์ส่วนบุคคลหรือประโยชน์ทางการศึกษาที่ไม่มีวัตถุประสงค์ในเชิงพาณิชย์โดยไม่คิดค่าตอบแทนการใช้ซอฟต์แวร์ดังน้ัน สำนักงานพัฒนาวิทยาศาสตร์และเทคโนโลยีแห่งชาติจึงไม่มีหน้าที่ในการดูแล บำรุงรักษา จัดการอบรมการใช้งาน หรือพัฒนาประสิทธิภาพซอฟต์แวร์ รวมทั้งไม่รับรองความถูกต้องหรือประสิทธิภาพการทำงานของซอฟต์แวร์ ตลอดจนไม่รับประกันความเสียหายต่าง ๆ อันเกิดจากการใช้ซอฟต์แวร์นี้ท้ังสิ้น

License Agreement
This software is a work developed by Kanchanop Buarod, Panapol Junjerm, and Siwaporn Lomsungnoen from Thammasat University under the provision of Assoc.Prof.Dr. Tanatorn Tanantong. under AI System for Detecting Fake Images on Social Media, which has been supported by the National Science and Technology Development Agency (NSTDA), in order to encourage pupils and students to learn and practice their skills in developing software. Therefore, the intellectual property of this software shall belong to the developer and the developer gives NSTDA a permission to distribute this software as an “as is” and non-modified software for a temporary and non-exclusive use without remuneration to anyone for his or her own purpose or academic purpose, which are not commercial purposes. In this connection, NSTDA shall not be responsible to the user for taking care, maintaining, training, or developing the efficiency of this software. Moreover, NSTDA shall not be liable for any error, software efficiency and damages in connection with or arising out of the use of the software.”
