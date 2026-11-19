# État d'avancement du back-end

> Dernière mise à jour : **18 novembre 2026**
> À lire avant de prendre une tâche. Mettez ce fichier à jour dans votre Pull Request quand vous terminez quelque chose.

Ce document dit **ce qui est déjà fait**, **ce qui reste à faire** et, pour chaque chantier restant, **comment le faire** : fichiers à toucher, règles à respecter, pièges connus. Il ne dit pas *qui* fait quoi : la répartition est gérée à part.

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
| Catalogue public | ✅ Fait et testé |
| Liste des commandes + 6 actions de gestion | ✅ Fait et testé |
| Passer une commande | ✅ Fait et testé |
| Suivi de commande | ✅ Fait et testé |
| Renvoi de capture | ✅ Fait et testé |
| Fiche d'une commande (avec alertes) + note interne | 🚧 À faire |
| Téléchargement de la capture | 🚧 À faire |
| Tableau de bord | 🚧 À faire |
| Export CSV | 🚧 À faire |
| Emails automatiques | ✅ Fait et testé (texte + HTML) |
| Clôture automatique après 7 jours | 🚧 À faire |
| Mise en production | 🚧 À faire |

Les endpoints « À faire » **existent déjà** : leur route, leur format d'entrée et leur format de sortie sont définis et visibles dans Swagger. Pour l'instant ils répondent `501 Non implémenté`. **Le front peut donc déjà coder contre eux.** Votre travail consiste à remplacer le `raise NonImplemente()` par la vraie logique, **sans changer le format** (sinon, prévenir le front).

---

## 2. Ce qui est déjà fait (en détail)

### 2.1 Socle technique
- Django 6.1, Django REST Framework, configuration lue dans `.env` ([config/settings.py](../config/settings.py)).
- PostgreSQL. La base de dev s'appelle `polo_esatic`, l'utilisateur `polo`. Docker est en option.
- Documentation interactive sur `/api/docs/`, contrat exporté dans [docs/openapi.yaml](openapi.yaml).
- Format d'erreur unique pour toute l'API : `{detail, code, erreurs?}` ([apps/core/exceptions.py](../apps/core/exceptions.py)). Une erreur inattendue renvoie un message générique, et le détail technique part dans les logs serveur.
- Limitation du nombre de requêtes :
  - connexion : 5 par minute ;
  - envoi de commande : 10 par heure ;
  - suivi : 30 par minute.

  Les seuils se règlent dans le `.env`.
- Linter `ruff`, CI GitHub Actions (lint, migrations, schéma, tests), modèle de Pull Request.

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

L'administrateur gère tarifs, stocks, numéros de dépôt, paramètres et comptes des trésorières dans **`/admin/`** (interface Django). Aucun endpoint n'est prévu pour ça.

### 2.3 Cycle de vie : la pièce centrale
- [apps/commandes/statuts.py](../apps/commandes/statuts.py) : les 7 statuts, les actions, les motifs de refus, et la table `TRANSITIONS` (quelle action, depuis quel statut, vers quel statut, par qui, motif obligatoire ou non).
- [apps/commandes/services.py](../apps/commandes/services.py) → `appliquer_transition(commande, action, auteur=..., motif=..., commentaire=...)` :
  - verrouille la commande en base (deux trésorières ne peuvent pas décider en même temps) ;
  - vérifie le rôle, le statut de départ et le motif obligatoire ;
  - à la validation, **bloque si le stock est insuffisant** (erreur 409 `stock_insuffisant`) ;
  - met à jour les dates (décision, remise, remis par) ;
  - écrit l'`Evenement` dans l'historique ;
  - appelle `notifier_changement_statut(commande_id, action)` après l'enregistrement, qui envoie l'email à l'acheteur (voir chantier 8).
- `generer_code_suivi(commande)` → `POLO-2026-0042` (basé sur l'id ; à appeler **après** le premier `save()`).
- `catalogue/services.py` → `prix_unitaire(...)` et `quantite_restante(...)`. Seules les commandes **validées, disponibles ou remises** consomment du stock.

### 2.4 Endpoints terminés

| Route (`/api/v1/…`) | Ce qu'elle fait |
|---|---|
| `GET catalogue/` | Tout pour le formulaire : tarifs, choix possibles, disponibilités, numéros de dépôt actifs, ventes ouvertes ou non |
| `POST auth/connexion/` | Email + mot de passe → jetons `access` (30 min) et `refresh` (8 h). Même message d'erreur que l'email ou le mot de passe soit faux. |
| `POST auth/rafraichir/` · `POST auth/deconnexion/` · `GET auth/moi/` | Renouveler, invalider, profil |
| `GET gestion/commandes/` | Liste paginée par 25. Les commandes en attente en premier. Filtres et recherche : voir README. |
| `POST gestion/commandes/{id}/valider/`, `refuser/`, `demander-complement/`, `marquer-disponible/`, `marquer-remis/`, `annuler-decision/` | Les 6 actions, toutes via `appliquer_transition`. Réponse `204`. |
| `POST commandes/` | Passer une commande : ventes ouvertes, quantité max et stock par variante (lignes identiques additionnées), prix calculés par le serveur, capture avec empreinte, code de suivi, historique `SOUMETTRE`, accusé de réception via `on_commit`. Logique dans `services.creer_commande` ; `services.enregistrer_capture` est réutilisable pour le renvoi de capture. |
| `POST suivi/` | Suivre sa commande avec le code **et** l'email (casse et espaces ignorés). 404 générique identique si l'un des deux est faux. `retrait` rempli seulement au statut `POLO_DISPONIBLE`. Logique dans `services.trouver_commande_acheteur` et `services.donnees_suivi`, réutilisables pour le renvoi de capture. |
| `POST suivi/capture/` | Renvoyer une capture quand la commande est `A_CORRIGER` (409 sinon, 404 générique si code ou email faux). Nouvelle `Capture`, l'ancienne est conservée ; référence de transaction mise à jour si fournie ; retour à `EN_ATTENTE` via `appliquer_transition` (historique + email). Logique dans `services.renvoyer_capture`. |
| `GET sante/` | État de l'API et de la base |

### 2.5 Sécurité déjà en place
- Les droits sont vérifiés côté serveur ([apps/core/permissions.py](../apps/core/permissions.py)). Par défaut **tout endpoint exige une connexion** : un endpoint public doit déclarer `AllowAny`.
- Captures : 5 Mo maximum. Le type (JPG, PNG, PDF) est vérifié sur le **contenu réel** du fichier, pas sur son extension ([apps/core/validators.py](../apps/core/validators.py)).
- Captures stockées dans un dossier privé (`PRIVATE_MEDIA_ROOT`), **jamais servi publiquement**.
- Mots de passe : 10 caractères minimum, mots de passe trop courants refusés.
- En production (`DEBUG=False`) : HTTPS forcé, cookies sécurisés, HSTS.

### 2.6 Tests
73 tests, tous verts. Ils couvrent les transitions, les rôles, le stock, l'API (connexion, liste, actions, erreurs), la validation des captures, la création de commande (`tests/test_creation.py`), le suivi (`tests/test_suivi.py`), le renvoi de capture (`tests/test_renvoi_capture.py`) et les emails (`tests/test_emails.py`). Les fabriques réutilisables sont dans [apps/commandes/tests/fabriques.py](../apps/commandes/tests/fabriques.py) : `creer_commande()`, `creer_tresoriere()`, `creer_admin()`, `fichier_png()`.

---

## 3. Ce qui reste à faire

Chaque chantier indique les fichiers concernés, les étapes et le **critère de fin**. Les numéros ne sont pas un ordre imposé. Le chantier 1 est cependant celui dont dépendent le plus les autres : sans commande créée, pas de suivi ni de fiche à tester de bout en bout.

### Chantier 1 · `POST /api/v1/commandes/` : passer une commande
**Fichier** : `CommandeCreationView` dans [apps/commandes/views.py](../apps/commandes/views.py). La logique va dans une fonction `creer_commande(...)` de `services.py`.
**Entrée** : `CommandeCreationSerializer`, déjà écrit, qui valide déjà les formats, les deux emails identiques, la case cochée et la capture. Format `multipart/form-data` ; `lignes` arrive comme **chaîne JSON**.

Étapes, dans une transaction :
1. Si `ParametresVente.charger().ventes_ouvertes` est faux → `raise VentesFermees()` (403).
2. Pour chaque ligne :
   - `quantite` ≤ `parametres.quantite_max_par_ligne`, sinon erreur 400 ;
   - `quantite_restante(...)` vaut `None` (pas de limite) ou est ≥ la quantité demandée, sinon erreur 400 « taille épuisée ».
3. Prix : `prix_unitaire(modele, version, manches)` pour chaque ligne. **Ne jamais lire un prix envoyé par le client.** `montant_total` = somme des `prix_unitaire × quantite`.
4. Créer `Commande` (email en minuscules), puis `code_suivi = generer_code_suivi(commande)` et `save(update_fields=["code_suivi"])`.
5. Créer les `LigneCommande` et le `Paiement`.
6. Créer la `Capture`. Renseigner `empreinte` **avant** d'enregistrer le fichier, car le chemin du fichier en dépend :
   - `empreinte = empreinte_sha256(fichier)` ;
   - `type_mime = detecter_type(fichier)` ;
   - `taille_octets = fichier.size`.
7. Créer l'`Evenement` (`action=SOUMETTRE`, `statut_avant=""`, `statut_apres=EN_ATTENTE`, `auteur=None`).
8. `transaction.on_commit(lambda: notifier_changement_statut(commande.pk))` : c'est l'accusé de réception.
9. Répondre `201` avec `CommandeCreeeSerializer` (`code_suivi`, `statut`, `montant_total`).

⚠️ **Une capture déjà utilisée ne bloque pas l'envoi.** Le cahier des charges demande de *prévenir la trésorière*, ce qui se fait par une alerte sur la fiche (chantier 4).
**Fini quand** : une commande à plusieurs lignes est créée avec le bon montant ; ventes fermées → 403 ; taille épuisée → 400 ; capture `.exe` renommée → 400 ; tests écrits.

### Chantier 2 · `POST /api/v1/suivi/` : suivre sa commande
**Fichier** : `SuiviView`. **Entrée** : `SuiviRequeteSerializer` (`code_suivi` + `email`). **Sortie** : `SuiviSerializer`.
1. Chercher la commande avec `code_suivi__iexact` **et** `email__iexact`. Si rien ne correspond → 404 avec un message générique (« Commande introuvable »). Ne jamais dire lequel des deux est faux.
2. Construire la réponse :
   - `statut_libelle` = `commande.get_statut_display()` ;
   - `motif_libelle` = `commande.get_motif_display()` ;
   - `retrait` = `{lieu, horaires, contact}` tirés de `ParametresVente` **seulement si** le statut est `POLO_DISPONIBLE`, sinon `null` ;
   - `peut_renvoyer_capture` = statut `A_CORRIGER`.

✅ Le test `test_endpoints_a_faire_renvoient_501` a été supprimé et remplacé par `tests/test_suivi.py`.
**Fini quand** : bon couple → 200 ; mauvais email → 404 ; retrait visible seulement au statut `POLO_DISPONIBLE`.

### Chantier 3 · `POST /api/v1/suivi/capture/` : renvoyer une capture
**Fichier** : `RenvoiCaptureView`. **Entrée** : `RenvoiCaptureSerializer` (code, email, capture, référence facultative).
1. Même recherche que le chantier 2 (404 générique).
2. Si le statut n'est pas `A_CORRIGER` → `raise TransitionInterdite()` (409).
3. Créer une nouvelle `Capture` (même méthode qu'au chantier 1, étape 6). Mettre à jour `paiement.reference_transaction` si elle est fournie.
4. `appliquer_transition(commande, Action.RENVOYER_CAPTURE)` (sans auteur : c'est l'acheteur). La commande repasse `EN_ATTENTE`.
5. Répondre avec `SuiviSerializer`.

**Fini quand** : renvoi accepté au statut `A_CORRIGER`, 409 sinon ; l'ancienne capture est conservée.

### Chantier 4 · `GET` et `PATCH /api/v1/gestion/commandes/{id}/` : fiche d'une commande
**Fichier** : `CommandeDetailView`. **Sortie** : `CommandeDetailSerializer`.
- Charger la commande avec `select_related("paiement")` et `prefetch_related("lignes", "captures", "evenements__auteur")`, pour éviter des dizaines de requêtes.
- `capture` : informations de `commande.capture_actuelle` + `url_telechargement` = `/api/v1/gestion/commandes/{id}/capture/`. Le modèle n'a pas ce champ : il faut le construire, par exemple avec un `SerializerMethodField` ou un dict.
- `alertes` (liste vide s'il n'y a rien), chacune avec `code`, `message` et `commandes_liees` (codes de suivi) :
  - `CAPTURE_DEJA_UTILISEE` : une `Capture` d'une **autre** commande a la même `empreinte` ;
  - `REFERENCE_DEJA_UTILISEE` : un `Paiement` d'une autre commande a la même `reference_transaction` (non vide) ;
  - `STOCK_INSUFFISANT` : seulement si le statut est `EN_ATTENTE` et qu'une ligne dépasse `quantite_restante`.
- `autres_commandes_meme_email` : codes de suivi des autres commandes du même email.
- `actions_possibles` : `actions_possibles(commande.statut)` de `statuts.py`, **en retirant `ANNULER_DECISION` si l'utilisateur n'est pas admin**.
- `PATCH` : entrée `NoteInterneSerializer`, ne modifie **que** `note_interne`, renvoie la fiche.

**Fini quand** : les 3 alertes sont testées ; une trésorière ne voit pas `ANNULER_DECISION`.

### Chantier 5 · `GET /api/v1/gestion/commandes/{id}/capture/` : télécharger la capture
**Fichier** : `CaptureTelechargementView`.
- `capture = commande.capture_actuelle` ; s'il n'y en a pas → 404.
- Renvoyer `FileResponse(capture.fichier.open("rb"), content_type=capture.type_mime)`. `capture.fichier.url` **ne fonctionne pas** volontairement, car le stockage est privé.
- Journaliser l'accès : `logger.info("Capture consultée : commande %s par utilisateur %s", commande.pk, request.user.pk)`. Uniquement des identifiants, pas d'email ni de nom.

**Fini quand** : une trésorière connectée reçoit le fichier, un visiteur non connecté reçoit 401.

### Chantier 6 · `GET /api/v1/gestion/tableau-de-bord/` : tableau de bord
**Fichier** : `TableauDeBordView`. **Sortie** : `TableauDeBordSerializer`.
- `compteurs` : nombre de commandes par statut. Une seule requête : `values("statut").annotate(n=Count("id"))`. Mettre 0 pour les statuts absents.
- `montant_encaisse` : somme de `montant_total` des statuts de `STATUTS_CONSOMMANT_STOCK`.
- `montant_en_attente` : somme de `montant_total` des commandes `EN_ATTENTE`.
- `stocks` : une entrée par combinaison modèle × version × manches × taille qui a un `Stock` **ou** au moins une ligne commandée.
  - `demande` : quantités hors commandes `REFUSEE` et `CLOTUREE` ;
  - `valide` : quantités des statuts de `STATUTS_CONSOMMANT_STOCK` ;
  - `remis` : quantités des commandes `REMIS` ;
  - `restant` : résultat de `quantite_restante` (`null` = pas de limite).

  Calculer avec des agrégats (`Sum` + `filter=Q(...)`), pas une requête par combinaison.

**Fini quand** : les chiffres sont justes sur un jeu de test avec des commandes dans plusieurs statuts.

### Chantier 7 · `GET /api/v1/gestion/commandes/export/` : export CSV
**Fichier** : `ExportView`.
- Réutiliser **les mêmes filtres et la même recherche** que la liste : appliquer `CommandeFilter` et `SearchFilter` sur le même queryset, pour que le fichier corresponde à ce que la trésorière voit à l'écran.
- **Une ligne par polo commandé** (`LigneCommande`). Colonnes :
  - code de suivi, nom, prénoms, email ;
  - modèle, version, manches, taille, quantité, prix unitaire, prix de la ligne ;
  - montant total de la commande ;
  - moyen de paiement, numéro d'envoi, référence ;
  - statut, date.
- Pour qu'Excel en français ouvre le fichier correctement : encodage `utf-8-sig`, séparateur `;`. Réponse `HttpResponse(content_type="text/csv")` avec `Content-Disposition: attachment; filename="commandes.csv"`.
- Journaliser l'export (id de l'utilisateur et nombre de lignes).

**Fini quand** : le fichier s'ouvre proprement dans Excel ; le filtre `statut=VALIDEE` est respecté.

### Chantier 8 · Emails automatiques ✅ Fait

**Ce qui a été fait** :
- `notifier_changement_statut(commande_id, action)` dans `services.py` choisit l'email d'après **l'action** qui vient d'avoir lieu (table `EMAILS`), pas d'après le statut : `EN_ATTENTE` peut venir d'une création, d'un renvoi de capture ou d'une annulation. Sans `action`, elle lit le dernier `Evenement`.
- Un seul gabarit HTML par email (`templates/emails/<gabarit>.html`). La version texte, envoyée avec le HTML pour les messageries qui ne l'affichent pas (et pour limiter le classement en spam), est **déduite automatiquement** du HTML par `services._html_vers_texte`. Objet : `[POLO-2026-0042] ...`.
- HTML : base commune `_base.html` (en-tête, bandeau de couleur selon l'email, pied avec le code de suivi), blocs `_recapitulatif.html`, `_bouton.html`, `_encadre.html`. Styles en ligne et mise en page en tableaux (compatibles Gmail / Outlook), largeur 560 px max, lisible sur mobile. Le commentaire de la trésorière est échappé (pas d'injection HTML).
- **Modifier un email = modifier uniquement son fichier `.html`.** Dans un tableau, deux cellules d'une même ligne deviennent « gauche : droite » dans la version texte, et un bouton devient « texte : lien ».
- 3 essais d'envoi (pause de 1 puis 2 s), puis `logger.error` avec l'id de la commande seulement. Une erreur d'email ne fait jamais échouer la requête.
- Lien de suivi : `FRONTEND_URL` + `FRONTEND_ROUTE_SUIVI` (nouveau réglage, `/suivi` par défaut) + `?code=POLO-...`. L'email de l'acheteur n'est jamais mis dans l'URL.
- **Décision** : `ANNULER_DECISION` n'envoie pas d'email (décision interne).

Le cahier des charges initial :

| Statut atteint | Email | Contenu essentiel |
|---|---|---|
| `EN_ATTENTE` (création) | Accusé de réception | Récapitulatif des polos, montant, code de suivi, lien de suivi |
| `EN_ATTENTE` (après renvoi de capture) | Nouvelle capture reçue | Court message de confirmation |
| `A_CORRIGER` | Complément demandé | Motif, commentaire, lien de suivi, date limite (date + délai de `ParametresVente`) |
| `VALIDEE` | Commande validée | Paiement confirmé, récapitulatif |
| `POLO_DISPONIBLE` | Polo disponible | Lieu, horaires, contact de retrait, code à présenter |
| `REMIS` | Polos remis | Confirmation, remerciement |
| `REFUSEE` | Commande refusée | Motif, commentaire, marche à suivre |
| `CLOTUREE` | Clôture | Raison, comment recommander |

- **Objet de chaque email : il doit contenir le code de suivi**, car un même email peut avoir plusieurs commandes.
- Gabarits dans `templates/emails/` (texte, et HTML si le temps le permet). Ils doivent rester lisibles sur mobile.
- Lien de suivi : `settings.FRONTEND_URL` + la route du front (à convenir avec l'équipe front).
- En cas d'échec : 3 essais, puis `logger.error` sans l'adresse email en clair.
- En local, les emails s'affichent dans le terminal (`EMAIL_BACKEND` console).

**Fini quand** : chaque transition produit le bon email (testable avec `django.core.mail.outbox` dans les tests).

### Chantier 9 · Clôture automatique après 7 jours
- Créer une commande de gestion `apps/commandes/management/commands/cloturer_commandes.py`.
- Elle sélectionne les commandes `A_CORRIGER` dont `date_decision` est plus vieille que `ParametresVente.delai_correction_jours`, et appelle `appliquer_transition(commande, Action.CLOTURER)` sur chacune. Une erreur sur une commande ne doit pas arrêter les autres.
- À lancer une fois par jour sur le serveur (tâche planifiée).

**Fini quand** : `python manage.py cloturer_commandes` clôture les bonnes commandes, avec un test.

### Chantier 10 · Mise en production
- Choisir l'hébergeur (back + PostgreSQL), avec HTTPS.
- Ajouter `gunicorn` (ou équivalent) et `whitenoise` pour les fichiers statiques de `/admin/`.
- `.env` de production :
  - `DEBUG=False` ;
  - vraie `SECRET_KEY` ;
  - `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` (domaine du front) ;
  - SMTP réel ;
  - `PRIVATE_MEDIA_ROOT` sur un disque persistant.
- Sauvegarde quotidienne de la base **et** des captures, et un test de restauration.
- Surveiller `/api/v1/sante/` avec un outil de surveillance gratuit.

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

## 5. Questions encore ouvertes

- **Anti-spam du formulaire** : le cahier des charges demande un captcha. Seule la limite de 10 envois par heure est en place. Faut-il ajouter un captcha (par exemple Cloudflare Turnstile ou hCaptcha), en accord avec le front ?
- **Textes des emails modifiables par l'admin** (cahier §5.5) : pas prévu pour l'instant, les textes sont dans des gabarits. À ajouter seulement si le temps le permet.
- **Journal d'activité global** (connexions, exports, changements de paramètres) : l'historique par commande existe, pas le journal global.
- **Durée de conservation des captures** après la fin de la vente : à fixer.
- **Route du front pour le lien de suivi** dans les emails : `/suivi?code=POLO-...` par défaut. Si le front utilise une autre route, changer `FRONTEND_ROUTE_SUIVI` dans le `.env` (aucun code à modifier).

## 6. Points d'attention

- **La CI GitHub ne tourne pas** pour l'instant (problème de facturation sur le compte du propriétaire du dépôt). Lancez `python manage.py test` et `ruff check .` **vous-mêmes** avant chaque Pull Request.
- **`main` n'est pas protégée techniquement** (dépôt privé sur un compte gratuit). Respectez quand même la règle : jamais de push direct, toujours une Pull Request relue.
- **Modifier un serializer ou une route = modifier le contrat avec le front.** Régénérez `docs/openapi.yaml` et prévenez-les.
- **Un statut ne se modifie jamais avec `commande.statut = ...`.** Toujours `appliquer_transition()`.
- **Migrations** : si deux personnes modifient les modèles en parallèle, la deuxième à fusionner lance `python manage.py makemigrations --merge`.
