"""Tests de GET /api/v1/gestion/commandes/export/ (export CSV)."""

import csv
import io

from django.urls import reverse

from apps.commandes.models import Commande
from apps.commandes.services import COLONNES_EXPORT
from apps.commandes.statuts import Statut

from .fabriques import creer_commande
from .test_api import BaseAPITest


def ligne(taille="M", quantite=1, modele="LICENCE"):
    return dict(
        modele=modele,
        version="BRODE",
        manches="COURTES",
        taille=taille,
        quantite=quantite,
        prix_unitaire=8000,
    )


class ExportTests(BaseAPITest):
    url = reverse("gestion-export")

    def setUp(self):
        super().setUp()
        self.se_connecter()

    def exporter(self, **parametres):
        reponse = self.client.get(self.url, parametres)
        self.assertEqual(reponse.status_code, 200)
        return reponse, reponse.content.decode("utf-8-sig")

    def lignes_csv(self, texte):
        return list(csv.reader(io.StringIO(texte), delimiter=";"))

    def test_visiteur_non_connecte_401(self):
        self.client.credentials()
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_format_excel(self):
        creer_commande()
        reponse, _ = self.exporter()

        self.assertTrue(reponse.content.startswith("﻿".encode()), "BOM UTF-8 attendu pour Excel")
        self.assertTrue(reponse["Content-Type"].startswith("text/csv"))
        self.assertIn("attachment;", reponse["Content-Disposition"])
        self.assertIn(".csv", reponse["Content-Disposition"])

    def test_une_ligne_par_polo(self):
        commande = creer_commande(lignes=[ligne("M", 2), ligne("L", 1, modele="MASTER")])
        creer_commande(email="autre@test.ci")

        _, texte = self.exporter()
        lignes = self.lignes_csv(texte)

        self.assertEqual(lignes[0], COLONNES_EXPORT)
        self.assertEqual(len(lignes), 1 + 3)
        premiere = dict(zip(COLONNES_EXPORT, lignes[1], strict=True))
        self.assertEqual(premiere["Code de suivi"], commande.code_suivi)
        self.assertEqual(premiere["Modèle"], "Licence")
        self.assertEqual(premiere["Version"], "Brodé")
        self.assertEqual(premiere["Quantité"], "2")
        self.assertEqual(premiere["Prix de la ligne (FCFA)"], "16000")
        self.assertEqual(premiere["Montant total de la commande (FCFA)"], "24000")
        self.assertEqual(premiere["Numéro d'envoi"], "0700000000")
        self.assertEqual(premiere["Statut"], "En attente de vérification")

    def test_filtre_statut_respecte(self):
        validee = creer_commande(statut=Statut.VALIDEE)
        creer_commande(statut=Statut.EN_ATTENTE)
        creer_commande(statut=Statut.REFUSEE)

        _, texte = self.exporter(statut=Statut.VALIDEE)
        lignes = self.lignes_csv(texte)[1:]

        self.assertEqual([lg[0] for lg in lignes], [validee.code_suivi])

    def test_recherche_respectee(self):
        cible = creer_commande(email="cible@test.ci")
        creer_commande(email="autre@test.ci")

        _, texte = self.exporter(search="cible@")

        self.assertEqual([lg[0] for lg in self.lignes_csv(texte)[1:]], [cible.code_suivi])

    def test_filtre_taille_exporte_la_commande_entiere(self):
        """Comme dans la liste : le filtre choisit les commandes, toutes leurs lignes sont exportées."""
        creer_commande(lignes=[ligne("M", 1), ligne("XL", 1)])
        creer_commande(lignes=[ligne("S", 1)], email="autre@test.ci")

        _, texte = self.exporter(taille="XL")

        self.assertEqual(len(self.lignes_csv(texte)), 1 + 2)

    def test_export_vide_contient_l_entete(self):
        _, texte = self.exporter()
        self.assertEqual(self.lignes_csv(texte), [COLONNES_EXPORT])

    def test_injection_de_formule_neutralisee(self):
        commande = creer_commande()
        Commande.objects.filter(pk=commande.pk).update(prenoms='=HYPERLINK("http://pirate.test")')

        _, texte = self.exporter()

        prenoms = self.lignes_csv(texte)[1][COLONNES_EXPORT.index("Prénoms")]
        self.assertEqual(prenoms, '\'=HYPERLINK("http://pirate.test")')

    def test_point_virgule_dans_une_valeur(self):
        commande = creer_commande()
        commande.paiement.reference_transaction = "REF;123"
        commande.paiement.save()

        _, texte = self.exporter()

        reference = self.lignes_csv(texte)[1][COLONNES_EXPORT.index("Référence de transaction")]
        self.assertEqual(reference, "REF;123")

    def test_export_journalise_sans_donnee_personnelle(self):
        creer_commande(lignes=[ligne("M", 1), ligne("L", 1)])

        with self.assertLogs("apps.commandes.views", level="INFO") as journal:
            self.exporter()

        message = "\n".join(journal.output)
        self.assertIn(f"2 ligne(s) par utilisateur {self.tresoriere.pk}", message)
        self.assertNotIn("@", message)
