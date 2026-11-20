import django_filters

from apps.catalogue.choices import Manches, Modele, MoyenPaiement, Taille, Version

from .models import Commande
from .statuts import Statut


class CommandeFilter(django_filters.FilterSet):
    """Filtres de la liste des commandes (cahier §5.2)."""

    statut = django_filters.ChoiceFilter(choices=Statut.choices)
    moyen_paiement = django_filters.ChoiceFilter(field_name="paiement__moyen", choices=MoyenPaiement.choices)
    modele = django_filters.ChoiceFilter(field_name="lignes__modele", choices=Modele.choices, distinct=True)
    version = django_filters.ChoiceFilter(
        field_name="lignes__version", choices=Version.choices, distinct=True
    )
    manches = django_filters.ChoiceFilter(
        field_name="lignes__manches", choices=Manches.choices, distinct=True
    )
    taille = django_filters.ChoiceFilter(field_name="lignes__taille", choices=Taille.choices, distinct=True)
    date_min = django_filters.DateFilter(field_name="date_creation", lookup_expr="date__gte")
    date_max = django_filters.DateFilter(field_name="date_creation", lookup_expr="date__lte")

    class Meta:
        model = Commande
        fields = []
