from rest_framework import serializers
from .models import DiseaseCondition, LeafScan

class DiseaseConditionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiseaseCondition
        fields = ['name', 'description', 'treatment_steps']

class LeafScanSerializer(serializers.ModelSerializer):
    detected_disease = DiseaseConditionSerializer(read_only=True)

    class Meta:
        model = LeafScan
        fields = ['id', 'image', 'uploaded_at', 'detected_disease', 'confidence_score']