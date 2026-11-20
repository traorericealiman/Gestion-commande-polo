# Travailler sur le projet

## Le principe

- `main` contient toujours une version **qui marche**. On ne pousse jamais directement dessus.
- Chaque tâche se fait sur **sa propre branche**, puis arrive dans `main` par une **Pull Request (PR)** relue par un coéquipier.

## Étape par étape

### 1. Partir d'une base à jour

```bash
git checkout main
git pull
```

### 2. Créer sa branche

Nom de la branche : `type/description-courte`, en minuscules avec des tirets.

| Type | Usage | Exemple |
|---|---|---|
| `feature/` | Nouvelle fonctionnalité | `feature/creation-commande` |
| `fix/` | Correction de bug | `fix/calcul-montant` |
| `docs/` | Documentation | `docs/readme-installation` |
| `refactor/` | Réorganisation sans changement de comportement | `refactor/services-commandes` |

```bash
git checkout -b feature/creation-commande
```

### 3. Coder, tester, commiter

```bash
python manage.py test            # tout doit passer
ruff check . && ruff format .    # code propre
git add <fichiers>
git commit -m "feat(commandes): enregistrer une commande avec sa capture"
```

**Messages de commit** : `type(zone): ce que fait le commit`, au présent.
Types possibles : `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.

Exemples :
- `feat(suivi): renvoyer l'état d'une commande par code et email`
- `fix(catalogue): exclure les numéros de dépôt inactifs`
- `test(commandes): couvrir le refus sans motif`

### 4. Rester à jour avec `main` pendant le travail

```bash
git fetch origin
git merge origin/main     # à faire avant d'ouvrir la PR, et si main a bougé
```

### 5. Pousser et ouvrir la Pull Request

```bash
git push -u origin feature/creation-commande
```

Ensuite, sur GitHub, ouvrez la PR vers `main` et remplissez le modèle. La CI lance automatiquement les tests et le linter.

### 6. Relecture et fusion

- Au moins **un coéquipier** relit et approuve.
- La CI doit être **verte**.
- On fusionne avec **« Squash and merge »**, puis on supprime la branche.

## Points d'attention

- **Migrations** : si vous modifiez un `models.py`, lancez `python manage.py makemigrations` et commitez le fichier généré. Si deux personnes créent une migration en même temps, la deuxième à fusionner doit relancer `makemigrations --merge`.
- **Contrat d'API** : si vous touchez un `serializers.py` ou une route, régénérez `docs/openapi.yaml` (`python manage.py spectacular --file docs/openapi.yaml`) et prévenez l'équipe front.
- **Secrets** : jamais de mot de passe, de clé ou de `.env` dans un commit. Même si le dépôt est privé, un secret commité reste dans tout l'historique.
- **Tests** : toute règle métier ajoutée a son test. Utilisez les fabriques de `apps/commandes/tests/fabriques.py`.
