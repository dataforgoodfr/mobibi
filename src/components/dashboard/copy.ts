import type { LoginErrorCode } from '@/lib/campaignerLogin'

export const LOGIN_ERROR_MESSAGES: Record<LoginErrorCode, string> = {
  provider: "La connexion n'a pas pu aboutir. Réessayez dans un instant.",
  state: 'La connexion a expiré ou a été interrompue. Réessayez.',
  'email-missing':
    "Votre compte ne fournit pas d'adresse e-mail. Contactez la personne qui vous a invité·e.",
  'email-unverified':
    "Votre adresse e-mail n'est pas encore vérifiée. Vérifiez-la, puis réessayez.",
  'access-denied': "Votre compte n'a pas accès à mobibi.",
  'email-conflict':
    "Cette adresse e-mail est déjà utilisée par un autre compte. Contactez l'équipe mobibi.",
}

export const DEFAULT_LOGIN_ERROR = 'Une erreur est survenue pendant la connexion.'
