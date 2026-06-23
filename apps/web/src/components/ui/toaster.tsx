'use client';

import { useToast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';
import {
  Toast, ToastClose, ToastDescription, ToastProvider,
  ToastTitle, ToastViewport, TOAST_VARIANT_STYLES,
} from '@/components/ui/toast';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

const VARIANT_ICONS = {
  default:     Info,
  success:     CheckCircle2,
  destructive: XCircle,
  warning:     AlertTriangle,
};

export function Toaster() {
  const { toasts } = useToast();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const darkStyles = {
    destructive: { wrapper: { background: '#2a1a1a', borderColor: 'rgba(200,60,60,0.25)', boxShadow: '0 8px 32px rgba(196,60,60,0.2)' }, icon: { background: 'rgba(196,60,60,0.2)', color: '#e57373' }, title: { color: 'var(--rp-btn-accent-text)' }, desc: { color: '#94b8b0' }, close: { color: 'rgba(255,255,255,0.4)' }, progress: '#c43c3c' },
    success: { wrapper: { background: '#152620', borderColor: 'rgba(35,118,106,0.3)', boxShadow: '0 8px 32px rgba(35,118,106,0.2)' }, icon: { background: 'rgba(35,118,106,0.25)', color: '#4db6ac' }, title: { color: 'var(--rp-btn-accent-text)' }, desc: { color: '#94b8b0' }, close: { color: 'rgba(255,255,255,0.4)' }, progress: '#23766a' },
    warning: { wrapper: { background: '#201a0f', borderColor: 'rgba(184,144,64,0.25)', boxShadow: '0 8px 32px rgba(184,144,64,0.15)' }, icon: { background: 'rgba(184,144,64,0.2)', color: '#d4a853' }, title: { color: 'var(--rp-btn-accent-text)' }, desc: { color: '#94b8b0' }, close: { color: 'rgba(255,255,255,0.4)' }, progress: '#d4a853' },
  } as const;

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, variant, ...props }) => {
        const v = (variant ?? 'default') as keyof typeof TOAST_VARIANT_STYLES;
        const lightStyles = TOAST_VARIANT_STYLES[v] ?? TOAST_VARIANT_STYLES.default;
        const styles = isDark && v !== 'default' ? ((darkStyles as unknown) as Record<string, typeof lightStyles>)[v] ?? lightStyles : lightStyles;
        const Icon = VARIANT_ICONS[v] ?? Info;

        return (
          <Toast key={id} variant={variant} style={styles.wrapper} {...props}>
            {/* Icon box */}
            <div className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[9px]"
              style={styles.icon}>
              <Icon className="h-[15px] w-[15px]" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {title && <ToastTitle style={styles.title}>{title}</ToastTitle>}
              {description && <ToastDescription style={styles.desc}>{description}</ToastDescription>}
            </div>

            {action}
            <ToastClose style={styles.close} />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
