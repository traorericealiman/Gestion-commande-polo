"""Clôture automatique des commandes « À corriger » restées sans réponse.

À planifier une fois par jour sur le serveur, par exemple avec cron :
    0 3 * * * cd /srv/polo-esatic && .venv/bin/python manage.py cloturer_commandes
"""

from django.core.management.base import BaseCommand, CommandError

from apps.commandes.services import cloturer_commandes_expirees


class Command(BaseCommand):
    help = "Clôture les commandes « À corriger » sans nouvelle capture après le délai (7 jours par défaut)."

    def handle(self, *args, **options):
        cloturees, erreurs = cloturer_commandes_expirees()
        self.stdout.write(f"{cloturees} commande(s) clôturée(s), {erreurs} erreur(s).")
        if erreurs:
            # Code de sortie non nul : la tâche planifiée signale l'échec.
            raise CommandError(f"{erreurs} commande(s) n'ont pas pu être clôturées (voir les logs).")
