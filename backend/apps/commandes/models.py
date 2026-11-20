"""Commandes de polos.

Une commande = un acheteur + une ou plusieurs lignes de polos + un paiement
+ une ou plusieurs captures (la dernière fait foi) + son historique.
Aucune commande n'est jamais supprimée (traçabilité, cahier §8.3).
"""

from django.conf import settings
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models

from apps.catalogue.choices import Manches, Modele, MoyenPaiement, Taille, Version
from apps.core.storage import stockage_prive

from .statuts import Action, MotifRefus, Statut

valider_nom = RegexValidator(
    r"^[A-Za-zÀ-ÖØ-öø-ÿ' \-]{2,60}$",
    "2 à 60 caractères : lettres, espaces, tirets ou apostrophes.",
)
valider_telephone = RegexValidator(r"^\+?[0-9]{8,15}$", "Numéro de téléphone invalide (8 à 15 chiffres).")


class Commande(models.Model):
    # null autorisé un court instant : le code dépend de l'id, attribué après l'INSERT.
    code_suivi = models.CharField(max_length=20, unique=True, null=True, editable=False)  # noqa: DJ001

    # Identité de l'acheteur
    nom = models.CharField(max_length=60, validators=[valider_nom])
    prenoms = models.CharField("prénoms", max_length=80)
    email = models.EmailField(db_index=True)

    # Montant figé à l'envoi, calculé par le serveur (RG8)
    montant_total = models.PositiveIntegerField("montant total (FCFA)")

    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.EN_ATTENTE)

    # Dernière décision, visible par l'acheteur (refus / complément demandé)
    motif = models.CharField(max_length=30, choices=MotifRefus.choices, blank=True)
    commentaire = models.TextField(blank=True)

    # Visible uniquement par les trésorières
    note_interne = models.TextField(blank=True)

    date_creation = models.DateTimeField(auto_now_add=True)
    date_modification = models.DateTimeField(auto_now=True)
    date_decision = models.DateTimeField(null=True, blank=True)
    date_remise = models.DateTimeField(null=True, blank=True)
    remis_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )

    class Meta:
        ordering = ["date_creation"]
        indexes = [
            models.Index(fields=["statut", "date_creation"]),
        ]

    def __str__(self):
        return self.code_suivi or f"Commande #{self.pk}"

    @property
    def capture_actuelle(self):
        return self.captures.order_by("-date_envoi").first()

    @property
    def nombre_polos(self) -> int:
        return sum(ligne.quantite for ligne in self.lignes.all())


class LigneCommande(models.Model):
    commande = models.ForeignKey(Commande, on_delete=models.PROTECT, related_name="lignes")
    modele = models.CharField(max_length=10, choices=Modele.choices)
    version = models.CharField(max_length=10, choices=Version.choices)
    manches = models.CharField(max_length=10, choices=Manches.choices)
    taille = models.CharField(max_length=5, choices=Taille.choices)
    quantite = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    # Prix figé au moment de l'envoi
    prix_unitaire = models.PositiveIntegerField()

    class Meta:
        verbose_name = "ligne de commande"
        verbose_name_plural = "lignes de commande"
        indexes = [models.Index(fields=["modele", "version", "manches", "taille"])]

    def __str__(self):
        return f"{self.quantite} × {self.modele} {self.version} {self.manches} {self.taille}"

    @property
    def prix_ligne(self) -> int:
        return self.prix_unitaire * self.quantite


class Paiement(models.Model):
    commande = models.OneToOneField(Commande, on_delete=models.PROTECT, related_name="paiement")
    moyen = models.CharField(max_length=20, choices=MoyenPaiement.choices)
    numero_envoi = models.CharField(
        "numéro depuis lequel le dépôt a été fait", max_length=20, validators=[valider_telephone]
    )
    reference_transaction = models.CharField(max_length=100, blank=True, db_index=True)

    def __str__(self):
        return f"{self.get_moyen_display()} depuis {self.numero_envoi}"


def _chemin_capture(instance, nom_fichier):
    extension = nom_fichier.rsplit(".", 1)[-1].lower() if "." in nom_fichier else "bin"
    return f"captures/{instance.commande_id}/{instance.empreinte[:16]}.{extension}"


class Capture(models.Model):
    """Capture de paiement. Une commande « À corriger » peut en recevoir une
    nouvelle : on garde toutes les versions, la plus récente fait foi."""

    commande = models.ForeignKey(Commande, on_delete=models.PROTECT, related_name="captures")
    fichier = models.FileField(storage=stockage_prive, upload_to=_chemin_capture)
    empreinte = models.CharField("empreinte SHA-256", max_length=64, db_index=True)
    type_mime = models.CharField(max_length=50)
    taille_octets = models.PositiveIntegerField()
    date_envoi = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_envoi"]

    def __str__(self):
        return f"Capture {self.empreinte[:10]} ({self.commande})"


class Evenement(models.Model):
    """Historique : qui a fait quoi et quand (cahier §5.3, RG3)."""

    commande = models.ForeignKey(Commande, on_delete=models.PROTECT, related_name="evenements")
    action = models.CharField(max_length=30, choices=Action.choices)
    statut_avant = models.CharField(max_length=20, choices=Statut.choices, blank=True)
    statut_apres = models.CharField(max_length=20, choices=Statut.choices)
    # null = acheteur ou système
    auteur = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    motif = models.CharField(max_length=30, choices=MotifRefus.choices, blank=True)
    commentaire = models.TextField(blank=True)
    date = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date"]
        verbose_name = "événement"

    def __str__(self):
        return f"{self.commande} : {self.action} ({self.date:%d/%m/%Y %H:%M})"
