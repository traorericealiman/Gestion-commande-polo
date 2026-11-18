"""Comptes des gestionnaires (trésorières et administrateur).

Les acheteurs n'ont PAS de compte : ils sont identifiés par le couple
(code de suivi, email) de leur commande.
"""

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("L'email est obligatoire.")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("role", User.Role.TRESORIERE)
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("role", User.Role.ADMIN)
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self._create_user(email, password, **extra)


class User(AbstractUser):
    class Role(models.TextChoices):
        TRESORIERE = "TRESORIERE", "Trésorière"
        ADMIN = "ADMIN", "Administrateur"

    # Connexion par email, pas de nom d'utilisateur.
    username = None
    email = models.EmailField("email", unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.TRESORIERE)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        verbose_name = "utilisateur"
        verbose_name_plural = "utilisateurs"

    def __str__(self):
        return self.get_full_name() or self.email

    @property
    def est_admin(self) -> bool:
        return self.role == self.Role.ADMIN

    @property
    def est_gestionnaire(self) -> bool:
        return self.role in (self.Role.TRESORIERE, self.Role.ADMIN)
