# Polo ESATIC : back-end

API Django de l'application de vente de polos de l'ESATIC.

L'acheteur commande sans compte, paie hors du site par mobile money (Wave, Orange Money, MTN Money, Moov Money) et joint la capture de son dépôt. Une trésorière vérifie le paiement puis valide ou refuse la commande. Aucune commande n'est validée sans preuve de paiement vérifiée par un humain.

> 📋 **Ce qui est fait et ce qui reste à faire : [docs/ETAT_AVANCEMENT.md](docs/ETAT_AVANCEMENT.md)**

**Stack** : Python 3.12+ · Django 6.1 · Django REST Framework · PostgreSQL 16+ · JWT (simplejwt) · Swagger (drf-spectacular)

---

## Démarrer en local (environ 5 minutes)

Prérequis : Python 3.12 ou plus, Git, et PostgreSQL 16 ou plus installé sur la machine (ou Docker, voir plus bas).

```bash
# 1. Cloner le dépôt
git clone https://github.com/Romeo-Kouame/Polo-Esatic.git
cd Polo-Esatic

# 2. Environnement virtuel
python -m venv .venv
# Windows (PowerShell) :  .venv\Scripts\Activate.ps1
# Windows (Git Bash)   :  source .venv/Scripts/activate
# macOS / Linux        :  source .venv/bin/activate
pip install -r requirements-dev.txt

# 3. Variables d'environnement
cp .env.example .env
# puis remplacer SECRET_KEY dans .env (la commande pour en générer une est dans le fichier)

# 4. Base PostgreSQL : créer l'utilisateur et la base du projet (une seule fois)
psql -U postgres -c "CREATE ROLE polo LOGIN PASSWORD 'polo_dev_password' CREATEDB;"
psql -U postgres -c "CREATE DATABASE polo_esatic OWNER polo;"
# (CREATEDB est nécessaire : les tests créent une base temporaire)

# 5. Tables + données initiales (les 8 tarifs)
python manage.py migrate

# 6. Compte administrateur
python manage.py createsuperuser

# 7. Lancer le serveur
python manage.py runserver
```

| URL | Contenu |
|---|---|
| http://localhost:8000/api/docs/ | **Documentation interactive de l'API (Swagger)** |
| http://localhost:8000/admin/ | Administration Django (tarifs, stocks, numéros de dépôt, comptes) |
| http://localhost:8000/api/v1/sante/ | Vérifie que l'API et la base répondent |

> **`psql` introuvable sous Windows ?** Il se trouve dans `C:\Program Files\PostgreSQL\<version>\bin\psql.exe`. Vous pouvez aussi créer l'utilisateur et la base depuis pgAdmin.
>
> **Pas de PostgreSQL installé ?** Avec Docker Desktop, `docker compose up -d` lance une base déjà configurée sur le port **5433**. Remplacez alors `5432` par `5433` dans `DATABASE_URL` (fichier `.env`), et sautez l'étape 4.
>
> **Projet dans OneDrive, Google Drive ou Dropbox ?** La synchronisation peut verrouiller des fichiers et casser l'environnement virtuel. Mieux vaut cloner le projet dans un dossier non synchronisé.

### Commandes utiles

```bash
python manage.py test            # lancer les tests
ruff check . && ruff format .    # vérifier et formater le code
python manage.py makemigrations  # après une modification de models.py
python manage.py spectacular --file docs/openapi.yaml   # régénérer le contrat d'API
```

---

## Organisation du code

```
config/                 réglages Django (settings.py lit le .env) et routes (urls.py)
apps/
  core/                 éléments partagés : erreurs, permissions, validation des captures, stockage privé
  accounts/             comptes trésorières / administrateur (connexion par email, JWT)
  catalogue/            tarifs, stocks, numéros de dépôt, paramètres de vente
  commandes/
    statuts.py          ⭐ cycle de vie : statuts, actions, transitions autorisées
    services.py         ⭐ logique métier (appliquer_transition, code de suivi, stock)
    models.py           Commande, LigneCommande, Paiement, Capture, Evenement
    serializers.py      ⭐ contrat d'API (ce que le front envoie et reçoit)
    views.py            endpoints (minces : ils valident puis appellent services.py)
    filters.py          filtres de la liste des commandes
    tests/              tests + fabriques de données (fabriques.py)
docs/openapi.yaml       contrat d'API exporté, pour le front
```

### Règles à respecter

1. **Un statut ne se change jamais à la main.** Tout passe par `services.appliquer_transition()`. Cette fonction vérifie le rôle, le statut de départ et le motif, puis écrit l'historique.
2. **Les prix sont calculés par le serveur** avec `catalogue.services.prix_unitaire()`. Un prix envoyé par le front est toujours ignoré.
3. **Les vues restent minces.** La logique va dans `services.py`, pas dans `views.py`.
4. **Les captures sont privées.** Elles ne sont jamais servies par une URL publique, uniquement par la vue authentifiée `gestion/commandes/{id}/capture/`.
5. **Aucune suppression de commande.** Tout reste dans l'historique.
6. **Modifier un serializer, c'est modifier le contrat avec le front.** Prévenez l'équipe front et régénérez `docs/openapi.yaml`.
7. **Aucune donnée personnelle dans les logs** (email, téléphone, nom).

---

## Cycle de vie d'une commande

```
EN_ATTENTE ──valider──────────────▶ VALIDEE ──marquer-disponible──▶ POLO_DISPONIBLE
    │  │                              │                                   │
    │  └─demander-complement─▶ A_CORRIGER   └────────marquer-remis─────────┴──▶ REMIS
    │                          │   │
    │   ◀──renvoi de capture───┘   └─ 7 jours sans réponse ─▶ CLOTUREE
    └──refuser──▶ REFUSEE

VALIDEE / POLO_DISPONIBLE ──annuler-decision (admin)──▶ EN_ATTENTE
Statuts finaux : REMIS, REFUSEE, CLOTUREE
```

Le motif est obligatoire pour refuser, demander un complément et annuler une décision. Le stock est réservé à la validation, pas à la soumission. Si le stock est insuffisant, la validation est bloquée (erreur 409).

---

## Endpoints

Tous préfixés par `/api/v1/`. Le détail des champs se trouve dans Swagger (`/api/docs/`) ou dans `docs/openapi.yaml`.

**État** : ✅ codé et testé (tous les endpoints)

### Public (sans compte)

| Méthode | Route | Rôle | État |
|---|---|---|---|
| GET | `catalogue/` | Tarifs, tailles, disponibilités, numéros de dépôt, ventes ouvertes ou non | ✅ |
| POST | `commandes/` | Passer une commande (multipart, avec la capture) | ✅ |
| POST | `suivi/` | Suivre sa commande (code de suivi **+ email**) | ✅ |
| POST | `suivi/capture/` | Renvoyer une capture quand la commande est « À corriger » | ✅ |
| GET | `sante/` | État du service | ✅ |

### Authentification (trésorières / administrateur)

| Méthode | Route | Rôle | État |
|---|---|---|---|
| POST | `auth/connexion/` | `{email, password}` → `{access, refresh}` | ✅ |
| POST | `auth/rafraichir/` | `{refresh}` → nouveaux jetons | ✅ |
| POST | `auth/deconnexion/` | `{refresh}` → invalide le jeton | ✅ |
| GET | `auth/moi/` | Profil et rôle de l'utilisateur connecté | ✅ |

Il faut envoyer l'en-tête `Authorization: Bearer <access>` sur toutes les routes `gestion/`.

### Gestion

| Méthode | Route | Rôle | État |
|---|---|---|---|
| GET | `gestion/commandes/` | Liste paginée, filtres, recherche | ✅ |
| GET | `gestion/commandes/{id}/` | Fiche complète + alertes + historique | ✅ |
| PATCH | `gestion/commandes/{id}/` | Modifier la note interne | ✅ |
| GET | `gestion/commandes/{id}/capture/` | Télécharger la capture | ✅ |
| POST | `gestion/commandes/{id}/valider/` | Valider | ✅ |
| POST | `gestion/commandes/{id}/refuser/` | Refuser (`motif` obligatoire) | ✅ |
| POST | `gestion/commandes/{id}/demander-complement/` | Passer en « À corriger » (`motif` obligatoire) | ✅ |
| POST | `gestion/commandes/{id}/marquer-disponible/` | Polo prêt | ✅ |
| POST | `gestion/commandes/{id}/marquer-remis/` | Polos remis | ✅ |
| POST | `gestion/commandes/{id}/annuler-decision/` | Admin uniquement (`motif` obligatoire) | ✅ |
| GET | `gestion/commandes/export/` | Export CSV (mêmes filtres que la liste) | ✅ |
| GET | `gestion/tableau-de-bord/` | Compteurs, montants, stocks | ✅ |

Filtres de la liste : `statut`, `moyen_paiement`, `modele`, `version`, `manches`, `taille`, `date_min`, `date_max`, `search` (code, nom, prénoms, email, numéro, référence), `ordering`, `page`.

### Autres travaux back-end restants (hors endpoints)

- ~~Envoi des emails à chaque changement de statut~~ ✅ fait (`services.notifier_changement_statut`, gabarits dans `templates/emails/`).
- Clôture automatique des commandes « À corriger » après 7 jours (commande de gestion à lancer chaque jour).
- Détection des doublons (même empreinte de capture, même référence de transaction) pour les alertes de la fiche.

### Format des erreurs

Toutes les erreurs ont la même forme :

```json
{ "detail": "Certaines informations sont invalides.", "code": "validation", "erreurs": { "email": ["..."] } }
```

| HTTP | `code` | Quand |
|---|---|---|
| 400 | `validation` | Champ invalide (`erreurs` contient le détail par champ) |
| 401 | `not_authenticated` / `authentication_failed` | Pas connecté ou identifiants faux |
| 403 | `permission_denied` / `ventes_fermees` | Rôle insuffisant / ventes fermées |
| 404 | `not_found` | Commande introuvable |
| 409 | `transition_interdite` / `stock_insuffisant` | Action impossible dans l'état actuel |
| 429 | `throttled` | Trop de requêtes |

---

## Mise en production

Voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) : `.env` de production, commandes de déploiement (gunicorn, whitenoise), tâche planifiée `cloturer_commandes`, vérifications.

---

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) : branches, commits, Pull Requests.
