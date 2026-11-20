"""Cycle de vie des commandes (services.appliquer_transition)."""

from django.test import TestCase
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.catalogue.models import Stock
from apps.commandes.models import Evenement
from apps.commandes.services import StockInsuffisant, appliquer_transition
from apps.commandes.statuts import Action, Statut
from apps.core.exceptions import TransitionInterdite

from .fabriques import creer_admin, creer_commande, creer_tresoriere


class TransitionsTests(TestCase):
    def setUp(self):
        self.tresoriere = creer_tresoriere()
        self.admin = creer_admin()

    def test_valider_une_commande_en_attente(self):
        commande = creer_commande()
        commande = appliquer_transition(commande, Action.VALIDER, auteur=self.tresoriere)
        self.assertEqual(commande.statut, Statut.VALIDEE)
        self.assertIsNotNone(commande.date_decision)
        evenement = Evenement.objects.get(commande=commande)
        self.assertEqual(evenement.auteur, self.tresoriere)
        self.assertEqual(evenement.statut_avant, Statut.EN_ATTENTE)

    def test_refus_sans_motif_interdit(self):
        with self.assertRaises(ValidationError):
            appliquer_transition(creer_commande(), Action.REFUSER, auteur=self.tresoriere)

    def test_refus_avec_motif(self):
        commande = appliquer_transition(
            creer_commande(),
            Action.REFUSER,
            auteur=self.tresoriere,
            motif="CAPTURE_ILLISIBLE",
            commentaire="Floue",
        )
        self.assertEqual(commande.statut, Statut.REFUSEE)
        self.assertEqual(commande.motif, "CAPTURE_ILLISIBLE")

    def test_statut_final_bloque(self):
        commande = creer_commande(statut=Statut.REFUSEE)
        with self.assertRaises(TransitionInterdite):
            appliquer_transition(commande, Action.VALIDER, auteur=self.tresoriere)

    def test_acheteur_ne_peut_pas_valider(self):
        with self.assertRaises(PermissionDenied):
            appliquer_transition(creer_commande(), Action.VALIDER, auteur=None)

    def test_annulation_reservee_admin(self):
        commande = creer_commande(statut=Statut.VALIDEE)
        with self.assertRaises(PermissionDenied):
            appliquer_transition(commande, Action.ANNULER_DECISION, auteur=self.tresoriere, motif="AUTRE")
        commande = appliquer_transition(commande, Action.ANNULER_DECISION, auteur=self.admin, motif="AUTRE")
        self.assertEqual(commande.statut, Statut.EN_ATTENTE)

    def test_parcours_complet(self):
        commande = creer_commande()
        for action in (Action.VALIDER, Action.MARQUER_DISPONIBLE, Action.MARQUER_REMIS):
            commande = appliquer_transition(commande, action, auteur=self.tresoriere)
        self.assertEqual(commande.statut, Statut.REMIS)
        self.assertEqual(commande.remis_par, self.tresoriere)
        self.assertEqual(commande.evenements.count(), 3)

    def test_renvoi_capture_par_acheteur(self):
        commande = appliquer_transition(
            creer_commande(), Action.DEMANDER_COMPLEMENT, auteur=self.tresoriere, motif="CAPTURE_ILLISIBLE"
        )
        commande = appliquer_transition(commande, Action.RENVOYER_CAPTURE)
        self.assertEqual(commande.statut, Statut.EN_ATTENTE)
        self.assertEqual(commande.motif, "")

    def test_validation_bloquee_si_stock_insuffisant(self):
        Stock.objects.create(modele="LICENCE", version="BRODE", manches="COURTES", taille="M", quantite_max=1)
        appliquer_transition(creer_commande(), Action.VALIDER, auteur=self.tresoriere)
        with self.assertRaises(StockInsuffisant):
            appliquer_transition(
                creer_commande(email="autre@test.ci"), Action.VALIDER, auteur=self.tresoriere
            )
