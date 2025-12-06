import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

export const Modal = DialogPrimitive.Root;
export const ModalTrigger = DialogPrimitive.Trigger;
export const ModalPortal = DialogPrimitive.Portal;

export const ModalClose = DialogPrimitive.Close;

export const ModalOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-[#0f172a]/40 backdrop-blur-md transition data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      className
    )}
    {...props}
  />
));
ModalOverlay.displayName = DialogPrimitive.Overlay.displayName;

const modalContentVariants = cva(
  'fixed left-1/2 top-1/2 z-50 w-full max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-[#d7e1ff] bg-white/95 shadow-[0_70px_200px_-110px_rgba(18,39,80,0.65)] backdrop-blur-2xl focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
  {
    variants: {
      size: {
        sm: 'max-w-md',
        md: 'max-w-xl',
        lg: 'max-w-3xl'
      }
    },
    defaultVariants: {
      size: 'md'
    }
  }
);

export interface ModalContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof modalContentVariants> {
  showClose?: boolean;
}

export const ModalContent = React.forwardRef<HTMLDivElement, ModalContentProps>(
  ({ className, children, size, showClose = true, ...props }, ref) => (
    <ModalPortal>
      <ModalOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(modalContentVariants({ size, className }), 'p-0')}
        {...props}
      >
        <div className="flex flex-col gap-6 px-8 py-7 text-[#3f4c70]">
          {children}
        </div>
        {showClose ? (
          <DialogPrimitive.Close
            className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-[#1b3978] transition hover:border-[#d7e1ff] hover:bg-[#edf2ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#90a8ff] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ×
            </span>
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </ModalPortal>
  )
);
ModalContent.displayName = DialogPrimitive.Content.displayName;

export const ModalHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('w-full flex flex-col gap-2 text-left', className)} {...props} />
);

export const ModalBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('w-full text-sm leading-relaxed text-[#3f4c70]', className)} {...props} />
);

export const ModalFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'w-full border-t border-[#e6edff] pt-4 flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-2',
      className
    )}
    {...props}
  />
);

export const ModalTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-2xl font-semibold text-[#13254a] tracking-[-0.01em]', className)}
    {...props}
  />
));
ModalTitle.displayName = DialogPrimitive.Title.displayName;

export const ModalDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-[#4c5c82] leading-relaxed', className)}
    {...props}
  />
));
ModalDescription.displayName = DialogPrimitive.Description.displayName;
