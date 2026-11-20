from rest_framework import serializers


class ChoixSerializer(serializers.Serializer):
    valeur = serializers.CharField(help_text="Valeur technique à renvoyer à l'API, ex. BRODE")
    libelle = serializers.CharField(help_text="Texte à afficher, ex. Brodé")


class TarifSerializer(serializers.Serializer):
    modele = serializers.CharField()
    version = serializers.CharField()
    manches = serializers.CharField()
    prix = serializers.IntegerField(help_text="Prix unitaire en FCFA")


class DisponibiliteSerializer(serializers.Serializer):
    modele = serializers.CharField()
    version = serializers.CharField()
    manches = serializers.CharField()
    taille = serializers.CharField()
    restant = serializers.IntegerField(help_text="0 = épuisé : griser la taille")


class NumeroDepotSerializer(serializers.Serializer):
    moyen = serializers.CharField()
    numero = serializers.CharField()
    titulaire = serializers.CharField()


class CatalogueSerializer(serializers.Serializer):
    ventes_ouvertes = serializers.BooleanField()
    date_ouverture = serializers.DateTimeField(allow_null=True)
    date_cloture = serializers.DateTimeField(allow_null=True)
    quantite_max_par_ligne = serializers.IntegerField()
    modeles = ChoixSerializer(many=True)
    versions = ChoixSerializer(many=True)
    manches = ChoixSerializer(many=True)
    tailles = ChoixSerializer(many=True)
    moyens_paiement = ChoixSerializer(many=True)
    tarifs = TarifSerializer(many=True)
    disponibilites = DisponibiliteSerializer(
        many=True,
        help_text="Uniquement les combinaisons qui ont un stock limité. "
        "Une combinaison absente de la liste n'a pas de limite.",
    )
    numeros_depot = NumeroDepotSerializer(many=True, help_text="Numéros actifs uniquement")
