'use client'

import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

/**
 * A read-only value with a « Copier » button — the pre-written message, its
 * subject, the recipient. Hand-written in `brand/` rather than pulled from
 * shadcn (CLAUDE.md's rule): copy-on-click carries no keyboard, focus or ARIA
 * behaviour worth a primitive for.
 *
 * Read-only on purpose: the citizen personalises the message in their own mail
 * client or on X, after the deep link has prefilled it. Nothing typed here
 * would be sent anywhere.
 */
export function CopyField({
  label,
  value,
  multiline,
}: {
  label: string
  value: string
  multiline?: boolean
}) {
  const [copied, setCopied] = useState(false)
  // Cleared on unmount: the modal can be closed (unmounting this) well inside
  // the 1.4s window, and a setState on a gone component is a leak warning.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(value)
    } catch {
      // Denied permission, or no clipboard API (insecure origin). The value is
      // on screen and selectable either way — nothing to report.
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.72rem] font-extrabold tracking-[0.05em] text-ink-60 uppercase">
          {label}
        </span>
        <button
          type="button"
          onClick={copy}
          className={cn(
            'cursor-pointer rounded-full border-[length:var(--bd-w)] border-ink px-2.5 py-0.5 text-[0.75rem] font-extrabold transition-colors',
            copied ? 'bg-ink text-paper' : 'bg-soft text-ink hover:bg-ink hover:text-paper',
          )}
        >
          {copied ? 'Copié ✓' : 'Copier'}
        </button>
      </div>
      <div
        className={cn(
          'rounded-[var(--radius-sm)] border-[length:var(--bd-w)] border-ink bg-paper px-3.5 py-3 text-[0.9rem] leading-relaxed font-medium text-ink',
          multiline
            ? 'max-h-56 overflow-y-auto whitespace-pre-wrap'
            : 'overflow-hidden text-ellipsis whitespace-nowrap',
        )}
      >
        {value}
      </div>
    </div>
  )
}
