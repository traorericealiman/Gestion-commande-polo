"""Tarifs du cahier des charges (§2) et paramètres de vente par défaut.

Simple : 6 000 (courtes) / 8 000 (longues) ; Brodé : 8 000 / 10 000.
Mêmes prix pour Licence et Master. Modifiables ensuite dans /admin/.
"""

from django.db import migrations

PRIX = {
    ("SIMPLE", "COURTES"): 6000,
    ("SIMPLE", "LONGUES"): 8000,
    ("BRODE", "COURTES"): 8000,
    ("BRODE", "LONGUES"): 10000,
}


def charger(apps, schema_editor):
    Tarif = apps.get_model("catalogue", "Tarif")
    ParametresVente = apps.get_model("catalogue", "ParametresVente")
    for modele in ("LICENCE", "MASTER"):
        for (version, manches), prix in PRIX.items():
            Tarif.objects.update_or_create(
                modele=modele, version=version, manches=manches, defaults={"prix": prix}
            )
    ParametresVente.objects.get_or_create(pk=1)


def vider(apps, schema_editor):
    apps.get_model("catalogue", "Tarif").objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("catalogue", "0001_initial")]

    operations = [migrations.RunPython(charger, vider)]
