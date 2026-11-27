import type { PayloadRequest, TextField, Validate } from 'payload'
import { text } from 'payload/shared'

type ValidateArgs = { req: PayloadRequest }

/**
 * `required: true` on a localized field means "required in EVERY locale": Payload
 * validates the value for the locale being written and ignores the fallback
 * chain, so saving an English translation would demand that every mandatory
 * French field be retyped in English.
 *
 * Reads already fall back (`localization.fallback: true`), so a missing English
 * title renders the French one. What we actually want is "mandatory in the
 * default locale, optional in the others" — which is this.
 */
export const requiredInDefaultLocale =
  (message = 'This field is required.') =>
  (value: unknown, { req }: ValidateArgs): string | true => {
    const defaultLocale = req?.payload?.config?.localization
      ? req.payload.config.localization.defaultLocale
      : undefined

    // `all` and an absent locale both write the default locale.
    const writingDefaultLocale =
      !req?.locale || req.locale === 'all' || req.locale === defaultLocale

    if (!writingDefaultLocale) return true

    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
      return message
    }

    return true
  }

export const RESERVED_ORGANIZATION_SLUGS = ['dashboard']

// A custom `validate` replaces Payload's default one, so `required` and length checks run here.
// Typed loosely so it fits `slugField`'s `TextField` union, `hasMany` branch included.
export const reservedOrganizationSlug: Validate<unknown, unknown, unknown, TextField> = (
  value,
  options,
) =>
  typeof value === 'string' && RESERVED_ORGANIZATION_SLUGS.includes(value)
    ? 'This slug is reserved.'
    : text(value as string, options as Parameters<typeof text>[1])
