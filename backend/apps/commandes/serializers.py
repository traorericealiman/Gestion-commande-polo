"""Contrat d'API des commandes.

Ces serializers définissent EXACTEMENT ce que le front envoie et reçoit.
Toute modification ici change le contrat : prévenir l'équipe front.
"""

import json

from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.catalogue.choices import Manches, Modele, MoyenPaiement, Taille, Version
from apps.core.validators import valider_capture

from .models import Capture, Commande, Evenement, LigneCommande, Paiement, valider_nom, valider_telephone
from .statuts import Action, MotifRefus, Statut

# ==========================================================================
# PUBLIC : passer une commande
# ==========================================================================


class LigneEntreeSerializer(serializers.Serializer):
    modele = serializers.ChoiceField(choices=Modele.choices)
    version = serializers.ChoiceField(choices=Version.choices)
    manches = serializers.ChoiceField(choices=Manches.choices)
    taille = serializers.ChoiceField(choices=Taille.choices)
    quantite = serializers.IntegerField(min_value=1)


@extend_schema_field(
    {
        "type": "string",
        "description": "Chaîne JSON : liste de lignes {modele, version, manches, taille, quantite}",
        "example": '[{"modele":"LICENCE","version":"BRODE","manches":"COURTES","taille":"M","quantite":1}]',
    }
)
class LignesJSONField(serializers.Field):
    """En multipart/form-data, les lignes arrivent sous forme d'une chaîne JSON :
    lignes='[{"modele":"LICENCE","version":"BRODE","manches":"COURTES","taille":"M","quantite":1}]'
    """

    def to_internal_value(self, data):
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except ValueError as exc:
                raise serializers.ValidationError("JSON invalide.") from exc
        if not isinstance(data, list) or not data:
            raise serializers.ValidationError("Ajoutez au moins un polo.")
        ser = LigneEntreeSerializer(data=data, many=True)
        ser.is_valid(raise_exception=True)
        return ser.validated_data


class CommandeCreationSerializer(serializers.Serializer):
    """Corps de POST /api/v1/commandes/ (multipart/form-data)."""

    nom = serializers.CharField(max_length=60, validators=[valider_nom])
    prenoms = serializers.CharField(min_length=2, max_length=80)
    email = serializers.EmailField()
    email_confirmation = serializers.EmailField()
    lignes = LignesJSONField()
    moyen_paiement = serializers.ChoiceField(choices=MoyenPaiement.choices)
    numero_envoi = serializers.CharField(max_length=20, validators=[valider_telephone])
    reference_transaction = serializers.CharField(max_length=100, required=False, allow_blank=True)
    capture = serializers.FileField(help_text="JPG, PNG ou PDF, 5 Mo maximum")
    confirmation = serializers.BooleanField(
        help_text="Case « Je certifie que les informations et le paiement sont exacts »"
    )

    def validate_capture(self, fichier):
        try:
            valider_capture(fichier)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return fichier

    def validate_confirmation(self, valeur):
        if not valeur:
            raise serializers.ValidationError("Vous devez cocher la case de confirmation.")
        return valeur

    def validate(self, attrs):
        if attrs["email"].lower() != attrs["email_confirmation"].lower():
            raise serializers.ValidationError({"email_confirmation": "Les deux emails ne correspondent pas."})
        return attrs


class CommandeCreeeSerializer(serializers.Serializer):
    """Réponse 201 après l'envoi d'une commande."""

    code_suivi = serializers.CharField(help_text="ex. POLO-2026-0042")
    statut = serializers.ChoiceField(choices=Statut.choices)
    montant_total = serializers.IntegerField()


# ==========================================================================
# PUBLIC : suivre sa commande
# ==========================================================================


class SuiviRequeteSerializer(serializers.Serializer):
    """Le code seul ne suffit pas (codes séquentiels donc devinables) :
    il faut aussi l'email utilisé lors de la commande."""

    code_suivi = serializers.CharField(max_length=20)
    email = serializers.EmailField()


class LigneSortieSerializer(serializers.ModelSerializer):
    prix_ligne = serializers.IntegerField(read_only=True)

    class Meta:
        model = LigneCommande
        fields = ["modele", "version", "manches", "taille", "quantite", "prix_unitaire", "prix_ligne"]


class RetraitSerializer(serializers.Serializer):
    lieu = serializers.CharField()
    horaires = serializers.CharField()
    contact = serializers.CharField(help_text="Numéro à contacter pour récupérer le polo")


class SuiviSerializer(serializers.Serializer):
    """Réponse de POST /api/v1/suivi/."""

    code_suivi = serializers.CharField()
    statut = serializers.ChoiceField(choices=Statut.choices)
    statut_libelle = serializers.CharField()
    montant_total = serializers.IntegerField()
    lignes = LigneSortieSerializer(many=True)
    date_creation = serializers.DateTimeField()
    motif = serializers.ChoiceField(choices=MotifRefus.choices, allow_blank=True)
    motif_libelle = serializers.CharField(allow_blank=True)
    commentaire = serializers.CharField(allow_blank=True, help_text="Message de la trésorière")
    retrait = RetraitSerializer(
        allow_null=True, help_text="Rempli seulement quand le statut est POLO_DISPONIBLE"
    )
    peut_renvoyer_capture = serializers.BooleanField(help_text="Vrai si statut = A_CORRIGER")


class RenvoiCaptureSerializer(SuiviRequeteSerializer):
    """Corps de POST /api/v1/suivi/capture/ (multipart/form-data)."""

    capture = serializers.FileField()
    reference_transaction = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate_capture(self, fichier):
        try:
            valider_capture(fichier)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return fichier


# ==========================================================================
# GESTION (trésorières / administrateur)
# ==========================================================================


class CommandeListeSerializer(serializers.ModelSerializer):
    moyen_paiement = serializers.CharField(source="paiement.moyen")
    numero_envoi = serializers.CharField(source="paiement.numero_envoi")
    nombre_polos = serializers.IntegerField()
    resume_polos = serializers.SerializerMethodField(help_text="ex. « 1 × LICENCE BRODE COURTES M »")

    class Meta:
        model = Commande
        fields = [
            "id",
            "code_suivi",
            "nom",
            "prenoms",
            "email",
            "nombre_polos",
            "resume_polos",
            "montant_total",
            "moyen_paiement",
            "numero_envoi",
            "statut",
            "date_creation",
        ]

    def get_resume_polos(self, obj) -> list[str]:
        return [str(ligne) for ligne in obj.lignes.all()]


class PaiementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Paiement
        fields = ["moyen", "numero_envoi", "reference_transaction"]


class CaptureSerializer(serializers.ModelSerializer):
    url_telechargement = serializers.CharField(
        help_text="URL authentifiée : /api/v1/gestion/commandes/{id}/capture/"
    )

    class Meta:
        model = Capture
        fields = ["id", "type_mime", "taille_octets", "date_envoi", "url_telechargement"]


class AlerteSerializer(serializers.Serializer):
    code = serializers.ChoiceField(
        choices=["CAPTURE_DEJA_UTILISEE", "REFERENCE_DEJA_UTILISEE", "STOCK_INSUFFISANT"]
    )
    message = serializers.CharField()
    commandes_liees = serializers.ListField(child=serializers.CharField(), help_text="Codes de suivi")


class EvenementSerializer(serializers.ModelSerializer):
    auteur = serializers.CharField(source="auteur.__str__", allow_null=True, default=None)

    class Meta:
        model = Evenement
        fields = ["action", "statut_avant", "statut_apres", "auteur", "motif", "commentaire", "date"]


class CommandeDetailSerializer(CommandeListeSerializer):
    lignes = LigneSortieSerializer(many=True)
    paiement = PaiementSerializer()
    capture = CaptureSerializer(allow_null=True)
    alertes = AlerteSerializer(many=True)
    evenements = EvenementSerializer(many=True)
    autres_commandes_meme_email = serializers.ListField(
        child=serializers.CharField(), help_text="Codes de suivi, à titre d'information"
    )
    actions_possibles = serializers.ListField(
        child=serializers.ChoiceField(choices=Action.choices),
        help_text="Boutons à afficher pour cette commande",
    )

    class Meta(CommandeListeSerializer.Meta):
        fields = CommandeListeSerializer.Meta.fields + [
            "lignes",
            "paiement",
            "capture",
            "motif",
            "commentaire",
            "note_interne",
            "date_decision",
            "date_remise",
            "alertes",
            "evenements",
            "autres_commandes_meme_email",
            "actions_possibles",
        ]


class NoteInterneSerializer(serializers.Serializer):
    note_interne = serializers.CharField(allow_blank=True, max_length=5000)


class DecisionSerializer(serializers.Serializer):
    """Corps des actions de gestion. `motif` est obligatoire pour refuser,
    demander un complément et annuler une décision."""

    motif = serializers.ChoiceField(choices=MotifRefus.choices, required=False, allow_blank=True)
    commentaire = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class StockLigneSerializer(serializers.Serializer):
    modele = serializers.CharField()
    version = serializers.CharField()
    manches = serializers.CharField()
    taille = serializers.CharField()
    demande = serializers.IntegerField(help_text="Toutes commandes non refusées / clôturées")
    valide = serializers.IntegerField()
    remis = serializers.IntegerField()
    restant = serializers.IntegerField(allow_null=True, help_text="null = pas de limite")


class TableauDeBordSerializer(serializers.Serializer):
    compteurs = serializers.DictField(
        child=serializers.IntegerField(), help_text="Nombre de commandes par statut"
    )
    montant_encaisse = serializers.IntegerField(help_text="Commandes validées, disponibles ou remises")
    montant_en_attente = serializers.IntegerField()
    stocks = StockLigneSerializer(many=True)
