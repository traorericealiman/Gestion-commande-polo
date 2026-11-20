from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .choices import Manches, Modele, MoyenPaiement, Taille, Version
from .models import NumeroDepot, ParametresVente, Stock, Tarif
from .serializers import CatalogueSerializer
from .services import quantite_restante


def _choix(enum):
    return [{"valeur": valeur, "libelle": libelle} for valeur, libelle in enum.choices]


class CatalogueView(APIView):
    """Tout ce dont le formulaire de commande a besoin, en un seul appel."""

    permission_classes = [AllowAny]

    @extend_schema(tags=["Public"], responses=CatalogueSerializer, summary="Catalogue et paramètres de vente")
    def get(self, request):
        parametres = ParametresVente.charger()
        donnees = {
            "ventes_ouvertes": parametres.ventes_ouvertes,
            "date_ouverture": parametres.date_ouverture,
            "date_cloture": parametres.date_cloture,
            "quantite_max_par_ligne": parametres.quantite_max_par_ligne,
            "modeles": _choix(Modele),
            "versions": _choix(Version),
            "manches": _choix(Manches),
            "tailles": _choix(Taille),
            "moyens_paiement": _choix(MoyenPaiement),
            "tarifs": Tarif.objects.values("modele", "version", "manches", "prix"),
            "disponibilites": [
                {
                    "modele": s.modele,
                    "version": s.version,
                    "manches": s.manches,
                    "taille": s.taille,
                    "restant": quantite_restante(s.modele, s.version, s.manches, s.taille),
                }
                for s in Stock.objects.all()
            ],
            "numeros_depot": NumeroDepot.objects.filter(actif=True).values("moyen", "numero", "titulaire"),
        }
        return Response(CatalogueSerializer(donnees).data)
