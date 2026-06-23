'use client';

import * as React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed bottom-4 right-4 z-[100] flex max-h-screen w-full max-w-[380px] flex-col gap-2',
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-[14px] border p-4 pr-8 transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full',
  {
    variants: {
      variant: {
        default:     '',
        destructive: '',
        success:     '',
        warning:     '',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

// Per-variant inline styles applied in Toaster
export const TOAST_VARIANT_STYLES = {
  default: {
    wrapper:  { background: 'var(--rp-btn-accent)', borderColor: 'rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(27,52,47,0.35)' },
    icon:     { background: 'rgba(255,255,255,0.1)', color: '#9bbdb7' },
    title:    { color: 'var(--rp-btn-accent-text)' },
    desc:     { color: '#9bbdb7' },
    close:    { color: 'rgba(255,255,255,0.4)' },
    progress: '#23766a',
  },
  destructive: {
    wrapper:  { background: 'var(--rp-surface)', borderColor: 'rgba(200,60,60,0.2)', boxShadow: '0 8px 32px rgba(196,60,60,0.12)' },
    icon:     { background: 'var(--rp-red-bg)', color: '#c43c3c' },
    title:    { color: 'var(--rp-text)' },
    desc:     { color: 'var(--rp-text-muted)' },
    close:    { color: 'var(--rp-text-faint)' },
    progress: '#c43c3c',
  },
  success: {
    wrapper:  { background: 'var(--rp-surface)', borderColor: 'rgba(35,118,106,0.2)', boxShadow: '0 8px 32px rgba(35,118,106,0.1)' },
    icon:     { background: 'var(--rp-teal-bg)', color: '#23766a' },
    title:    { color: 'var(--rp-text)' },
    desc:     { color: 'var(--rp-text-muted)' },
    close:    { color: 'var(--rp-text-faint)' },
    progress: '#23766a',
  },
  warning: {
    wrapper:  { background: 'var(--rp-surface)', borderColor: 'rgba(184,144,64,0.2)', boxShadow: '0 8px 32px rgba(184,144,64,0.1)' },
    icon:     { background: 'var(--rp-amber-bg)', color: '#b89040' },
    title:    { color: 'var(--rp-text)' },
    desc:     { color: 'var(--rp-text-muted)' },
    close:    { color: 'var(--rp-text-faint)' },
    progress: '#d4a853',
  },
} as const;

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  />
));
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      'inline-flex h-7 shrink-0 items-center justify-center rounded-[7px] border border-black/10 bg-black/5 px-3 text-[12px] font-medium transition-colors hover:bg-black/10 focus:outline-none',
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'absolute right-2 top-2 flex h-[22px] w-[22px] items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus:outline-none',
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3 w-3" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn('text-[13px] font-semibold leading-snug', className)} {...props} />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn('text-[12px] leading-relaxed mt-0.5', className)} {...props} />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;
type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
