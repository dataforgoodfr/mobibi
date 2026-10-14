import type { Locale } from '@/lib/locale'

const INTL_LOCALE: Record<Locale, string> = {
  fr: 'fr-FR',
}

const numberFormatters = new Map<Locale, Intl.NumberFormat>()

const numberFormatterFor = (locale: Locale): Intl.NumberFormat => {
  const cached = numberFormatters.get(locale)
  if (cached) return cached

  const formatter = new Intl.NumberFormat(INTL_LOCALE[locale])
  numberFormatters.set(locale, formatter)
  return formatter
}

/** Thousands-separated formatting for the given locale, e.g. `12 480` in `fr`. */
export const formatCount = (value: number, locale: Locale = 'fr'): string =>
  numberFormatterFor(locale).format(value)

const dateFormatters = new Map<Locale, Intl.DateTimeFormat>()

const dateFormatterFor = (locale: Locale): Intl.DateTimeFormat => {
  const cached = dateFormatters.get(locale)
  if (cached) return cached

  const formatter = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  dateFormatters.set(locale, formatter)
  return formatter
}

/** `28 avr. 2026` for the header's date pill. `value` is a Payload date field's ISO string. */
export const formatDate = (value: string, locale: Locale = 'fr'): string =>
  dateFormatterFor(locale).format(new Date(value))

const relativeTimeFormatters = new Map<Locale, Intl.RelativeTimeFormat>()

const relativeTimeFormatterFor = (locale: Locale): Intl.RelativeTimeFormat => {
  const cached = relativeTimeFormatters.get(locale)
  if (cached) return cached

  const formatter = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: 'auto' })
  relativeTimeFormatters.set(locale, formatter)
  return formatter
}

/**
 * `il y a 3 min` for the recent-signatures list. Computed server-side at
 * render time — accurate when the page loads, goes stale on a long-open tab.
 * Acceptable for V0 since the page is dynamically rendered.
 */
export const formatRelativeTime = (value: string, locale: Locale = 'fr'): string => {
  const diffSeconds = (new Date(value).getTime() - Date.now()) / 1000
  const formatter = relativeTimeFormatterFor(locale)

  const minutes = diffSeconds / 60
  if (Math.abs(minutes) < 60) return formatter.format(Math.round(minutes), 'minute')

  const hours = minutes / 60
  if (Math.abs(hours) < 24) return formatter.format(Math.round(hours), 'hour')

  const days = hours / 24
  if (Math.abs(days) < 30) return formatter.format(Math.round(days), 'day')

  const months = days / 30
  return formatter.format(Math.round(months), 'month')
}
