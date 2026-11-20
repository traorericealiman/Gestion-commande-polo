"""Catalogue et paramètres de vente, gérés par l'administrateur.

Pour la première version, l'administrateur modifie ces données depuis
l'interface Django (/admin/). Aucun endpoint d'écriture n'est nécessaire.
"""

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from .choices import Manches, Modele, MoyenPaiement, Taille, Version


class Tarif(models.Model):
    """Prix unitaire (FCFA) d'une variante modèle × version × manches."""

    modele = models.CharField(max_length=10, choices=Modele.choices)
    version = models.CharField(max_length=10, choices=Version.choices)
    manches = models.CharField(max_length=10, choices=Manches.choices)
    prix = models.PositiveIntegerField("prix (FCFA)", validators=[MinValueValidator(1)])

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["modele", "version", "manches"], name="tarif_unique_variante")
        ]
        ordering = ["modele", "version", "manches"]

    def __str__(self):
        return f"{self.get_modele_display()} {self.get_version_display()} {self.get_manches_display()} : {self.prix} FCFA"


class Stock(models.Model):
    """Quantité maximale vendable pour une combinaison complète.

    Absence de ligne = pas de limite. Le stock est consommé à la VALIDATION
    d'une commande, pas à sa soumission (cahier RG4).
    """

    modele = models.CharField(max_length=10, choices=Modele.choices)
    version = models.CharField(max_length=10, choices=Version.choices)
    manches = models.CharField(max_length=10, choices=Manches.choices)
    taille = models.CharField(max_length=5, choices=Taille.choices)
    quantite_max = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["modele", "version", "manches", "taille"], name="stock_unique_combinaison"
            )
        ]
        ordering = ["modele", "version", "manches", "taille"]

    def __str__(self):
        return f"{self.modele}/{self.version}/{self.manches}/{self.taille} : {self.quantite_max}"


class NumeroDepot(models.Model):
    """Numéro mobile money sur lequel l'acheteur doit faire son dépôt."""

    moyen = models.CharField(max_length=20, choices=MoyenPaiement.choices)
    numero = models.CharField(max_length=20)
    titulaire = models.CharField(max_length=100)
    actif = models.BooleanField(default=True)

    class Meta:
        verbose_name = "numéro de dépôt"
        verbose_name_plural = "numéros de dépôt"
        constraints = [models.UniqueConstraint(fields=["moyen", "numero"], name="numero_depot_unique")]
        indexes = [models.Index(fields=["moyen", "actif"])]

    def __str__(self):
        return f"{self.get_moyen_display()} {self.numero} ({self.titulaire})"


class ParametresVente(models.Model):
    """Paramètres globaux. Une seule ligne en base (id=1) : ParametresVente.charger()."""

    date_ouverture = models.DateTimeField(null=True, blank=True)
    date_cloture = models.DateTimeField(null=True, blank=True)
    quantite_max_par_ligne = models.PositiveSmallIntegerField(default=5, validators=[MinValueValidator(1)])
    lieu_retrait = models.CharField(max_length=200, blank=True)
    horaires_retrait = models.CharField(max_length=200, blank=True)
    contact_retrait = models.CharField("numéro à contacter pour le retrait", max_length=20, blank=True)
    delai_correction_jours = models.PositiveSmallIntegerField(
        "délai avant clôture d'une commande « À corriger » (jours)", default=7
    )

    class Meta:
        verbose_name = "paramètres de vente"
        verbose_name_plural = "paramètres de vente"

    def __str__(self):
        return "Paramètres de vente"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def clean(self):
        if self.date_ouverture and self.date_cloture and self.date_cloture <= self.date_ouverture:
            raise ValidationError("La date de clôture doit être après la date d'ouverture.")

    @classmethod
    def charger(cls) -> "ParametresVente":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @property
    def ventes_ouvertes(self) -> bool:
        maintenant = timezone.now()
        if self.date_ouverture and maintenant < self.date_ouverture:
            return False
        if self.date_cloture and maintenant >= self.date_cloture:
            return False
        return True
