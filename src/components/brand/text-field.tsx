import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const CONTROL_CLASS =
  'w-full rounded-[var(--radius-sm)] border-[length:var(--bd-w)] border-ink bg-paper px-3.5 py-3 text-[0.95rem] font-semibold text-ink outline-none disabled:cursor-not-allowed disabled:bg-soft disabled:text-ink-60'

function FieldLabel({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.8rem] font-extrabold text-ink">
        {label}
        {required && <span className="text-accent"> *</span>}
        {hint && <span className="font-semibold text-ink-60"> {hint}</span>}
      </span>
      {children}
    </label>
  )
}

/**
 * Label + input, poster skin. Hand-written rather than pulled from shadcn:
 * a plain text input carries no behaviour worth not hand-rolling (see
 * CLAUDE.md's rule for when a primitive earns its place). Shared by the modals
 * that ask citizens for something — `auth/login-modal.tsx`,
 * `petition/sign-modal.tsx` and `interpellation/interpeller-modal.tsx`.
 *
 * `required` drives both the native validation and the red asterisk; pass
 * `hint` for the « (optionnel) » kind of aside next to the label.
 */
export function TextField({
  label,
  hint,
  className,
  ...props
}: ComponentProps<'input'> & { label: string; hint?: string }) {
  return (
    <FieldLabel label={label} hint={hint} required={props.required}>
      <input className={cn(CONTROL_CLASS, className)} {...props} />
    </FieldLabel>
  )
}

/**
 * Same field, multi-line. Its own component rather than a `multiline` prop on
 * `TextField` because the two take different DOM props — `rows` here, `type`
 * there — and one union of both would type-check calls that make no sense.
 * Used for the free-text feedback an association asks after an interpellation
 * (`interpellation-submissions.feedback[].value` is a `textarea`).
 */
export function TextAreaField({
  label,
  hint,
  className,
  rows = 3,
  ...props
}: ComponentProps<'textarea'> & { label: string; hint?: string }) {
  return (
    <FieldLabel label={label} hint={hint} required={props.required}>
      <textarea rows={rows} className={cn(CONTROL_CLASS, 'resize-y', className)} {...props} />
    </FieldLabel>
  )
}
