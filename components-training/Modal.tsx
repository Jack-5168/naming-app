import React, { 
  ReactNode, 
  forwardRef, 
  useEffect, 
  useCallback,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

// ============ Types ============

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';

export interface ModalProps {
  /** 是否显示 */
  open: boolean;
  /** 关闭处理 */
  onClose: () => void;
  /** 标题 */
  title?: ReactNode;
  /** 是否显示关闭按钮 */
  closable?: boolean;
  /** 点击遮罩关闭 */
  maskClosable?: boolean;
  /** 按 ESC 关闭 */
  keyboard?: boolean;
  /** 模态框尺寸 */
  size?: ModalSize;
  /** 是否显示遮罩 */
  mask?: boolean;
  /** 是否居中 */
  centered?: boolean;
  /** 底部内容 */
  footer?: ReactNode;
  /** 取消按钮文本 */
  cancelText?: string;
  /** 确认按钮文本 */
  okText?: string;
  /** 确认按钮处理 */
  onOk?: () => void | Promise<void>;
  /** 确认按钮加载 */
  okLoading?: boolean;
  /** 确认按钮禁用 */
  okButtonDisabled?: boolean;
  /** 是否显示底部 */
  showFooter?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 自定义遮罩类名 */
  maskClassName?: string;
  /** 子元素 */
  children?: ReactNode;
  /** 动画持续时间 (ms) */
  animationDuration?: number;
  /** 销毁时关闭动画 */
  destroyOnClose?: boolean;
}

// ============ Component ============

export const Modal = forwardRef<HTMLDivElement, ModalProps>(function Modal(
  {
    open = false,
    onClose,
    title,
    closable = true,
    maskClosable = true,
    keyboard = true,
    size = 'md',
    mask = true,
    centered = false,
    footer,
    cancelText = '取消',
    okText = '确定',
    onOk,
    okLoading = false,
    okButtonDisabled = false,
    showFooter = true,
    className = '',
    maskClassName = '',
    children,
    animationDuration = 300,
    destroyOnClose = false,
  },
  ref
) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(open);
  const [animate, setAnimate] = useState(open);

  useEffect(() => {
    if (open) {
      setVisible(true);
      // 延迟触发动画
      requestAnimationFrame(() => setAnimate(true));
    } else {
      setAnimate(false);
      const timer = setTimeout(() => setVisible(false), animationDuration);
      return () => clearTimeout(timer);
    }
  }, [open, animationDuration]);

  // ESC 关闭
  useEffect(() => {
    if (!keyboard || !open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [keyboard, open, onClose]);

  // 阻止背景滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // 焦点管理
  useEffect(() => {
    if (open && modalRef.current) {
      const focusable = modalRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }
  }, [open]);

  const handleMaskClick = useCallback(() => {
    if (maskClosable) {
      onClose();
    }
  }, [maskClosable, onClose]);

  const handleModalClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleOk = useCallback(async () => {
    if (okLoading || okButtonDisabled) return;
    
    if (onOk) {
      await onOk();
    }
    onClose();
  }, [onOk, okLoading, okButtonDisabled, onClose]);

  const classes = [
    'modal',
    `modal-${size}`,
    centered && 'modal-centered',
    className,
  ].filter(Boolean).join(' ');

  const maskClasses = [
    'modal-mask',
    animate && 'modal-mask-visible',
    maskClassName,
  ].filter(Boolean).join(' ');

  const modalClasses = [
    'modal-content',
    animate && 'modal-content-visible',
  ].filter(Boolean).join(' ');

  // 销毁时不渲染
  if (destroyOnClose && !visible) {
    return null;
  }

  // 只在挂载后渲染到 portal
  if (typeof window === 'undefined') {
    return null;
  }

  const modalElement = (
    <div
      className="modal-wrapper"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {mask && (
        <div
          className={maskClasses}
          onClick={handleMaskClick}
          aria-hidden="true"
        />
      )}
      <div className={classes}>
        <div
          ref={modalRef}
          className={modalClasses}
          onClick={handleModalClick}
        >
          {/* Header */}
          {(title || closable) && (
            <div className="modal-header">
              {title && (
                <h2 id="modal-title" className="modal-title">
                  {title}
                </h2>
              )}
              {closable && (
                <button
                  className="modal-close"
                  onClick={onClose}
                  aria-label="关闭"
                  type="button"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="modal-body">
            {children}
          </div>

          {/* Footer */}
          {showFooter && (
            <div className="modal-footer">
              {footer !== undefined ? (
                footer
              ) : (
                <>
                  <button
                    className="modal-btn modal-btn-cancel"
                    onClick={onClose}
                    disabled={okLoading}
                    type="button"
                  >
                    {cancelText}
                  </button>
                  <button
                    className="modal-btn modal-btn-ok"
                    onClick={handleOk}
                    disabled={okButtonDisabled || okLoading}
                    type="button"
                  >
                    {okLoading ? (
                      <span className="modal-btn-loading">
                        <svg viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                        </svg>
                        加载中...
                      </span>
                    ) : (
                      okText
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
});

// ============ Modal Methods (Imperative API) ============

export interface ModalInstance {
  destroy: () => void;
  update: (config: Partial<ModalProps>) => void;
}

export function modal(config: Omit<ModalProps, 'open' | 'onClose'>): ModalInstance {
  // 简化实现 - 实际项目中需要更复杂的状态管理
  const container = document.createElement('div');
  document.body.appendChild(container);
  
  // 这里应该使用 React 渲染
  // 简化版本仅作为 API 设计示例
  
  return {
    destroy: () => {
      document.body.removeChild(container);
    },
    update: () => {
      // 更新配置
    },
  };
}

Modal.info = (config: { title?: ReactNode; content?: ReactNode; onOk?: () => void }) => {
  return modal({ ...config, type: 'info' });
};

Modal.success = (config: { title?: ReactNode; content?: ReactNode; onOk?: () => void }) => {
  return modal({ ...config, type: 'success' });
};

Modal.warning = (config: { title?: ReactNode; content?: ReactNode; onOk?: () => void }) => {
  return modal({ ...config, type: 'warning' });
};

Modal.error = (config: { title?: ReactNode; content?: ReactNode; onOk?: () => void }) => {
  return modal({ ...config, type: 'error' });
};

Modal.confirm = (config: { 
  title?: ReactNode; 
  content?: ReactNode; 
  onOk?: () => void; 
  onCancel?: () => void;
}) => {
  return modal({ ...config, type: 'confirm' });
};
