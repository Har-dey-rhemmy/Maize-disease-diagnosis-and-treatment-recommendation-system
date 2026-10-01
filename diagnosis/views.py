import os
import numpy as np
from PIL import Image, ImageOps
import tensorflow as tf

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from django.conf import settings
from django.shortcuts import render, redirect
import random
from email_validator import validate_email, EmailNotValidError
from rest_framework.decorators import api_view, permission_classes
from .models import UserOTP, LeafScan, DiseaseCondition
from .serializers import LeafScanSerializer



# 1. GLOBAL AI MODEL SETUP
MODEL_PATH = os.path.join(settings.BASE_DIR, 'maize_diseasesss_mobilenetv3.keras')

try:
    print("Loading AI Brain into memory...")
    production_model = tf.keras.models.load_model(MODEL_PATH)
except Exception as e:
    print(f"⚠️ Warning: Could not load model at {MODEL_PATH}. Error: {e}")
    production_model = None

class_labels = ['maize_blight', 'maize_healthy', 'maize_rust', 'maize_streak_virus', 'not_maize']

# Treatment database
treatment_database = {
    'maize_blight': {
        'name': "Northern Corn Leaf Blight (NCLB)",
        'symptoms': "Long, elliptical, grayish-green or tan lesions on leaves.",
        'treatment_steps': [
            "Apply fungicides containing mancozeb or difenoconazole (Azoxystrobin + Difenoconazole Premixes or Azoxystrobin + Mancozeb Mixes).",
            "For future planting, select NCLB-resistant maize hybrids.",
            "Implement crop rotation with non-host crops like soybeans or groundnuts."
        ]
    },
    'maize_gray_spot': {
        'name': "Gray Leaf Spot",
        'symptoms': "Rectangular, pale brown or gray lesions restricted by leaf veins.",
        'treatment_steps': [
            "Apply foliar fungicides (Azoxystrobin + Difenoconazole Premixes, Azoxystrobin + Mancozeb Mixes or Pyraclostrobin Premixes) immediately at the first sign of lesions.", 
            "Practice deep tillage to bury infected crop residue."

        ]
    },
    'maize_rust': {
        'name': "Common Rust",
        'symptoms': "Small, powdery, circular to elongated, cinnamon-brown pustules.",
        'treatment_steps': [
            "Fungicide application (Azoxystrobin or Mancozeb) is usually only necessary in severe outbreaks on susceptible varieties before the silking stage.",
            "Ensure proper field spacing to reduce humidity."

        ]
    },
    'maize_streak_virus': {
        'name': "Maize Streak Disease (Viral)",
        'symptoms': "Narrow, continuous, yellow-to-white streaks running parallel to veins.",
        'treatment_steps': [
            "Immediately uproot and destroy infected plants to prevent spread.",
            "Control the leafhopper insect vectors using systemic insecticides.",
            "Plant MSV-resistant seeds early next season."
        ]
    },
    'maize_healthy': {
        'name': "Healthy Maize",
        'symptoms': "Vibrant green leaves with no visible lesions.",
        'treatment_steps': [
            "Maintain current agricultural practices.", 
            "Continue regular scouting and apply standard NPK fertilizers."
        ]
    },
    'not_maize': {
        'name': "Unrecognized Image",
        'symptoms': "The AI could not confidently identify a maize disease.",
        'treatment_steps': [
            "Please ensure the photograph is clearly focused on a single maize leaf.", 
            "Ensure the area is well-lit and try taking the photo again."
        ]
    }
}

# 2. STANDARD VIEWS
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])  # Ensures an unauthenticated user cannot hit this endpoint
def delete_account(request):
    try:
        # request.user automatically contains the user associated with the token
        user = request.user
        
        # Django's .delete() method permanently removes the user and cascades 
        # to delete their associated history/data if models are linked via ForeignKey
        user.delete() 
        
        return Response({"message": "Account successfully deleted."}, status=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
def home(request):
    return render(request, 'index.html')

def auth_page(request):
    return render(request, 'auth.html')

def settings_page(request):
    return render(request, 'settings.html')

def history_page(request):
    return render(request, 'history.html')

class CheckUniqueView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        field = request.data.get('field')
        value = request.data.get('value')

        if field == 'email':
            is_taken = User.objects.filter(email=value, is_active=True).exists()
        elif field == 'username':
            is_taken = User.objects.filter(username=value, is_active=True).exists()
        else:
            return Response({"error": "Invalid field"}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"is_taken": is_taken}, status=status.HTTP_200_OK)

class RegisterUserView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        email = request.data.get('email')
        username = request.data.get('username') 
        password = request.data.get('password')
        name = request.data.get('name')
        
        try:
            valid = validate_email(email, check_deliverability=True)
            email = valid.normalized 
        except EmailNotValidError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        email_user = User.objects.filter(email=email).first()
        if email_user:
            if email_user.is_active:
                return Response({"error": "Email is already registered."}, status=status.HTTP_400_BAD_REQUEST)
            else:
                email_user.delete()

        username_user = User.objects.filter(username=username).first()
        if username_user:
            if username_user.is_active:
                return Response({"error": "Username is already taken."}, status=status.HTTP_400_BAD_REQUEST)
            else:
                username_user.delete()
        
        user = User.objects.create_user(username=username, email=email, password=password, first_name=name)
        user.is_active = False 
        user.save()
        
        code = str(random.randint(100000, 999999))
        UserOTP.objects.update_or_create(user=user, defaults={'otp_code': code})
        
        send_mail(
            subject="Your MaizeHealth Verification Code",
            message=f"Hi {name},\n\nYour 6-digit verification code is: {code}\n\nPlease enter this code on the website to activate your account.\n\nThank you!",
            from_email=settings.EMAIL_HOST_USER,
            recipient_list=[email],
            fail_silently=False,
        )
        
        return Response({"message": "Please enter the 6-digit code sent to your email.", "email": email}, status=status.HTTP_201_CREATED)

class LoginUserView(APIView):
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        
        try:
            user_check = User.objects.get(email=email)
            if not user_check.is_active:
                return Response({"error": "Please check your email and verify your account before logging in."}, status=status.HTTP_403_FORBIDDEN)
                
            user = authenticate(username=user_check.username, password=password)
            
            if user:
                token, _ = Token.objects.get_or_create(user=user)
                return Response({"token": token.key, "username": user.username}, status=status.HTTP_200_OK)
            else:
                return Response({"error": "Invalid email or password."}, status=status.HTTP_401_UNAUTHORIZED)
                
        except User.DoesNotExist:
            return Response({"error": "Invalid email or password."}, status=status.HTTP_401_UNAUTHORIZED)

class VerifyOTPView(APIView):
    def post(self, request):
        email = request.data.get('email')
        otp_entered = request.data.get('otp_code')

        try:
            user = User.objects.get(email=email)
            user_otp = UserOTP.objects.get(user=user)

            if user_otp.otp_code == otp_entered:
                user.is_active = True
                user.save()
                user_otp.delete()
                token, _ = Token.objects.get_or_create(user=user)
                
                return Response({
                    "message": "Account verified successfully!",
                    "token": token.key,        
                    "username": user.username  
                }, status=status.HTTP_200_OK)
            else:
                return Response({"error": "Invalid verification code."}, status=status.HTTP_400_BAD_REQUEST)
                
        except (User.DoesNotExist, UserOTP.DoesNotExist):
            return Response({"error": "User or OTP not found."}, status=status.HTTP_404_NOT_FOUND)

# 3. THE AI INTEGRATION (SCAN LEAF)
class ScanLeafView(APIView):
    #authentication_classes = [TokenAuthentication]
    #permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        file_serializer = LeafScanSerializer(data=request.data)

        if file_serializer.is_valid():
            scan_instance = file_serializer.save(
                user=request.user if request.user.is_authenticated else None
            )

            if production_model is None:
                return Response({"error": "AI Model is currently offline."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

            try:
                img = Image.open(scan_instance.image.path)
                img = ImageOps.exif_transpose(img)
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                img = img.resize((254, 254))
                img_array = np.array(img).astype('float32')
                img_array = np.expand_dims(img_array, axis=0)

                predictions = production_model.predict(img_array, verbose=0)
                probs = predictions[0]
                winning_index = int(np.argmax(probs))

                confidence_score = float(probs[winning_index])
                confidence_percent = confidence_score * 100
                predicted_class = class_labels[winning_index]
                LOW_CONFIDENCE_THRESHOLD = 30.0
                if confidence_percent < LOW_CONFIDENCE_THRESHOLD:
                    predicted_class = 'not_maize'

                report = treatment_database.get(predicted_class)

                disease, created = DiseaseCondition.objects.get_or_create(
                    name=report['name'],
                    defaults={
                        "description": report['symptoms'],
                        "treatment_steps": report['treatment_steps']
                    }
                )

                scan_instance.detected_disease = disease
                scan_instance.confidence_score = round(confidence_score, 4)
                scan_instance.save()

                threat_mapping = {
                    'maize_blight': 'High',
                    'maize_gray_spot': 'Severe',
                    'maize_rust': 'Moderate',
                    'maize_streak_virus': 'Severe',
                    'maize_healthy': 'None',
                    'not_maize': 'N/A'
                }
                return Response({
                    "scan_data": LeafScanSerializer(scan_instance).data,
                    "disease_name": report['name'],
                    "confidence": round(confidence_percent, 1),
                    "threat_level": threat_mapping.get(predicted_class, 'Unknown'),
                    "symptoms": report['symptoms'],
                    "treatment": " ".join(report['treatment_steps'])
                }, status=status.HTTP_201_CREATED)

            except Exception as e:
                return Response({"error": f"Image processing failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        else:
            return Response(file_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# 4. ACCOUNT & PROFILE VIEWS
class PasswordResetRequestView(APIView):
    def post(self, request):
        email = request.data.get('email')
        try:
            user = User.objects.get(email=email)
            code = str(random.randint(100000, 999999))
            UserOTP.objects.update_or_create(user=user, defaults={'otp_code': code})
            
            send_mail(
                subject="MaizeHealth - Password Reset Code",
                message=f"Hi {user.first_name},\n\nWe received a request to reset your password. Your 6-digit reset code is: {code}\n\nIf you did not request this, please ignore this email.\n\nThank you!",
                from_email=settings.EMAIL_HOST_USER,
                recipient_list=[email],
                fail_silently=False,
            )
            return Response({"message": "Password reset code sent."}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "No account found with this email address."}, status=status.HTTP_404_NOT_FOUND)

class PasswordResetConfirmView(APIView):
    def post(self, request):
        email = request.data.get('email')
        otp_entered = request.data.get('otp_code')
        new_password = request.data.get('new_password')

        try:
            user = User.objects.get(email=email)
            user_otp = UserOTP.objects.get(user=user)

            if user_otp.otp_code == otp_entered:
                user.set_password(new_password)
                user.save()
                user_otp.delete()
                return Response({"message": "Password reset successfully!"}, status=status.HTTP_200_OK)
            else:
                return Response({"error": "Invalid reset code."}, status=status.HTTP_400_BAD_REQUEST)
        except (User.DoesNotExist, UserOTP.DoesNotExist):
            return Response({"error": "User or OTP not found."}, status=status.HTTP_404_NOT_FOUND)
        
class ScanHistoryView(APIView):
    authentication_classes = [TokenAuthentication] 
    permission_classes = [IsAuthenticated] 

    def get(self, request):
        scans = LeafScan.objects.filter(user=request.user).order_by('-uploaded_at')
        history_data = []
        for scan in scans:
            history_data.append({
                "id": scan.id,
                "disease_name": str(scan.detected_disease) if scan.detected_disease else "Unknown",
                "confidence": scan.confidence_score, 
                "date": scan.uploaded_at.strftime("%b %d, %Y - %I:%M %p"), 
                "image_url": request.build_absolute_uri(scan.image.url) if scan.image else None
            })
        return Response(history_data, status=status.HTTP_200_OK)

class UserProfileView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "name": user.first_name,
            "username": user.username,
            "email": user.email,
            "date_joined": user.date_joined.strftime("%B %Y")
        }, status=status.HTTP_200_OK)

    def put(self, request):
        user = request.user
        name = request.data.get('name')
        username = request.data.get('username')

        if username and username != user.username:
            if User.objects.filter(username=username).exists():
                return Response({"error": "That username is already taken."}, status=status.HTTP_400_BAD_REQUEST)
            user.username = username

        if name:
            user.first_name = name

        user.save()
        return Response({"message": "Profile updated successfully!", "username": user.username}, status=status.HTTP_200_OK)

class ChangePasswordView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')

        if not user.check_password(old_password):
            return Response({"error": "Incorrect current password."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({"message": "Password changed successfully!"}, status=status.HTTP_200_OK)
    
class GoogleLoginView(APIView):
    authentication_classes = [] 
    permission_classes = [AllowAny]
    def post(self, request):
        token = request.data.get('credential')
        CLIENT_ID = "1089267397562-j3l493j8iu4137980ukg8q62gv8s9ja7.apps.googleusercontent.com" 

        try:
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), CLIENT_ID)
            email = idinfo['email']
            first_name = idinfo.get('given_name', '')
            last_name = idinfo.get('family_name', '')
            username = email.split('@')[0]

            user, created = User.objects.get_or_create(email=email, defaults={
                'username': username,
                'first_name': first_name,
                'last_name': last_name,
            })

            if created:
                user.set_unusable_password()
                user.save()

            maize_token, _ = Token.objects.get_or_create(user=user)

            return Response({
                "token": maize_token.key,
                "username": user.username,
                "message": "Welcome to MaizeHealth!"
            }, status=status.HTTP_200_OK)

        except ValueError:
            return Response({"error": "Invalid Google login attempt."}, status=status.HTTP_400_BAD_REQUEST)