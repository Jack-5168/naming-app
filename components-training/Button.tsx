import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import './Button.css';

// ============ Types ============

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮变体 */
  variant?: ButtonVariant;
  /** 按钮尺寸 */
  size?: ButtonSize;
  /** 加载状态 */
  loading?: boolean;
  /** 是否全宽 */
  fullWidth?: boolean;
  /** 左侧图标 */
  leftIcon?: React.ReactNode;
  /** 右侧图标 */
  rightIcon?: React.ReactNode;
  /** 是否只有图标 */
  iconOnly?: boolean;
  /** 子元素 */
  children?: React.ReactNode;
}

// ============ Component ============

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    iconOnly = false,
    className = '',
    children,
    disabled,
    ...props
  },
  ref
) {
  const classes = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth && 'btn-full-width',
    iconOnly && 'btn-icon-only',
    loading && 'btn-loading',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="btn-spinner" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
          </svg>
        </span>
      )}
      {leftIcon && <span className="btn-icon-left">{leftIcon}</span>}
      {!iconOnly && <span className="btn-content">{children}</span>}
      {rightIcon && <span className="btn-icon-right">{rightIcon}</span>}
    </button>
  );
});

// ============ Compound Components ============

export const ButtonGroup: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={`btn-group ${className}`} role="group">
      {children}
    </div>
  );
};

Button.Group = ButtonGroup;
