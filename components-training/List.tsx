import React, { ReactNode, forwardRef } from "react";
import "./List.css";

// ============ Types ============

export type ListSize = "sm" | "md" | "lg";
export type ListLayout = "list" | "grid";

export interface ListItemProps<T = any> {
  /** 项的数据 */
  data?: T;
  /** 项的索引 */
  index?: number;
  /** 是否选中 */
  selected?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 左侧内容 */
  leftContent?: ReactNode;
  /** 右侧内容 */
  rightContent?: ReactNode;
  /** 点击处理 */
  onClick?: (data: T, index: number) => void;
  /** 子元素 */
  children?: ReactNode;
  /** 额外类名 */
  className?: string;
}

export interface ListProps<T = any> {
  /** 列表数据 */
  data?: T[];
  /** 列表尺寸 */
  size?: ListSize;
  /** 列表布局 */
  layout?: ListLayout;
  /** 是否显示边框 */
  bordered?: boolean;
  /** 是否显示分割线 */
  split?: boolean;
  /** 是否支持多选 */
  selectable?: boolean;
  /** 选中的项 */
  selectedKeys?: (string | number)[];
  /** 选中变化处理 */
  onSelectionChange?: (keys: (string | number)[]) => void;
  /** 渲染每项 */
  renderItem?: (item: T, index: number) => ReactNode;
  /** 获取项的 key */
  itemKey?: string | ((item: T, index: number) => string | number);
  /** 空状态内容 */
  emptyText?: ReactNode;
  /** 加载中 */
  loading?: boolean;
  /** 子元素 (当不使用 data 时) */
  children?: ReactNode;
  /** 额外类名 */
  className?: string;
  /** 列表头部 */
  header?: ReactNode;
  /** 列表底部 */
  footer?: ReactNode;
}

// ============ ListItem Component ============

export const ListItem = forwardRef<HTMLDivElement, ListItemProps<any>>(
  function ListItem(
    {
      data,
      index = 0,
      selected = false,
      disabled = false,
      leftContent,
      rightContent,
      onClick,
      children,
      className = "",
    },
    ref,
  ) {
    const classes = [
      "list-item",
      selected && "list-item-selected",
      disabled && "list-item-disabled",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const handleClick = () => {
      if (!disabled && onClick) {
        onClick(data, index);
      }
    };

    return (
      <div
        ref={ref}
        className={classes}
        onClick={handleClick}
        role="listitem"
        aria-selected={selected}
        aria-disabled={disabled}
        tabIndex={disabled ? undefined : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleClick();
          }
        }}
      >
        {leftContent && <div className="list-item-left">{leftContent}</div>}
        <div className="list-item-content">{children}</div>
        {rightContent && <div className="list-item-right">{rightContent}</div>}
      </div>
    );
  },
);

// ============ List Component ============

export const List = forwardRef<HTMLDivElement, ListProps<any>>(function List<
  T = any,
>(
  {
    data,
    size = "md",
    layout = "list",
    bordered = false,
    split = true,
    selectable = false,
    selectedKeys = [],
    onSelectionChange,
    renderItem,
    itemKey = "id",
    emptyText = "暂无数据",
    loading = false,
    children,
    className = "",
    header,
    footer,
  },
  ref,
) {
  const classes = [
    "list",
    `list-${size}`,
    `list-${layout}`,
    bordered && "list-bordered",
    split && "list-split",
    loading && "list-loading",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const getKey = (item: T, index: number): string | number => {
    if (typeof itemKey === "function") {
      return itemKey(item, index);
    }
    return (item as any)[itemKey] ?? index;
  };

  const handleItemClick = (item: T, index: number) => {
    if (!selectable) return;

    const key = getKey(item, index);
    const newSelectedKeys = selectedKeys.includes(key)
      ? selectedKeys.filter((k) => k !== key)
      : [...selectedKeys, key];

    onSelectionChange?.(newSelectedKeys);
  };

  const renderContent = () => {
    if (loading) {
      return <div className="list-loading-content">加载中...</div>;
    }

    if (data && data.length > 0) {
      return data.map((item, index) => {
        const key = getKey(item, index);
        const isSelected = selectedKeys.includes(key);

        if (renderItem) {
          return (
            <ListItem
              key={key}
              data={item}
              index={index}
              selected={isSelected}
              onClick={handleItemClick}
            >
              {renderItem(item, index)}
            </ListItem>
          );
        }

        // 默认渲染
        return (
          <ListItem
            key={key}
            data={item}
            index={index}
            selected={isSelected}
            onClick={handleItemClick}
          >
            {typeof item === "string" ? item : JSON.stringify(item)}
          </ListItem>
        );
      });
    }

    if (children) {
      return children;
    }

    return <div className="list-empty">{emptyText}</div>;
  };

  return (
    <div ref={ref} className={classes} role="list">
      {header && <div className="list-header">{header}</div>}
      <div className="list-body">{renderContent()}</div>
      {footer && <div className="list-footer">{footer}</div>}
    </div>
  );
});

// ============ Compound Components ============

List.Item = ListItem;

// ============ Virtual List (for large datasets) ============

export interface VirtualListProps<T = any> extends Omit<
  ListProps<T>,
  "children"
> {
  /** 项的高度 */
  itemHeight?: number;
  /** 缓冲区大小 */
  overscan?: number;
  /** 容器高度 */
  height?: number | string;
}

export const VirtualList = forwardRef<HTMLDivElement, VirtualListProps<any>>(
  function VirtualList(
    { itemHeight = 50, overscan = 5, height = 400, ...listProps },
    ref,
  ) {
    // 简化版本 - 实际项目中应使用 react-window 或 react-virtualized
    const containerStyle: React.CSSProperties = {
      height,
      overflow: "auto",
    };

    return (
      <div ref={ref} style={containerStyle}>
        <List {...listProps} />
      </div>
    );
  },
);

List.Virtual = VirtualList;
