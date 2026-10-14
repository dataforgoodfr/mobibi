/**
 * Locales exposed on the public site. Deliberately smaller than
 * `payload.config.ts`'s `localization.locales` (`fr` + `en`): the config says
 * what content CAN be authored, this says what the public site exposes. `en`
 * moves here once its UI copy exists.
 */
export const PUBLIC_LOCALES = ['fr'] as const

export type Locale = (typeof PUBLIC_LOCALES)[number]

export const isLocale = (value: string): value is Locale =>
  (PUBLIC_LOCALES as readonly string[]).includes(value)
