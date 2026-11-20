"""Tests des protections contre les abus : limites d'essais, admin, documentation."""

from importlib import reload

from django.conf import settings
from django.core.cache import cache, caches
from django.test import TestCase, override_settings
from django.urls import clear_url_caches, resolve, reverse

from apps.commandes.tests.fabriques import creer_admin
from apps.core.admin_securite import connexion_admin_limitee

MOT_DE_PASSE_ADMIN = "MotDePasse-Solide-123"


class IdentificationVisiteurTests(TestCase):
    """Un visiteur ne doit pas pouvoir contourner les limites en inventant son adresse IP."""

    def setUp(self):
        cache.clear()

    def connexion(self, **entetes):
        return self.client.post(
            reverse("auth-connexion"), {"email": "x@test.ci", "password": "faux"}, **entetes
        )

    def test_en_tete_x_forwarded_for_falsifie_ignore(self):
        codes = [self.connexion(HTTP_X_FORWARDED_FOR=f"10.0.0.{i}").status_code for i in range(6)]
        self.assertEqual(codes, [401] * 5 + [429])

    @override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, "NUM_PROXIES": 1})
    def test_derriere_un_proxy_seule_l_adresse_ajoutee_par_le_proxy_compte(self):
        # Le visiteur 1.1.1.1 invente le début de l'en-tête ; le proxy ajoute sa vraie adresse à la fin.
        codes = [self.connexion(HTTP_X_FORWARDED_FOR=f"10.0.0.{i}, 1.1.1.1").status_code for i in range(6)]
        self.assertEqual(codes, [401] * 5 + [429])
        # Un autre visiteur n'est pas bloqué.
        self.assertEqual(self.connexion(HTTP_X_FORWARDED_FOR="2.2.2.2").status_code, 401)


class CompteursPartagesTests(TestCase):
    def test_compteur_visible_depuis_un_autre_processus(self):
        cache.clear()
        self.client.post(reverse("auth-connexion"), {"email": "x@test.ci", "password": "faux"})

        # Une nouvelle instance du cache = ce que verrait un autre processus gunicorn.
        autre_processus = caches.create_connection("default")
        self.assertEqual(len(autre_processus.get("throttle_login_127.0.0.1", [])), 1)


class ConnexionAdminTests(TestCase):
    def setUp(self):
        cache.clear()
        self.url = reverse("admin:login")

    def essai(self, mot_de_passe="faux", **entetes):
        return self.client.post(self.url, {"username": "admin@test.ci", "password": mot_de_passe}, **entetes)

    def test_la_page_de_connexion_passe_par_la_limite(self):
        self.assertIs(resolve(self.url).func, connexion_admin_limitee)
        self.assertEqual(self.client.get(self.url).status_code, 200)

    def test_bloquee_apres_5_essais_meme_en_changeant_d_adresse(self):
        codes = [self.essai(HTTP_X_FORWARDED_FOR=f"10.0.0.{i}").status_code for i in range(6)]
        self.assertEqual(codes, [200] * 5 + [429])  # 200 = formulaire réaffiché avec l'erreur
        self.assertIn("Retry-After", self.essai())

    def test_bon_mot_de_passe_accepte(self):
        creer_admin(password=MOT_DE_PASSE_ADMIN)
        reponse = self.essai(MOT_DE_PASSE_ADMIN)
        self.assertEqual(reponse.status_code, 302)
        self.assertEqual(self.client.get(reverse("admin:index")).status_code, 200)


class DocumentationApiTests(TestCase):
    """Swagger et le schéma ne sont servis que si API_DOCS est activé (désactivé en production)."""

    def recharger_routes(self):
        import config.urls

        reload(config.urls)
        clear_url_caches()

    def tearDown(self):
        self.recharger_routes()  # remet les routes selon les réglages normaux

    def test_desactivee(self):
        with override_settings(API_DOCS=False):
            self.recharger_routes()
            self.assertEqual(self.client.get("/api/docs/").status_code, 404)
            self.assertEqual(self.client.get("/api/schema/").status_code, 404)

    def test_activee(self):
        with override_settings(API_DOCS=True):
            self.recharger_routes()
            self.assertEqual(self.client.get("/api/schema/").status_code, 200)
            self.assertEqual(self.client.get("/api/docs/").status_code, 200)
