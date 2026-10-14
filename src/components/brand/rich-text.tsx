import { RichText as RichTextRenderer } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { cn } from '@/lib/utils'

/**
 * Wraps Payload's `RichText` with the paragraph spacing shared by `context`,
 * `demand` and the petition `text` field. Styled by hand with a couple of
 * arbitrary selectors rather than `@tailwindcss/typography`, since today's
 * content is just paragraphs. If editors start using headings, lists or links
 * in these fields, install the plugin and swap the classes below for `prose`
 * rather than growing this selector list. The generated type for these fields
 * in `payload-types.ts` is a structural `{ root: {...} }` object, not
 * `SerializedEditorState` — this is the one place that cast happens.
 */
export function RichText({
  data,
  className,
}: {
  data?: { root: unknown } | null
  className?: string
}) {
  if (!data) return null

  return (
    <RichTextRenderer
      data={data as SerializedEditorState}
      className={cn('[&_p+p]:mt-3 [&_p]:leading-relaxed', className)}
    />
  )
}
