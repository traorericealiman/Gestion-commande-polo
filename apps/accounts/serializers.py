from rest_framework import serializers

from .models import User


class MoiSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "role", "last_login"]
        read_only_fields = fields


class DeconnexionSerializer(serializers.Serializer):
    refresh = serializers.CharField()
