import type { TextField } from 'payload'

/** Accent-stripping, URL-safe slugify. « Loi Duplomb : on veut… » → `loi-duplomb-on-veut` */
export const slugify = (input: string): string =>
  input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * Slug field, derived from `from` when left empty.
 *
 * Not `localized`: the slug is part of the URL (`/:organization/:slug`) and must
 * resolve to the same document in every locale.
 */
export const slugField = (from = 'title'): TextField => ({
  name: 'slug',
  type: 'text',
  required: true,
  index: true,
  admin: {
    position: 'sidebar',
    description: 'Used in the URL. Leave empty to generate it from the title.',
  },
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        if (typeof value === 'string' && value.trim().length > 0) return slugify(value)

        // `title` is localized, so it is only a string when a single locale is
        // requested — which is the case for every normal write.
        const source = data?.[from]
        return typeof source === 'string' ? slugify(source) : value
      },
    ],
  },
})
