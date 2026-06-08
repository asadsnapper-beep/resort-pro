import React from 'react';
import { colors, spacing } from './tokens';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
};

const baseStyle: React.CSSProperties = {
  padding: `${spacing.sm}px ${spacing.md}px`,
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
};

const variantStyle = (variant: ButtonProps['variant']): React.CSSProperties => {
  switch (variant) {
    case 'secondary':
      return { background: colors.secondary, color: '#fff' };
    case 'ghost':
      return { background: 'transparent', color: colors.secondary, border: `1px solid ${colors.muted}` };
    default:
      return { background: colors.primary, color: '#fff' };
  }
};

const Button: React.FC<ButtonProps> = ({ variant = 'primary', children, style, ...rest }) => {
  const mergedStyle = { ...baseStyle, ...variantStyle(variant), ...style };
  return (
    <button style={mergedStyle} {...rest}>
      {children}
    </button>
  );
};

export default Button;
