import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors',
  {
    variants: {
      variant: {
        neutral: 'border-transparent bg-[#e5ebff] text-[#1a2f5c]',
        success: 'border-transparent bg-[#dff7eb] text-[#0f7a54]',
        warning: 'border-transparent bg-[#fff2d8] text-[#9b5a00]',
        danger: 'border-transparent bg-[#ffe2e5] text-[#b0192b]',
        info: 'border-transparent bg-[#ddebff] text-[#1d3f8b]'
      },
      size: {
        sm: 'px-2.5 py-0.5 text-[10px]',
        md: 'px-3 py-1 text-[11px]'
      }
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md'
    }
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size, className }))} {...props} />;
}

