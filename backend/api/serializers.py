from rest_framework import serializers
from .models import Posting


class PostingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Posting
        fields = ["job_id", "company_name", "title", "description", "location"]


class ResumeResultSerializer(serializers.Serializer):
    ID = serializers.IntegerField()
    Category = serializers.CharField()
    Resume_str = serializers.CharField()
    Resume_html = serializers.CharField()
    score = serializers.FloatField()
