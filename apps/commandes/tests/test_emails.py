"""Tests des emails automatiques envoyés à l'acheteur."""

import json
from unittest import mock

from django.core import mail
from django.test import override_settings
from django.urls import reverse

from apps.catalogue.models import ParametresVente
from apps.commandes.services import appliquer_transition, notifier_changement_statut
from apps.commandes.statuts import Action, MotifRefus, Statut

from .fabriques import creer_admin, creer_commande, fichier_png
from .test_api import BaseAPITest


@override_settings(FRONTEND_URL="https://polos.test", FRONTEND_ROUTE_SUIVI="/suivi")
class EmailsTests(BaseAPITest):
    def appliquer(self, commande, action, auteur=None, **kwargs):
        with self.captureOnCommitCallbacks(execute=True):
            appliquer_transition(commande, action, auteur=auteur, **kwargs)

    def dernier_email(self):
        self.assertEqual(len(mail.outbox), 1, [m.subject for m in mail.outbox])
        return mail.outbox[0]

    def version_html(self, email):
        self.assertEqual(len(email.alternatives), 1)
        contenu, type_mime = email.alternatives[0]
        self.assertEqual(type_mime, "text/html")
        return contenu

    # --- Accusé de réception -------------------------------------------------

    def test_accuse_de_reception_a_la_creation(self):
        donnees = {
            "nom": "Kouassi",
            "prenoms": "Jean",
            "email": "Jean@Test.ci",
            "email_confirmation": "jean@test.ci",
            "lignes": json.dumps(
                [
                    {
                        "modele": "LICENCE",
                        "version": "BRODE",
                        "manches": "COURTES",
                        "taille": "M",
                        "quantite": 2,
                    }
                ]
            ),
            "moyen_paiement": "WAVE",
            "numero_envoi": "0700000000",
            "capture": fichier_png(),
            "confirmation": True,
        }
        with self.captureOnCommitCallbacks(execute=True):
            reponse = self.client.post(reverse("commande-creation"), donnees, format="multipart")
        code = reponse.data["code_suivi"]

        email = self.dernier_email()
        self.assertEqual(email.subject, f"[{code}] Commande reçue")
        self.assertEqual(email.to, ["jean@test.ci"])
        self.assertIn("Bonjour Jean", email.body)
        self.assertIn("2 × Polo Licence brodé, manches courtes, taille M : 16 000 FCFA", email.body)
        self.assertIn("Montant total : 16 000 FCFA", email.body)
        self.assertIn(f"https://polos.test/suivi?code={code}", email.body)
        self.assertNotIn("jean@test.ci", email.body.split("https://")[1].split()[0])  # pas d'email dans l'URL

        html = self.version_html(email)
        self.assertIn("2 × Polo Licence brodé, manches courtes, taille M", html)
        self.assertIn("16 000 FCFA", html)
        self.assertIn(f'href="https://polos.test/suivi?code={code}"', html)
        self.assertIn("Suivre ma commande", html)

    def test_html_echappe_le_commentaire_de_la_tresoriere(self):
        commande = creer_commande()
        self.appliquer(
            commande,
            Action.REFUSER,
            auteur=self.tresoriere,
            motif=MotifRefus.AUTRE,
            commentaire='<script>alert("x")</script>\nDeuxième ligne',
        )
        email = self.dernier_email()
        html = self.version_html(email)

        self.assertNotIn("<script>", html)
        self.assertIn("&lt;script&gt;", html)
        self.assertIn("<br>Deuxième ligne", html)
        self.assertIn('<script>alert("x")</script>', email.body)  # le texte brut reste lisible tel quel

    # --- Une email par transition --------------------------------------------

    def test_chaque_transition_envoie_le_bon_email(self):
        cas = [
            (Statut.EN_ATTENTE, Action.VALIDER, {}, "Commande validée"),
            (Statut.EN_ATTENTE, Action.REFUSER, {"motif": MotifRefus.DOUBLON}, "Commande refusée"),
            (
                Statut.EN_ATTENTE,
                Action.DEMANDER_COMPLEMENT,
                {"motif": MotifRefus.CAPTURE_ILLISIBLE},
                "Action requise : complément demandé",
            ),
            (Statut.VALIDEE, Action.MARQUER_DISPONIBLE, {}, "Votre polo est disponible"),
            (Statut.POLO_DISPONIBLE, Action.MARQUER_REMIS, {}, "Polos remis"),
            (Statut.A_CORRIGER, Action.RENVOYER_CAPTURE, {"auteur": None}, "Nouvelle capture reçue"),
            (Statut.A_CORRIGER, Action.CLOTURER, {"auteur": None}, "Commande clôturée"),
        ]
        for statut, action, options, sujet in cas:
            with self.subTest(action=action):
                mail.outbox.clear()
                commande = creer_commande(statut=statut, email=f"{action.lower()}@test.ci")
                auteur = options.pop("auteur", self.tresoriere)
                self.appliquer(commande, action, auteur=auteur, **options)

                email = self.dernier_email()
                self.assertEqual(email.subject, f"[{commande.code_suivi}] {sujet}")
                self.assertEqual(email.to, [commande.email])
                self.assertNotIn("{{", email.body)
                self.assertNotIn("&#x27;", email.body)  # pas d'échappement HTML dans du texte

                html = self.version_html(email)
                self.assertIn(f"<title>[{commande.code_suivi}] {sujet}</title>", html)
                self.assertIn(commande.code_suivi, html)
                self.assertNotIn("{{", html)
                self.assertNotIn("{%", html)

    def test_annulation_de_decision_sans_email(self):
        commande = creer_commande(statut=Statut.VALIDEE)
        self.appliquer(commande, Action.ANNULER_DECISION, auteur=creer_admin(), motif=MotifRefus.AUTRE)
        self.assertEqual(mail.outbox, [])

    # --- Contenu -------------------------------------------------------------

    def test_complement_contient_motif_commentaire_et_date_limite(self):
        commande = creer_commande()
        self.appliquer(
            commande,
            Action.DEMANDER_COMPLEMENT,
            auteur=self.tresoriere,
            motif=MotifRefus.MONTANT_INSUFFISANT,
            commentaire="Il manque 2 000 FCFA.",
        )
        commande.refresh_from_db()

        corps = self.dernier_email().body
        self.assertIn("Motif : Montant insuffisant", corps)
        self.assertIn("Il manque 2 000 FCFA.", corps)
        self.assertIn("nouvelle capture", corps)
        self.assertRegex(corps, r"jusqu'au \d{2}/\d{2}/\d{4} à \d{2}h\d{2}")

    def test_polo_disponible_contient_le_retrait(self):
        parametres = ParametresVente.charger()
        parametres.lieu_retrait = "Bureau du BDE"
        parametres.horaires_retrait = "12 h - 14 h"
        parametres.contact_retrait = "0102030405"
        parametres.save()
        commande = creer_commande(statut=Statut.VALIDEE)

        self.appliquer(commande, Action.MARQUER_DISPONIBLE, auteur=self.tresoriere)

        corps = self.dernier_email().body
        self.assertIn("Lieu : Bureau du BDE", corps)
        self.assertIn("Horaires : 12 h - 14 h", corps)
        self.assertIn("Contact : 0102030405", corps)
        self.assertIn(commande.code_suivi, corps)

    def test_refus_contient_motif_et_lien_vers_le_site(self):
        commande = creer_commande()
        self.appliquer(
            commande, Action.REFUSER, auteur=self.tresoriere, motif=MotifRefus.PAIEMENT_INTROUVABLE
        )

        corps = self.dernier_email().body
        self.assertIn("Motif : Paiement introuvable", corps)
        self.assertIn("https://polos.test", corps)

    # --- Pannes --------------------------------------------------------------

    @mock.patch("apps.commandes.services.time.sleep")
    @mock.patch("apps.commandes.services.send_mail", side_effect=OSError("smtp acheteur@test.ci refusé"))
    def test_trois_essais_puis_log_sans_email(self, send_mail, _sleep):
        commande = creer_commande(email="acheteur@test.ci")

        with self.assertLogs("apps.commandes.services", level="ERROR") as logs:
            notifier_changement_statut(commande.pk, Action.VALIDER)  # ne lève pas d'exception

        self.assertEqual(send_mail.call_count, 3)
        self.assertIn(f"commande id={commande.pk}", logs.output[0])
        self.assertNotIn("acheteur@test.ci", "\n".join(logs.output))

    @mock.patch("apps.commandes.services.time.sleep")
    def test_reussite_au_deuxieme_essai(self, _sleep):
        commande = creer_commande()
        with mock.patch("apps.commandes.services.send_mail", side_effect=[OSError(), 1]) as send_mail:
            notifier_changement_statut(commande.pk, Action.VALIDER)
        self.assertEqual(send_mail.call_count, 2)

    def test_commande_inexistante_sans_exception(self):
        with self.assertLogs("apps.commandes.services", level="ERROR"):
            notifier_changement_statut(999999, Action.VALIDER)
        self.assertEqual(mail.outbox, [])

    def test_action_deduite_du_dernier_evenement(self):
        commande = creer_commande()
        with self.captureOnCommitCallbacks(execute=False):
            appliquer_transition(commande, Action.VALIDER, auteur=self.tresoriere)

        notifier_changement_statut(commande.pk)  # sans action : lue dans l'historique

        self.assertEqual(self.dernier_email().subject, f"[{commande.code_suivi}] Commande validée")
