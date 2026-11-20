from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import User
from .services import utilisateur_du_lien


class MoiSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "role", "last_login"]
        read_only_fields = fields


class DeconnexionSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class DemandeReinitialisationSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ReinitialisationSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    mot_de_passe = serializers.CharField(
        write_only=True, trim_whitespace=False, style={"input_type": "password"}
    )

    def validate(self, donnees):
        utilisateur = utilisateur_du_lien(donnees["uid"], donnees["token"])
        if utilisateur is None:
            raise serializers.ValidationError(
                {"token": ["Lien invalide ou expiré. Faites une nouvelle demande."]}
            )
        try:
            validate_password(donnees["mot_de_passe"], utilisateur)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"mot_de_passe": list(exc.messages)}) from exc
        donnees["utilisateur"] = utilisateur
        return donnees
