import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Poster skin ("Affiche"): thick ink border, offset solid shadow, hover
 * "lifts" the button by translating it toward the shadow and swapping to the
 * full-size shadow. No blur anywhere — see design_handoff_mobibi/README.md.
 */
const buttonVariants = cva(
  'group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius)] border-[length:var(--bd-w)] border-ink font-extrabold whitespace-nowrap transition-[transform,box-shadow] duration-100 ease-out outline-none select-none shadow-[var(--shadow-sm)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[var(--shadow)] active:translate-x-0 active:translate-y-0 active:shadow-[var(--shadow-sm)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white',
        dark: 'bg-ink text-paper',
        yellow: 'bg-accent-2 text-ink',
        outline: 'bg-transparent text-ink shadow-none hover:shadow-[var(--shadow-sm)]',
        ghost: 'border-transparent bg-transparent text-ink shadow-none hover:bg-ink-12',
      },
      size: {
        sm: 'h-9 px-3.5 text-sm',
        md: 'h-11 px-5.5 text-base',
        lg: 'h-13 px-7.5 text-lg',
      },
      full: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

function Button({
  className,
  variant,
  size,
  full,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, full, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
