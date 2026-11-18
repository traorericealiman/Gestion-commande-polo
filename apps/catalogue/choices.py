"""Valeurs possibles du catalogue. Le front reçoit les valeurs techniques
(ex. "BRODE") et les libellés (ex. "Brodé") via l'endpoint /catalogue/."""

from django.db import models


class Modele(models.TextChoices):
    LICENCE = "LICENCE", "Licence"
    MASTER = "MASTER", "Master"


class Version(models.TextChoices):
    SIMPLE = "SIMPLE", "Simple"
    BRODE = "BRODE", "Brodé"


class Manches(models.TextChoices):
    COURTES = "COURTES", "Manches courtes"
    LONGUES = "LONGUES", "Manches longues"


class Taille(models.TextChoices):
    S = "S", "S"
    M = "M", "M"
    L = "L", "L"
    XL = "XL", "XL"
    XXL = "XXL", "XXL"


class MoyenPaiement(models.TextChoices):
    WAVE = "WAVE", "Wave"
    ORANGE_MONEY = "ORANGE_MONEY", "Orange Money"
    MTN_MONEY = "MTN_MONEY", "MTN Money"
    MOOV_MONEY = "MOOV_MONEY", "Moov Money"
