"""Tests de la réinitialisation du mot de passe par email."""

import re
from unittest import mock
from urllib.parse import parse_qs, urlparse

from django.core import mail
from django.test import override_settings
from django.urls import reverse

from apps.commandes.tests.fabriques import creer_tresoriere
from apps.commandes.tests.test_api import MOT_DE_PASSE, BaseAPITest

NOUVEAU = "Nouveau-MotDePasse-456"


@override_settings(FRONTEND_URL="https://polos.test", FRONTEND_ROUTE_REINITIALISATION="/reinitialiser")
class ReinitialisationMotDePasseTests(BaseAPITest):
    def demander(self, email):
        return self.client.post(reverse("auth-mot-de-passe-oubli"), {"email": email})

    def lien_recu(self):
        self.assertEqual(len(mail.outbox), 1)
        lien = re.search(r"https://polos\.test/reinitialiser\?\S+", mail.outbox[0].body).group(0)
        parametres = parse_qs(urlparse(lien).query)
        return {"uid": parametres["uid"][0], "token": parametres["token"][0]}

    def reinitialiser(self, lien, mot_de_passe=NOUVEAU):
        return self.client.post(
            reverse("auth-mot-de-passe-reinitialiser"), {**lien, "mot_de_passe": mot_de_passe}
        )

    def connexion(self, mot_de_passe):
        return self.client.post(
            reverse("auth-connexion"), {"email": self.tresoriere.email, "password": mot_de_passe}
        )

    # --- Demande -------------------------------------------------------------

    def test_demande_envoie_un_email_avec_le_lien(self):
        reponse = self.demander("  Tresoriere@Test.CI ")

        self.assertEqual(reponse.status_code, 204)
        email = mail.outbox[0]
        self.assertEqual(email.to, [self.tresoriere.email])
        self.assertEqual(email.subject, "Réinitialisation de votre mot de passe")
        self.assertIn("Bonjour Awa", email.body)
        self.assertIn("expire dans 1 heure", email.body)
        self.assertNotIn(self.tresoriere.email, email.body)  # pas d'email dans le lien
        html = email.alternatives[0][0]
        self.assertIn('href="https://polos.test/reinitialiser?uid=', html)
        self.assertNotIn("Code de suivi", html)
        self.lien_recu()

    def test_meme_reponse_si_email_inconnu_ou_compte_desactive(self):
        connu = self.demander(self.tresoriere.email)
        mail.outbox.clear()
        desactivee = creer_tresoriere(email="partie@test.ci")
        desactivee.is_active = False
        desactivee.save()

        inconnu = self.demander("inconnu@test.ci")
        inactif = self.demander("partie@test.ci")

        self.assertEqual((connu.status_code, inconnu.status_code, inactif.status_code), (204, 204, 204))
        self.assertEqual(connu.data, inconnu.data)
        self.assertEqual(mail.outbox, [])

    def test_email_invalide_400(self):
        self.assertEqual(self.demander("pas-un-email").status_code, 400)

    @mock.patch("apps.accounts.services.send_mail", side_effect=OSError("smtp tresoriere@test.ci"))
    def test_panne_smtp_sans_erreur_ni_email_dans_les_logs(self, _send_mail):
        with self.assertLogs("apps.accounts.services", level="ERROR") as logs:
            reponse = self.demander(self.tresoriere.email)
        self.assertEqual(reponse.status_code, 204)
        self.assertNotIn(self.tresoriere.email, "\n".join(logs.output))

    def test_limite_de_demandes(self):
        codes = [self.demander("inconnu@test.ci").status_code for _ in range(6)]
        self.assertEqual(codes[:5], [204] * 5)
        self.assertEqual(codes[5], 429)

    # --- Nouveau mot de passe ------------------------------------------------

    def test_reinitialisation_complete(self):
        self.demander(self.tresoriere.email)
        reponse = self.reinitialiser(self.lien_recu())

        self.assertEqual(reponse.status_code, 204)
        self.assertEqual(self.connexion(MOT_DE_PASSE).status_code, 401)
        self.assertEqual(self.connexion(NOUVEAU).status_code, 200)

    def test_lien_utilisable_une_seule_fois(self):
        self.demander(self.tresoriere.email)
        lien = self.lien_recu()
        self.assertEqual(self.reinitialiser(lien).status_code, 204)

        reponse = self.reinitialiser(lien, "Encore-Un-Autre-789")
        self.assertEqual(reponse.status_code, 400)
        self.assertIn("token", reponse.data["erreurs"])

    def test_lien_expire(self):
        self.demander(self.tresoriere.email)
        lien = self.lien_recu()
        with override_settings(PASSWORD_RESET_TIMEOUT=-1):
            reponse = self.reinitialiser(lien)
        self.assertEqual(reponse.status_code, 400)
        self.assertIn("token", reponse.data["erreurs"])

    def test_lien_falsifie(self):
        self.demander(self.tresoriere.email)
        lien = self.lien_recu()
        for faux in ({**lien, "token": "abc-123"}, {**lien, "uid": "xx"}, {**lien, "uid": "OTk5OTk"}):
            with self.subTest(faux=faux):
                reponse = self.reinitialiser(faux)
                self.assertEqual(reponse.status_code, 400)
                self.assertIn("token", reponse.data["erreurs"])

    def test_mot_de_passe_trop_faible_refuse(self):
        self.demander(self.tresoriere.email)
        reponse = self.reinitialiser(self.lien_recu(), "123456")

        self.assertEqual(reponse.status_code, 400)
        self.assertIn("mot_de_passe", reponse.data["erreurs"])
        self.assertEqual(self.connexion(MOT_DE_PASSE).status_code, 200)  # ancien mot de passe intact

    def test_les_sessions_ouvertes_sont_fermees(self):
        refresh = self.connexion(MOT_DE_PASSE).data["refresh"]
        self.demander(self.tresoriere.email)
        self.reinitialiser(self.lien_recu())

        reponse = self.client.post(reverse("auth-rafraichir"), {"refresh": refresh})
        self.assertEqual(reponse.status_code, 401)
