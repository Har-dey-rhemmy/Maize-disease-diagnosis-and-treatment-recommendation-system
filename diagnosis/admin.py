from django.contrib import admin
from .models import LeafScan, DiseaseCondition, UserOTP

# Registered models
admin.site.register(LeafScan)
admin.site.register(DiseaseCondition)
admin.site.register(UserOTP)