'use client'

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const toggleVariants = cva(
  'group/toggle inline-flex items-center justify-center gap-1 rounded-full text-sm font-extrabold whitespace-nowrap transition-colors outline-none text-ink hover:bg-ink-12 focus-visible:ring-[3px] focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-50 data-pressed:bg-ink data-pressed:text-paper data-pressed:hover:bg-ink [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
      },
      size: {
        default: 'h-9 min-w-9 px-4',
        sm: 'h-8 min-w-8 px-3 text-[0.8rem]',
        lg: 'h-10 min-w-10 px-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Toggle({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
