import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const alertVariants = cva('rounded-[22px] border px-5 py-4 shadow-sm backdrop-blur', {
  variants: {
    variant: {
      info: 'border-[#c7d6ff] bg-[#eef2ff] text-[#1d3f8b]',
      success: 'border-[#bcebd8] bg-[#e6f9f1] text-[#0f7a54]',
      warning: 'border-[#ffdca8] bg-[#fff6e6] text-[#a06000]',
      danger: 'border-[#ffc8cf] bg-[#ffe8eb] text-[#b51931]',
      neutral: 'border-[#d7e1ff] bg-[#f1f4ff] text-[#1a2f5c]'
    }
  },
  defaultVariants: {
    variant: 'neutral'
  }
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
  action?: React.ReactNode;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, title, children, action, ...props }, ref) => (
    <div ref={ref} role="status" className={cn(alertVariants({ variant }), className)} {...props}>
      {(title || action) && (
        <div className="mb-2 flex items-start justify-between gap-4">
          {title ? <h4 className="text-sm font-semibold">{title}</h4> : null}
          {action ? <div className="text-sm">{action}</div> : null}
        </div>
      )}
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  )
);

Alert.displayName = 'Alert';

