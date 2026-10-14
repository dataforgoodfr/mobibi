'use client'

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * First modal primitive in the codebase — pulled in per CLAUDE.md's rule for
 * shadcn/base-ui components: only when a primitive carries behaviour worth
 * not hand-rolling (focus trap, Escape-to-close, backdrop click, scroll
 * lock — exactly what a modal needs). Restyled to the poster skin on
 * arrival, same as `Button`/`ToggleGroup` were.
 */
function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ className, ...props }: DialogPrimitive.Trigger.Props) {
  return (
    <DialogPrimitive.Trigger
      data-slot="dialog-trigger"
      className={cn('cursor-pointer', className)}
      {...props}
    />
  )
}

function DialogClose({ className, ...props }: DialogPrimitive.Close.Props) {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      className={cn('cursor-pointer', className)}
      {...props}
    />
  )
}

function DialogPortal(props: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogBackdrop({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-backdrop"
      className={cn(
        'fixed inset-0 z-80 bg-[rgba(15,18,40,.55)] backdrop-blur-[3px]',
        'data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity duration-150',
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: DialogPrimitive.Popup.Props & { showClose?: boolean }) {
  return (
    <DialogPortal>
      <DialogBackdrop />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-80 flex max-h-[92vh] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[var(--radius-lg)] border-[length:var(--bd-w)] border-ink bg-card shadow-[var(--shadow)] outline-none',
          'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 data-[starting-style]:scale-97 data-[ending-style]:scale-97 data-[starting-style]:translate-y-3.5 data-[ending-style]:translate-y-3.5',
          'transition-[opacity,transform] duration-[.26s] ease-[cubic-bezier(.22,1,.36,1)]',
          className,
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogClose
            aria-label="Fermer"
            className="absolute top-4.5 right-6 grid size-9.5 shrink-0 place-items-center rounded-full border-[length:var(--bd-w)] border-ink bg-soft text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            <X size={16} strokeWidth={2.6} />
            <span className="sr-only">Fermer</span>
          </DialogClose>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        'flex shrink-0 flex-col gap-1 border-b-[length:var(--bd-w)] border-ink px-6 py-5 pr-16',
        className,
      )}
      {...props}
    />
  )
}

function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-body"
      className={cn('flex-1 overflow-y-auto px-6 py-6', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex shrink-0 flex-col-reverse gap-2.5 border-t-[length:var(--bd-w)] border-ink bg-soft px-6 py-5 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        'font-display text-[1.65rem] leading-[1.08] font-extrabold text-ink uppercase',
        className,
      )}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('mt-1 text-[0.85rem] font-semibold text-ink-60', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}
