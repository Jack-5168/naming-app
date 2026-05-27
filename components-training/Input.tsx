import React, { InputHTMLAttributes, forwardRef, useState } from "react";
import "./Input.css";

// ============ Types ============

export type InputType =
  | "text"
  | "password"
  | "email"
  | "number"
  | "tel"
  | "url"
  | "search"
  | "time"
  | "date";

export type InputSize = "sm" | "md" | "lg";

export type InputStatus = "default" | "error" | "success" | "warning";

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  /** 输入类型 */
  type?: InputType;
  /** 输入框尺寸 */
  size?: InputSize;
  /** 输入状态 */
  status?: InputStatus;
  /** 前置标签 */
  prefix?: React.ReactNode;
  /** 后置标签 */
  suffix?: React.ReactNode;
  /** 是否可清除 */
  allowClear?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 错误提示 */
  errorMessage?: string;
  /** 子元素 */
  children?: React.ReactNode;
}

// ============ Component ============

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    type = "text",
    size = "md",
    status = "default",
    prefix,
    suffix,
    allowClear = false,
    className = "",
    value,
    onChange,
    disabled,
    errorMessage,
    ...props
  },
  ref,
) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value !== undefined ? value !== "" && value !== null : false;

  const classes = [
    "input-wrapper",
    `input-${size}`,
    `input-${status}`,
    isFocused && "input-focused",
    disabled && "input-disabled",
    prefix && "input-has-prefix",
    suffix && "input-has-suffix",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const handleClear = () => {
    if (onChange) {
      onChange({
        target: { value: "" },
      } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  return (
    <div className={classes}>
      {prefix && <span className="input-prefix">{prefix}</span>}
      <input
        ref={ref}
        type={type}
        className="input-field"
        value={value}
        onChange={onChange}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        disabled={disabled}
        aria-invalid={status === "error"}
        aria-describedby={
          status === "error" && errorMessage ? "input-error" : undefined
        }
        {...props}
      />
      {allowClear && hasValue && !disabled && (
        <button
          type="button"
          className="input-clear"
          onClick={handleClear}
          aria-label="清除"
        >
          ×
        </button>
      )}
      {suffix && <span className="input-suffix">{suffix}</span>}
      {status === "error" && errorMessage && (
        <span id="input-error" className="input-error-message" role="alert">
          {errorMessage}
        </span>
      )}
    </div>
  );
});

// ============ Compound Components ============

export const InputGroup: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => {
  return <div className={`input-group ${className}`}>{children}</div>;
};

Input.Group = InputGroup;
