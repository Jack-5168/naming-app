import React, { 
  FormHTMLAttributes, 
  forwardRef, 
  createContext, 
  useContext, 
  useState,
  useCallback,
  ReactNode 
} from 'react';
import './Form.css';

// ============ Types ============

export type FormLayout = 'horizontal' | 'vertical' | 'inline';
export type FormStatus = 'default' | 'error' | 'success';

export interface FormFieldContextValue {
  name?: string;
  status?: FormStatus;
  errorMessage?: string;
}

const FormFieldContext = createContext<FormFieldContextValue>({});

export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  /** 表单布局 */
  layout?: FormLayout;
  /** 标签宽度 (horizontal 模式下) */
  labelWidth?: number | string;
  /** 提交处理 */
  onSubmit?: (data: Record<string, any>) => void | Promise<void>;
  /** 表单数据 */
  formData?: Record<string, any>;
  /** 子元素 */
  children?: ReactNode;
}

export interface FieldProps {
  /** 字段名称 */
  name?: string;
  /** 字段标签 */
  label?: ReactNode;
  /** 是否必填 */
  required?: boolean;
  /** 字段状态 */
  status?: FormStatus;
  /** 错误提示 */
  errorMessage?: string;
  /** 帮助文本 */
  helpText?: string;
  /** 子元素 */
  children?: ReactNode;
  /** 额外类名 */
  className?: string;
}

export interface FormActionsProps {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

// ============ Component ============

export const Form = forwardRef<HTMLFormElement, FormProps>(function Form(
  {
    layout = 'vertical',
    labelWidth,
    onSubmit,
    formData,
    className = '',
    children,
    ...props
  },
  ref
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!onSubmit) return;
    
    setIsSubmitting(true);
    try {
      // 收集表单数据
      const formElement = e.target as HTMLFormElement;
      const form = new FormData(formElement);
      const data = Object.fromEntries(form.entries());
      
      await onSubmit(data);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [onSubmit]);

  const classes = [
    'form',
    `form-${layout}`,
    className,
  ].filter(Boolean).join(' ');

  const style = labelWidth ? { '--form-label-width': labelWidth } as React.CSSProperties : undefined;

  return (
    <form
      ref={ref}
      className={classes}
      style={style}
      onSubmit={handleSubmit}
      noValidate
      {...props}
    >
      <FormContext.Provider value={{ isSubmitting, fieldErrors, setFieldErrors }}>
        {children}
      </FormContext.Provider>
    </form>
  );
});

// ============ Form Context ============

interface FormContextValue {
  isSubmitting: boolean;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

const FormContext = createContext<FormContextValue>({
  isSubmitting: false,
  fieldErrors: {},
  setFieldErrors: () => {},
});

export const useFormContext = () => useContext(FormContext);

// ============ Field Component ============

export const Field = forwardRef<HTMLDivElement, FieldProps>(function Field(
  {
    name,
    label,
    required = false,
    status = 'default',
    errorMessage,
    helpText,
    children,
    className = '',
  },
  ref
) {
  const { fieldErrors } = useFormContext();
  
  const fieldStatus = status || (fieldErrors[name || ''] ? 'error' : 'default');
  const fieldError = errorMessage || fieldErrors[name || ''];

  const classes = [
    'form-field',
    `form-field-${fieldStatus}`,
    required && 'form-field-required',
    className,
  ].filter(Boolean).join(' ');

  return (
    <FormFieldContext.Provider value={{ name, status: fieldStatus, errorMessage: fieldError }}>
      <div ref={ref} className={classes}>
        {label && (
          <label className="form-label">
            {label}
            {required && <span className="form-required-mark" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="form-control">
          {children}
          {fieldError && (
            <span className="form-error-message" role="alert">
              {fieldError}
            </span>
          )}
          {helpText && !fieldError && (
            <span className="form-help-text">{helpText}</span>
          )}
        </div>
      </div>
    </FormFieldContext.Provider>
  );
});

Form.Field = Field;

// ============ Actions Component ============

export const Actions: React.FC<FormActionsProps> = ({ 
  children, 
  className = '', 
  align = 'right' 
}) => {
  return (
    <div className={`form-actions form-actions-${align} ${className}`}>
      {children}
    </div>
  );
};

Form.Actions = Actions;

// ============ useForm Hook ============

export function useForm<T extends Record<string, unknown>>(options?: {
  initialValues?: T;
  onSubmit?: (values: T) => void | Promise<void>;
  validate?: (values: T) => Record<string, string>;
}) {
  const { initialValues, onSubmit, validate } = options || {};
  const [values, setValues] = useState<T>(initialValues || {} as T);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback((name: keyof T, value: unknown) => {
    setValues(prev => ({ ...prev, [name]: value }));
    // 清除错误
    if (errors[name]) {
      setErrors(prev => {
        const { [name]: _, ...rest } = prev;
        return rest;
      });
    }
  }, [errors]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (validate) {
      const validationErrors = validate(values);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
    }

    if (!onSubmit) return;

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validate, onSubmit]);

  return {
    values,
    errors,
    isSubmitting,
    handleChange,
    handleSubmit,
    setValues,
    setErrors,
  };
}
