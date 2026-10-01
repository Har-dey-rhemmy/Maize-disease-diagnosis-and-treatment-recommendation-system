# diagnosis/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('auth/', views.auth_page, name='auth_page'),
    path('settings/', views.settings_page, name='settings_page'),
    path('history/', views.history_page, name='history_page'),
    path('api/register/', views.RegisterUserView.as_view(), name='register'),
    path('api/login/', views.LoginUserView.as_view(), name='login'),
    path('api/verify-otp/', views.VerifyOTPView.as_view(), name='verify-otp'),
    path('api/check-unique/', views.CheckUniqueView.as_view(), name='check-unique'),
    path('api/password-reset-request/', views.PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('api/password-reset-confirm/', views.PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('api/scan/', views.ScanLeafView.as_view(), name='scan-leaf'),
    path('api/history/', views.ScanHistoryView.as_view(), name='scan-history'),
    path('api/profile/', views.UserProfileView.as_view(), name='user-profile'),
    path('api/change-password/', views.ChangePasswordView.as_view(), name='change-password'),
    path('api/google-login/', views.GoogleLoginView.as_view(), name='google-login'),
    path('api/delete-account/', views.delete_account, name='delete_account'),
]