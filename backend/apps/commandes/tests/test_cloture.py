"""Tests de la clôture automatique (python manage.py cloturer_commandes)."""

from datetime import timedelta
from io import StringIO
from unittest import mock

from django.core import mail
from django.core.management import CommandError, call_command
from django.test import TestCase
from django.utils import timezone

from apps.catalogue.models import ParametresVente
from apps.commandes import services
from apps.commandes.models import Commande
from apps.commandes.statuts import Action, Statut

from .fabriques import creer_commande


def commande_a_corriger(il_y_a_jours, statut=Statut.A_CORRIGER, email="acheteur@test.ci"):
    commande = creer_commande(statut=statut, email=email)
    # Raccourci de test : en production, un statut ne change que via appliquer_transition.
    Commande.objects.filter(pk=commande.pk).update(
        date_decision=timezone.now() - timedelta(days=il_y_a_jours)
    )
    return commande


def statut(commande):
    return Commande.objects.values_list("statut", flat=True).get(pk=commande.pk)


class ClotureTests(TestCase):
    def lancer(self):
        sortie = StringIO()
        with self.captureOnCommitCallbacks(execute=True):
            call_command("cloturer_commandes", stdout=sortie)
        return sortie.getvalue()

    def test_cloture_seulement_les_bonnes_commandes(self):
        expiree = commande_a_corriger(8)
        recente = commande_a_corriger(6)
        validee_ancienne = commande_a_corriger(30, statut=Statut.VALIDEE)
        en_attente_ancienne = commande_a_corriger(30, statut=Statut.EN_ATTENTE)

        sortie = self.lancer()

        self.assertEqual(statut(expiree), Statut.CLOTUREE)
        self.assertEqual(statut(recente), Statut.A_CORRIGER)
        self.assertEqual(statut(validee_ancienne), Statut.VALIDEE)
        self.assertEqual(statut(en_attente_ancienne), Statut.EN_ATTENTE)
        self.assertIn("1 commande(s) clôturée(s), 0 erreur(s)", sortie)

    def test_historique_et_email(self):
        expiree = commande_a_corriger(8)

        self.lancer()

        evenement = expiree.evenements.get()
        self.assertEqual(evenement.action, Action.CLOTURER)
        self.assertEqual(evenement.statut_avant, Statut.A_CORRIGER)
        self.assertIsNone(evenement.auteur)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(expiree.code_suivi, mail.outbox[0].subject)

    def test_delai_lu_dans_les_parametres(self):
        parametres = ParametresVente.charger()
        parametres.delai_correction_jours = 3
        parametres.save()
        commande = commande_a_corriger(4)

        self.lancer()

        self.assertEqual(statut(commande), Statut.CLOTUREE)

    def test_rien_a_cloturer(self):
        self.assertIn("0 commande(s) clôturée(s)", self.lancer())

    def test_une_erreur_n_arrete_pas_les_autres(self):
        premiere = commande_a_corriger(10, email="a@test.ci")
        en_echec = commande_a_corriger(9, email="b@test.ci")
        derniere = commande_a_corriger(8, email="c@test.ci")
        vraie_transition = services.appliquer_transition

        def transition_qui_echoue(commande, action, **kwargs):
            if commande.pk == en_echec.pk:
                raise RuntimeError("panne simulée")
            return vraie_transition(commande, action, **kwargs)

        with (
            mock.patch.object(services, "appliquer_transition", side_effect=transition_qui_echoue),
            self.assertLogs("apps.commandes.services", level="ERROR") as journal,
            self.assertRaises(CommandError),
        ):
            self.lancer()

        self.assertEqual(statut(premiere), Statut.CLOTUREE)
        self.assertEqual(statut(en_echec), Statut.A_CORRIGER)
        self.assertEqual(statut(derniere), Statut.CLOTUREE)
        self.assertIn(f"commande id={en_echec.pk}", "\n".join(journal.output))
        self.assertNotIn("b@test.ci", "\n".join(journal.output))
