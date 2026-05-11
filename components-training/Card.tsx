import React, { ReactNode, forwardRef } from 'react';
import './Card.css';

// ============ Types ============

export type CardSize = 'sm' | 'md' | 'lg';
export type CardVariant = 'default' | 'bordered' | 'shadow';

export interface CardProps {
  /** 标题 */
  title?: ReactNode;
  /** 右上角额外内容 */
  extra?: ReactNode;
  /** 封面 */
  cover?: ReactNode;
  /** 子元素 */
  children?: ReactNode;
  /** 尺寸 */
  size?: CardSize;
  /** 变体 */
  variant?: CardVariant;
  /** 是否可悬停 */
  hoverable?: boolean;
  /** 是否可点击 */
  clickable?: boolean;
  /** 加载中 */
  loading?: boolean;
  /** 是否显示边框 */
  bordered?: boolean;
  /** 点击处理 */
  onClick?: (e: React.MouseEvent) => void;
  /** 底部操作区 */
  actions?: ReactNode[];
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

export interface CardMetaProps {
  /** 头像 */
  avatar?: ReactNode;
  /** 标题 */
  title?: ReactNode;
  /** 描述 */
  description?: ReactNode;
}

export interface CardGridProps {
  /** 子元素 */
  children?: ReactNode;
  /** 列数 */
  columns?: number;
  /** 间距 */
  gap?: number;
  /** 自定义类名 */
  className?: string;
}

// ============ Card Component ============

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    title,
    extra,
    cover,
    children,
    size = 'md',
    variant = 'default',
    hoverable = false,
    clickable = false,
    loading = false,
    bordered = true,
    onClick,
    actions,
    className = '',
    style,
  },
  ref
) {
  const classes = [
    'card',
    `card-${size}`,
    `card-${variant}`,
    bordered && 'card-bordered',
    hoverable && 'card-hoverable',
    clickable && 'card-clickable',
    loading && 'card-loading',
    className,
  ].filter(Boolean).join(' ');

  const handleClick = (e: React.MouseEvent) => {
    if (clickable && onClick) {
      onClick(e);
    }
  };

  // 骨架屏加载状态
  if (loading) {
    return (
      <div ref={ref} className={`${classes} card-skeleton`} style={style}>
        {cover && <div className="skeleton-cover" />}
        {title && <div className="skeleton-title" />}
        <div className="skeleton-body">
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line-short" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={classes}
      style={style}
      onClick={handleClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.(e as any);
        }
      }}
    >
      {/* 封面 */}
      {cover && <div className="card-cover">{cover}</div>}

      {/* 头部 */}
      {(title || extra) && (
        <div className="card-header">
          {title && <div className="card-title">{title}</div>}
          {extra && <div className="card-extra">{extra}</div>}
        </div>
      )}

      {/* 主体 */}
      <div className="card-body">{children}</div>

      {/* 底部操作区 */}
      {actions && actions.length > 0 && (
        <div className="card-actions">
          {actions.map((action, index) => (
            <div key={index} className="card-action-item">
              {action}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ============ CardMeta Component ============

export const CardMeta: React.FC<CardMetaProps> = ({
  avatar,
  title,
  description,
}) => {
  return (
    <div className="card-meta">
      {avatar && <div className="card-meta-avatar">{avatar}</div>}
      <div className="card-meta-content">
        {title && <div className="card-meta-title">{title}</div>}
        {description && (
          <div className="card-meta-description">{description}</div>
        )}
      </div>
    </div>
  );
};

// ============ CardGrid Component ============

export const CardGrid: React.FC<CardGridProps> = ({
  children,
  columns = 3,
  gap = 16,
  className = '',
}) => {
  const style: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: `${gap}px`,
  };

  return (
    <div className={`card-grid ${className}`} style={style}>
      {children}
    </div>
  );
};

// ============ Compound Components ============

Card.Meta = CardMeta;
Card.Grid = CardGrid;
