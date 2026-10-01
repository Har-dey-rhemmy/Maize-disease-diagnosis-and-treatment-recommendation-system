from django.db import models
from django.contrib.auth.models import User

class DiseaseCondition(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    treatment_steps = models.JSONField(help_text="Store steps as a list of strings")

    def __str__(self):
        return self.name

class LeafScan(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    image = models.ImageField(upload_to='scans/%Y/%m/%d/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    detected_disease = models.ForeignKey(DiseaseCondition, on_delete=models.SET_NULL, null=True, blank=True)
    confidence_score = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"Scan {self.id} on {self.uploaded_at.strftime('%Y-%m-%d')}"

class UserOTP(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.otp_code}"