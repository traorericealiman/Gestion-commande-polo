# Mettre le back-end en production

Ce guide vaut pour n'importe quel hébergeur Python (un VPS, ou une plateforme comme Render, Railway ou Fly.io). Le code est prêt. Il reste à **choisir l'hébergeur** et à **remplir le `.env` de production**.

## 1. Ce dont l'hébergeur doit disposer

| Besoin | Pourquoi |
|---|---|
| Python 3.12 ou plus | Version du projet |
| PostgreSQL | Base de données |
| HTTPS | Obligatoire : les trésorières envoient un mot de passe et des jetons |
| **Disque persistant** | Les captures de paiement (`PRIVATE_MEDIA_ROOT`). Sur une plateforme sans disque persistant, elles disparaîtraient à chaque redémarrage. |
| Tâche planifiée (cron) | Clôture automatique, une fois par jour |
| Serveur SMTP | Emails aux acheteurs |

## 2. Le `.env` de production

À créer **sur le serveur** (ou dans les variables d'environnement de la plateforme). Ne jamais le commiter.

```ini
DEBUG=False
# Générer : python -c "import secrets; print(secrets.token_urlsafe(50))"
SECRET_KEY=<clé longue et aléatoire, différente de celle de dev>
ALLOWED_HOSTS=api.polos-esatic.ci

DATABASE_URL=postgres://<utilisateur>:<mot de passe>@<hôte>:5432/<base>

# Domaine du front React
CORS_ALLOWED_ORIGINS=https://polos-esatic.ci
CSRF_TRUSTED_ORIGINS=https://api.polos-esatic.ci
FRONTEND_URL=https://polos-esatic.ci
FRONTEND_ROUTE_SUIVI=/suivi
FRONTEND_ROUTE_REINITIALISATION=/reinitialiser-mot-de-passe

# Dossier sur le disque persistant, hors de tout dossier servi publiquement
PRIVATE_MEDIA_ROOT=/var/lib/polo-esatic/captures

EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=<smtp du fournisseur>
EMAIL_PORT=587
EMAIL_HOST_USER=<identifiant>
EMAIL_HOST_PASSWORD=<mot de passe>
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=Polos ESATIC <no-reply@polos-esatic.ci>

# Sécurité
# Nombre de proxys devant l'API : 1 sur une plateforme (Render, Railway, Fly.io)
# ou derrière un nginx ; 0 si gunicorn reçoit directement les visiteurs.
NUM_PROXIES=1
# Adresse secrète de l'administration (ne pas laisser admin/)
ADMIN_URL=<mot-difficile-a-deviner>/

LOG_LEVEL=INFO
```

Avec `DEBUG=False`, le projet active automatiquement : redirection HTTPS, cookies sécurisés, HSTS, pages d'erreur sans détail technique, et **Swagger désactivé** (`/api/docs/` et `/api/schema/` répondent 404 ; le front utilise `docs/openapi.yaml`).

**`NUM_PROXIES` doit correspondre à la réalité.** Trop petit (0 derrière un proxy) : tous les visiteurs ont l'adresse du proxy et se bloquent entre eux. Trop grand : un visiteur peut inventer son adresse et contourner les limites d'essais. Pour vérifier après le déploiement : 6 connexions ratées de suite doivent donner `429` à la 6ᵉ, et un autre appareil doit pouvoir se connecter.

**Taille des requêtes** : configurer aussi une taille maximale de requête d'environ 6 Mo au niveau du serveur web ou de la plateforme (ex. `client_max_body_size 6m;` avec nginx). Django vérifie la limite de 5 Mo des captures, mais seulement après avoir reçu le fichier.

## 3. Commandes de déploiement

À lancer à chaque mise en production :

```bash
pip install -r requirements.txt
python manage.py check --deploy        # doit répondre « no issues »
python manage.py migrate
python manage.py collectstatic --noinput
```

Commande de démarrage du serveur web :

```bash
gunicorn config.wsgi --bind 0.0.0.0:${PORT:-8000} --workers 3 --timeout 30
```

Le premier déploiement demande aussi de créer le compte administrateur. Il crée ensuite les comptes des trésorières, les stocks, les numéros de dépôt et les paramètres de vente dans `/admin/` :

```bash
python manage.py createsuperuser
```

## 4. Tâche planifiée : clôture automatique

Une fois par jour, par exemple à 3 h :

```cron
0 3 * * * cd /srv/polo-esatic && .venv/bin/python manage.py cloturer_commandes
```

En cas d'erreur, la commande se termine avec un code non nul, et les détails sont dans les logs (ids uniquement).

## 5. Vérifier que tout marche

1. `https://<domaine>/api/v1/sante/` répond `{"statut": "ok"}`.
2. `http://<domaine>/api/v1/catalogue/` redirige vers `https://`.
3. `/admin/` s'affiche avec ses styles (preuve que les fichiers statiques sont servis).
4. Une commande de test passe, et l'accusé de réception arrive.

## 6. Après la mise en ligne

- **Surveillance** : brancher `/api/v1/sante/` sur un outil gratuit (UptimeRobot, Better Stack…). Il répond 503 si la base ne répond plus.
- **Sauvegardes** : `pg_dump` quotidien de la base **et** copie du dossier `PRIVATE_MEDIA_ROOT`, puis un test de restauration au moins une fois.
- **Préchargement HSTS** (`SECURE_HSTS_PRELOAD`) : volontairement non activé, car difficile à annuler. À décider une fois le domaine définitif.
