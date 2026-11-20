# État d'avancement du back-end

> Dernière mise à jour : **20 novembre 2026**
> À lire avant de prendre une tâche. Mettez ce fichier à jour dans votre Pull Request quand vous terminez quelque chose.

Ce document dit **ce qui est déjà fait**, **ce qui reste à faire** et les décisions prises. Il ne dit pas *qui* fait quoi : la répartition est gérée à part.

Pour installer le projet, lisez le [README](../README.md). Pour les branches, commits et Pull Requests, lisez [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## 1. Vue d'ensemble

| Domaine | État |
|---|---|
| Installation, configuration `.env`, PostgreSQL | ✅ Fait |
| Modèles de données et migrations | ✅ Fait |
| Cycle de vie des commandes (statuts, transitions, historique) | ✅ Fait et testé |
| Contrat d'API complet (Swagger + `docs/openapi.yaml`) | ✅ Fait |
| Authentification des trésorières (JWT) | ✅ Fait et testé |
| Mot de passe oublié (réinitialisation par email) | ✅ Fait et testé |
| Catalogue public | ✅ Fait et testé |
| Liste des commandes + 6 actions de gestion | ✅ Fait et testé |
| Passer une commande | ✅ Fait et testé |
| Suivi de commande | ✅ Fait et testé |
| Renvoi de capture | ✅ Fait et testé |
| Fiche d'une commande (avec alertes) + note interne | ✅ Fait et testé |
| Téléchargement de la capture | ✅ Fait et testé |
| Tableau de bord | ✅ Fait et testé |
| Export CSV | ✅ Fait et testé |
| Emails automatiques | ✅ Fait et testé (texte + HTML) |
| Clôture automatique après 7 jours | ✅ Fait et testé |
| Mise en production | 🟡 Code prêt ([DEPLOIEMENT.md](DEPLOIEMENT.md)) : reste l'hébergeur, le `.env` de production et le déploiement |

**Plus aucun endpoint ne renvoie `501`.** Tout le contrat d'API visible dans Swagger est codé et testé.

---

## 2. Ce qui est déjà fait (en détail)

### 2.1 Socle technique
- Django 6.1, Django REST Framework, configuration lue dans `.env` ([config/settings.py](../config/settings.py)).
- PostgreSQL. La base de dev s'appelle `polo_esatic`, l'utilisateur `polo`. Docker est en option.
- Documentation interactive sur `/api/docs/` (en développement seulement, voir 2.5), contrat exporté dans [docs/openapi.yaml](openapi.yaml).
- Format d'erreur unique pour toute l'API : `{detail, code, erreurs?}` ([apps/core/exceptions.py](../apps/core/exceptions.py)). Une erreur inattendue renvoie un message générique, et le détail technique part dans les logs serveur.
- Limitation du nombre de requêtes :
  - connexion : 5 par minute ;
  - envoi de commande : 10 par heure ;
  - suivi : 30 par minute ;
  - mot de passe oublié et réinitialisation : 5 par heure ;
  - connexion à l'admin Django : 5 par minute.

  Les seuils se règlent dans le `.env`. Le visiteur est identifié par son adresse IP réelle (`NUM_PROXIES`, voir 2.5) et les compteurs sont partagés entre les processus du serveur (cache fichier).
- Linter `ruff`, CI GitHub Actions (lint, migrations, schéma, tests), modèle de Pull Request.
- Production : `gunicorn` (serveur web), `whitenoise` (fichiers statiques de `/admin/` et Swagger), `check --deploy` sans problème.

### 2.2 Données ([models.py](../apps/commandes/models.py), [catalogue/models.py](../apps/catalogue/models.py), [accounts/models.py](../apps/accounts/models.py))

| Modèle | Contenu |
|---|---|
| `User` | Connexion par **email**. `role` = `TRESORIERE` ou `ADMIN`. Les acheteurs n'ont pas de compte. |
| `Tarif` | Prix par modèle × version × manches. **Les 8 tarifs du cahier des charges sont chargés par la migration.** |
| `Stock` | Quantité max par modèle × version × manches × taille. Pas de ligne = pas de limite. |
| `NumeroDepot` | Numéros mobile money où l'acheteur fait son dépôt (actif ou non). |
| `ParametresVente` | Ligne unique (`ParametresVente.charger()`) : dates d'ouverture et de clôture, quantité max par ligne, lieu, horaires et contact de retrait, délai avant clôture (7 jours). |
| `Commande` | Identité, montant total figé, statut, motif et commentaire de la dernière décision, note interne, dates. |
| `LigneCommande` | Un polo (modèle, version, manches, taille, quantité, prix unitaire figé). Une commande a 1 ligne ou plus. |
| `Paiement` | Moyen, numéro d'envoi, référence de transaction (1 par commande). |
| `Capture` | Fichier **privé**, empreinte SHA-256, type, taille. Plusieurs par commande possibles ; `commande.capture_actuelle` = la plus récente. |
| `Evenement` | Historique : action, statut avant et après, auteur (vide = acheteur ou système), motif, commentaire, date. |

L'administrateur gère tarifs, stocks, numéros de dépôt, paramètres et comptes des trésorières dans **l'admin Django** (`/admin/` en local, adresse secrète `ADMIN_URL` en production). Aucun endpoint n'est prévu pour ça.

### 2.3 Cycle de vie : la pièce centrale
- [apps/commandes/statuts.py](../apps/commandes/statuts.py) : les 7 statuts, les actions, les motifs de refus, et la table `TRANSITIONS` (quelle action, depuis quel statut, vers quel statut, par qui, motif obligatoire ou non).
- [apps/commandes/services.py](../apps/commandes/services.py) → `appliquer_transition(commande, action, auteur=..., motif=..., commentaire=...)` :
  - verrouille la commande en base (deux trésorières ne peuvent pas décider en même temps) ;
  - vérifie le rôle, le statut de départ et le motif obligatoire ;
  - à la validation, **bloque si le stock est insuffisant** (erreur 409 `stock_insuffisant`) ;
  - met à jour les dates (décision, remise, remis par) ;
  - écrit l'`Evenement` dans l'historique ;
  - appelle `notifier_changement_statut(commande_id, action)` après l'enregistrement, qui envoie l'email à l'acheteur (voir 2.7).
- `generer_code_suivi(commande)` → `POLO-2026-0042` (basé sur l'id ; à appeler **après** le premier `save()`).
- `catalogue/services.py` → `prix_unitaire(...)` et `quantite_restante(...)`. Seules les commandes **validées, disponibles ou remises** consomment du stock.

### 2.4 Endpoints terminés

| Route (`/api/v1/…`) | Ce qu'elle fait |
|---|---|
| `GET catalogue/` | Tout pour le formulaire : tarifs, choix possibles, disponibilités, numéros de dépôt actifs, ventes ouvertes ou non |
| `POST auth/connexion/` | Email + mot de passe → jetons `access` (30 min) et `refresh` (8 h). Même message d'erreur que l'email ou le mot de passe soit faux. |
| `POST auth/rafraichir/` · `POST auth/deconnexion/` · `GET auth/moi/` | Renouveler, invalider, profil |
| `POST auth/mot-de-passe/oubli/` | `{email}` → toujours `204`, que le compte existe ou non (rien n'est révélé). Si un compte actif correspond, email avec le lien `FRONTEND_URL` + `FRONTEND_ROUTE_REINITIALISATION` + `?uid=...&token=...`. Logique dans `apps/accounts/services.py`. |
| `POST auth/mot-de-passe/reinitialiser/` | `{uid, token, mot_de_passe}` → `204`. Jeton Django : **une seule utilisation**, valable `PASSWORD_RESET_MINUTES` (60 par défaut). 400 `erreurs.token` si le lien est invalide, expiré ou déjà utilisé ; 400 `erreurs.mot_de_passe` si trop faible. Toutes les sessions ouvertes sont fermées (jetons `refresh` en liste noire). |
| `GET gestion/commandes/` | Liste paginée par 25. Les commandes en attente en premier. Filtres et recherche : voir README. |
| `POST gestion/commandes/{id}/valider/`, `refuser/`, `demander-complement/`, `marquer-disponible/`, `marquer-remis/`, `annuler-decision/` | Les 6 actions, toutes via `appliquer_transition`. Réponse `204`. |
| `POST commandes/` | Passer une commande : ventes ouvertes, quantité max et stock par variante (lignes identiques additionnées), prix calculés par le serveur, capture avec empreinte, code de suivi, historique `SOUMETTRE`, accusé de réception via `on_commit`. Logique dans `services.creer_commande` ; `services.enregistrer_capture` est réutilisable pour le renvoi de capture. |
| `POST suivi/` | Suivre sa commande avec le code **et** l'email (casse et espaces ignorés). 404 générique identique si l'un des deux est faux. `retrait` rempli seulement au statut `POLO_DISPONIBLE`. Logique dans `services.trouver_commande_acheteur` et `services.donnees_suivi`, réutilisables pour le renvoi de capture. |
| `POST suivi/capture/` | Renvoyer une capture quand la commande est `A_CORRIGER` (409 sinon, 404 générique si code ou email faux). Nouvelle `Capture`, l'ancienne est conservée ; référence de transaction mise à jour si fournie ; retour à `EN_ATTENTE` via `appliquer_transition` (historique + email). Logique dans `services.renvoyer_capture`. |
| `GET gestion/commandes/{id}/` | Fiche complète : lignes, paiement, capture actuelle, historique, autres commandes du même email, actions possibles (`ANNULER_DECISION` seulement pour l'admin). 3 alertes non bloquantes : `CAPTURE_DEJA_UTILISEE` (même empreinte sur une autre commande), `REFERENCE_DEJA_UTILISEE`, `STOCK_INSUFFISANT` (commande en attente). Nombre de requêtes constant. Logique dans `services.fiche_commande` et `services.calculer_alertes`. |
| `PATCH gestion/commandes/{id}/` | Ne modifie **que** `note_interne` (5000 caractères max), renvoie la fiche. |
| `GET gestion/commandes/{id}/capture/` | Fichier de la capture actuelle (`FileResponse`), réservé aux gestionnaires ; 404 si aucune capture ou fichier disparu ; accès journalisé (ids uniquement). |
| `GET gestion/tableau-de-bord/` | Compteurs par statut, montant encaissé (validées, disponibles, remises), montant en attente, stock par combinaison (demandé, validé, remis, restant). Agrégats SQL, nombre de requêtes constant. Logique dans `services.tableau_de_bord`. |
| `GET gestion/commandes/export/` | CSV, une ligne par polo. **Mêmes filtres, recherche et tri que la liste** (`CommandesGestionMixin` partagé). Séparateur `;` + BOM UTF-8 pour Excel, injection de formule neutralisée, export journalisé. |
| `GET sante/` | État de l'API et de la base (503 si la base ne répond pas) |

**Clôture automatique** : `python manage.py cloturer_commandes` clôture les commandes `A_CORRIGER` dont la décision a plus de `delai_correction_jours` (7 par défaut), via `appliquer_transition` (historique + email). Une erreur sur une commande n'arrête pas les autres. À planifier une fois par jour (voir [DEPLOIEMENT.md](DEPLOIEMENT.md)).

**Contrôle de stock** : `services.variantes_en_manque` additionne les lignes identiques (deux lignes de 3 polos M = 6), pour la validation comme pour l'alerte de la fiche, comme à la création de commande.

### 2.5 Sécurité déjà en place
- Les droits sont vérifiés côté serveur ([apps/core/permissions.py](../apps/core/permissions.py)). Par défaut **tout endpoint exige une connexion** : un endpoint public doit déclarer `AllowAny`.
- Captures : 5 Mo maximum. Le type (JPG, PNG, PDF) est vérifié sur le **contenu réel** du fichier, pas sur son extension ([apps/core/validators.py](../apps/core/validators.py)).
- Captures stockées dans un dossier privé (`PRIVATE_MEDIA_ROOT`), **jamais servi publiquement**.
- Mots de passe : 10 caractères minimum, mots de passe trop courants refusés.
- En production (`DEBUG=False`) : HTTPS forcé, cookies sécurisés, HSTS.
- **Limites d'essais impossibles à contourner** : l'adresse IP du visiteur ne se lit pas dans l'en-tête `X-Forwarded-For` qu'il peut inventer. `NUM_PROXIES` (0 en local, 1 derrière le proxy de l'hébergeur) dit combien de proxys croire. Les compteurs sont dans un cache fichier partagé par les processus gunicorn (pas en base : la transaction de la requête, annulée en cas d'erreur, effacerait le compteur d'une connexion ratée).
- **Admin Django protégé** : connexion limitée à 5 essais par minute ([apps/core/admin_securite.py](../apps/core/admin_securite.py)), adresse secrète en production (`ADMIN_URL`). Les trésorières n'y ont pas accès (`is_staff` faux).
- **Swagger et schéma désactivés en production** (`API_DOCS`, vrai par défaut seulement si `DEBUG=True`) : le plan de l'API n'est pas offert. Le front utilise `docs/openapi.yaml`.
- Tests dans [apps/core/test_securite.py](../apps/core/test_securite.py).

### 2.6 Tests
138 tests, tous verts. Ils couvrent les transitions, les rôles, le stock, l'API (connexion, liste, actions, erreurs), la validation des captures, la création de commande (`tests/test_creation.py`), le suivi (`tests/test_suivi.py`), le renvoi de capture (`tests/test_renvoi_capture.py`) et les emails (`tests/test_emails.py`), le téléchargement de la capture (`tests/test_capture.py`), la fiche (`tests/test_fiche.py`), le tableau de bord (`tests/test_tableau_de_bord.py`), l'export (`tests/test_export.py`), la clôture automatique (`tests/test_cloture.py`), la réinitialisation du mot de passe (`apps/accounts/tests/test_mot_de_passe.py`) et les protections contre les abus (`apps/core/test_securite.py`). Les fabriques réutilisables sont dans [apps/commandes/tests/fabriques.py](../apps/commandes/tests/fabriques.py) : `creer_commande()`, `creer_tresoriere()`, `creer_admin()`, `fichier_png()`. `tests/stockage.py` (`StockageTemporaireMixin`) écrit les captures de test dans un dossier temporaire.

### 2.7 Emails : comment ils fonctionnent
- `notifier_changement_statut(commande_id, action)` dans `services.py` choisit l'email d'après **l'action** qui vient d'avoir lieu (table `EMAILS`), pas d'après le statut : `EN_ATTENTE` peut venir d'une création, d'un renvoi de capture ou d'une annulation. Sans `action`, elle lit le dernier `Evenement`.
- 9 emails aux acheteurs : accusé de réception, nouvelle capture reçue, complément demandé, commande validée, polo disponible, polos remis, commande refusée, commande clôturée, décision annulée. L'objet contient toujours le code de suivi : `[POLO-2026-0042] ...`.
- 1 email aux gestionnaires : réinitialisation du mot de passe (`reinitialisation_mot_de_passe.html`, envoyé par `apps/accounts/services.py`).
- **Modifier un email = modifier uniquement son fichier `templates/emails/<gabarit>.html`.** La version texte (envoyée avec le HTML pour les messageries qui ne l'affichent pas et pour limiter le classement en spam) est déduite automatiquement par `html_vers_texte` ([apps/core/emails.py](../apps/core/emails.py)) : deux cellules d'une même ligne de tableau deviennent « gauche : droite », un bouton devient « texte : lien ».
- Base commune `_base.html` (en-tête, bandeau de couleur, bloc `salutation`, pied avec le code de suivi s'il y a une commande) et blocs `_recapitulatif.html`, `_bouton.html`, `_encadre.html`. Styles en ligne et mise en page en tableaux (Gmail / Outlook), 560 px max, lisible sur mobile. Le commentaire de la trésorière est échappé.
- 3 essais d'envoi (pause de 1 puis 2 s), puis `logger.error` avec l'id de la commande seulement. Une erreur d'email ne fait jamais échouer la requête.
- Lien de suivi : `FRONTEND_URL` + `FRONTEND_ROUTE_SUIVI` (`/suivi` par défaut) + `?code=POLO-...`. L'email de l'acheteur n'est jamais mis dans l'URL.
- En local, les emails s'affichent dans le terminal (`EMAIL_BACKEND` console).

---

## 3. Ce qui reste à faire

**Le code est terminé.** Tout ce qui reste concerne la mise en ligne et le travail avec le front. Le guide pas à pas est dans [DEPLOIEMENT.md](DEPLOIEMENT.md).

| # | Tâche | Détail |
|---|---|---|
| 1 | Choisir l'hébergeur du back | Python 3.12+, HTTPS, **disque persistant** pour les captures, tâche planifiée (cron) |
| 2 | Base de données de production | PostgreSQL (par exemple Supabase) : renseigner `DATABASE_URL` avec `?sslmode=require`. Sur Supabase, prendre le **Session pooler** (port 5432) et **désactiver la Data API** : le back ne s'en sert pas, et elle exposerait les tables via la clé publique |
| 3 | Serveur d'envoi d'emails (SMTP) | Identifiants à mettre dans le `.env` de production ; sans eux, aucun email ne part |
| 4 | Créer le `.env` de production | `DEBUG=False`, nouvelle `SECRET_KEY`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `FRONTEND_URL`, `PRIVATE_MEDIA_ROOT`, SMTP |
| 5 | Premier déploiement | `check --deploy`, `migrate`, `collectstatic`, `createsuperuser`, puis dans `/admin/` : comptes des trésorières, stocks, numéros de dépôt, paramètres de vente |
| 6 | Planifier la clôture automatique | `python manage.py cloturer_commandes` une fois par jour |
| 7 | Test de bout en bout avec le front | Une vraie commande de l'envoi à la remise, en vérifiant chaque email reçu et le lien de suivi |
| 8 | Après la mise en ligne | Surveillance de `/api/v1/sante/`, sauvegarde quotidienne de la base **et** des captures, un test de restauration |

**Rappel** : à chaque modification d'un serializer ou d'une route, régénérer `docs/openapi.yaml` (`python manage.py spectacular --file docs/openapi.yaml`) et prévenir le front.

---

## 4. Décisions prises (à ne pas changer sans en parler)

| Sujet | Décision | Pourquoi |
|---|---|---|
| Suivi | Code **et** email obligatoires | Les codes se suivent (`POLO-2026-0042`) : avec le code seul, n'importe qui pourrait consulter la commande d'un autre |
| Statuts | 7 statuts (`EN_ATTENTE`, `A_CORRIGER`, `VALIDEE`, `POLO_DISPONIBLE`, `REMIS`, `REFUSEE`, `CLOTUREE`) | Couvre à la fois le compte rendu de réunion et le cahier des charges |
| Panier | Plusieurs polos par commande, modèles Licence / Master | Cahier des charges ; un seul polo reste possible |
| Stock | Réservé à la **validation**, pas à l'envoi | Cahier des charges RG4 |
| Paramètres | Gérés dans `/admin/` (Django) | Aucun écran à développer côté front |
| Prix | Toujours calculés par le serveur, figés dans la commande | Le client ne peut pas tricher sur le montant |
| Authentification | JWT : accès 30 min, renouvellement 8 h | Front React séparé ; les sessions expirent |
| Suppression | Aucune commande ni capture n'est supprimable | Traçabilité |
| Annulation d'une décision | L'acheteur reçoit un email (`decision_annulee.html`) | Sa commande repasse en vérification, il doit le savoir (Roméo, 19/11) |

## 5. Questions encore ouvertes

- **Anti-spam du formulaire** : le cahier des charges demande un captcha. Seule la limite de 10 envois par heure est en place. Faut-il ajouter un captcha (par exemple Cloudflare Turnstile ou hCaptcha), en accord avec le front ?
- **Textes des emails modifiables par l'admin** (cahier §5.5) : pas prévu pour l'instant, les textes sont dans des gabarits. À ajouter seulement si le temps le permet.
- **Journal d'activité global** (connexions, exports, changements de paramètres) : l'historique par commande existe, pas le journal global.
- **Durée de conservation des captures** après la fin de la vente : à fixer.
- **Route du front pour le lien de suivi** dans les emails : `/suivi?code=POLO-...` par défaut, **à confirmer avec le front**. Si leur route est différente, changer `FRONTEND_ROUTE_SUIVI` dans le `.env` (aucun code à modifier).
- **Page « nouveau mot de passe » du front** : le lien de l'email mène à `/reinitialiser-mot-de-passe?uid=...&token=...` par défaut. Le front doit créer cette page (lire `uid` et `token` dans l'URL, demander le nouveau mot de passe, appeler `auth/mot-de-passe/reinitialiser/`), ainsi qu'un lien « Mot de passe oublié ? » sur l'écran de connexion. Route à confirmer, réglable avec `FRONTEND_ROUTE_REINITIALISATION`.

## 6. Points d'attention

- **La CI GitHub ne tourne pas** pour l'instant (problème de facturation sur le compte du propriétaire du dépôt). Lancez `python manage.py test` et `ruff check .` **vous-mêmes** avant chaque Pull Request.
- **`main` n'est pas protégée techniquement** (dépôt privé sur un compte gratuit). Respectez quand même la règle : jamais de push direct, toujours une Pull Request relue.
- **Modifier un serializer ou une route = modifier le contrat avec le front.** Régénérez `docs/openapi.yaml` et prévenez-les.
- **Un statut ne se modifie jamais avec `commande.statut = ...`.** Toujours `appliquer_transition()`.
- **Migrations** : si deux personnes modifient les modèles en parallèle, la deuxième à fusionner lance `python manage.py makemigrations --merge`.
