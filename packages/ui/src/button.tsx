import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import { cn } from './utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[18px] text-sm font-semibold tracking-[-0.01em] transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#92a6ff] focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-60 disabled:shadow-none select-none whitespace-nowrap will-change-transform',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-[#142a5a] via-[#1b3978] to-[#254b9a] text-white shadow-[0_28px_80px_-36px_rgba(20,42,90,0.7)] hover:-translate-y-[2px] hover:shadow-[0_32px_95px_-40px_rgba(20,42,90,0.7)] hover:from-[#183568] hover:via-[#23478d] hover:to-[#2d5cb5] active:translate-y-[1px] active:shadow-[0_16px_50px_-30px_rgba(20,42,90,0.65)]',
        secondary:
          'border border-[#d7e1ff] bg-white/90 text-[#1b3978] shadow-[0_22px_65px_-40px_rgba(21,48,107,0.45)] backdrop-blur hover:-translate-y-[2px] hover:bg-white focus-visible:ring-[#92a6ff]',
        outline:
          'border border-[#c4d2ff] bg-white/80 text-[#1b3978] hover:border-[#92a6ff] hover:bg-[#f2f4ff] hover:text-[#142a5a] active:bg-[#e8ecff]',
        ghost:
          'text-[#1b3978] hover:bg-[#edf2ff] hover:text-[#142a5a] active:bg-[#e3ebff]',
        danger:
          'bg-gradient-to-r from-[#d6394f] via-[#e14c58] to-[#f06666] text-white shadow-[0_26px_70px_-38px_rgba(214,57,79,0.65)] hover:-translate-y-[2px] hover:shadow-[0_32px_85px_-40px_rgba(214,57,79,0.7)] hover:from-[#cc3246] hover:via-[#e04353] hover:to-[#ec5a5a] active:translate-y-[1px] active:shadow-[0_18px_55px_-32px_rgba(214,57,79,0.6)]'
      },
      size: {
        sm: 'px-4 py-2 text-xs',
        md: 'px-5 py-2.5',
        lg: 'px-6 py-3 text-base',
        icon: 'h-10 w-10 rounded-[14px]'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
  }
);

Button.displayName = 'Button';

