// SPDX-FileCopyrightText: 2026 Docusign, Inc.
// SPDX-License-Identifier: MIT

/**
 * Lightweight, dependency-free UI primitives for the DevTools panel.
 *
 * These components replace the internal design-system package with plain
 * HTML/CSS so the extension can be built and released as open source without
 * any private dependencies. They intentionally cover only the small surface
 * the panel uses — they are not a general-purpose component library.
 */

import React from 'react';

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

/** Placeholder theme token kept for API compatibility with the panel. */
export const InkDocuSignTheme = { name: 'ink' } as const;

interface ThemeProps {
  docuSignTheme?: unknown;
  enableFontFaceDeclarations?: boolean;
  enableGlobalCss?: boolean;
  children: React.ReactNode;
}

const GLOBAL_CSS = `
  .glob-ui, .glob-ui * { box-sizing: border-box; }
  .glob-ui {
    font-family: ${FONT_STACK};
    color: #1f2937;
    font-size: 14px;
    line-height: 1.5;
    width: 100%;
  }
  @keyframes glob-spin { to { transform: rotate(360deg); } }
`;

/** Root wrapper that applies base typography and global styles. */
export const Theme: React.FC<ThemeProps> = ({ children }) => (
  <div className="glob-ui">
    <style>{GLOBAL_CSS}</style>
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Heading
// ---------------------------------------------------------------------------

interface HeadingProps {
  level: '1' | '2' | '3';
  text: React.ReactNode;
}

export const Heading: React.FC<HeadingProps> = ({ level, text }) => {
  const size = level === '1' ? '24px' : level === '2' ? '19px' : '16px';
  const style: React.CSSProperties = { margin: 0, fontSize: size, fontWeight: 700 };
  if (level === '1') return <h1 style={style}>{text}</h1>;
  if (level === '2') return <h2 style={style}>{text}</h2>;
  return <h3 style={style}>{text}</h3>;
};

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

interface ButtonProps {
  text: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  kind?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
}

export const Button: React.FC<ButtonProps> = ({
  text,
  onClick,
  disabled = false,
  loading = false,
  kind = 'primary',
  size = 'medium',
}) => {
  const padding = size === 'small' ? '4px 12px' : size === 'large' ? '12px 24px' : '8px 16px';
  const isPrimary = kind === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding,
        fontSize: '14px',
        fontWeight: 600,
        fontFamily: FONT_STACK,
        borderRadius: '6px',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
        border: isPrimary ? '1px solid #4c00ff' : '1px solid #cbd5e1',
        backgroundColor: isPrimary ? '#4c00ff' : '#ffffff',
        color: isPrimary ? '#ffffff' : '#1f2937',
      }}
    >
      {loading && (
        <span
          aria-hidden
          style={{
            width: '14px',
            height: '14px',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'glob-spin 0.7s linear infinite',
          }}
        />
      )}
      {text}
    </button>
  );
};

// ---------------------------------------------------------------------------
// Checkbox / CheckboxGroup
// ---------------------------------------------------------------------------

interface CheckboxProps {
  label: React.ReactNode;
  checked: boolean;
  onChange: () => void;
  description?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, checked, onChange, description }) => (
  <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      style={{ marginTop: '3px', width: '16px', height: '16px', cursor: 'pointer' }}
    />
    <span>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {description && (
        <span style={{ display: 'block', color: '#6b7280', fontSize: '12px' }}>{description}</span>
      )}
    </span>
  </label>
);

interface CheckboxGroupProps {
  legend?: string;
  children: React.ReactNode;
}

export const CheckboxGroup: React.FC<CheckboxGroupProps> = ({ legend, children }) => (
  <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
    {legend && (
      <legend style={{ fontWeight: 700, padding: 0, marginBottom: '12px' }}>{legend}</legend>
    )}
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>{children}</div>
  </fieldset>
);

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

interface BannerProps {
  kind?: 'danger' | 'warning' | 'info' | 'success';
  visible?: boolean;
  children: React.ReactNode;
}

const BANNER_COLORS: Record<string, { bg: string; border: string; fg: string }> = {
  danger: { bg: '#fef2f2', border: '#fecaca', fg: '#991b1b' },
  warning: { bg: '#fffbeb', border: '#fde68a', fg: '#92400e' },
  info: { bg: '#eff6ff', border: '#bfdbfe', fg: '#1e40af' },
  success: { bg: '#f0fdf4', border: '#bbf7d0', fg: '#166534' },
};

export const Banner: React.FC<BannerProps> = ({ kind = 'info', visible = true, children }) => {
  if (!visible) return null;
  const c = BANNER_COLORS[kind] ?? BANNER_COLORS.info;
  return (
    <div
      role="alert"
      style={{
        padding: '12px 16px',
        borderRadius: '6px',
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        color: c.fg,
        fontSize: '14px',
        width: '100%',
      }}
    >
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ProgressBar
// ---------------------------------------------------------------------------

interface ProgressBarProps {
  label?: string;
  value: number;
  max: number;
  kind?: 'info' | 'success' | 'warning';
  content?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ label, value, max, content }) => (
  <div style={{ width: '100%' }}>
    {(label || content) && (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '4px',
          fontSize: '13px',
          color: '#374151',
        }}
      >
        <span>{label}</span>
        <span>{content}</span>
      </div>
    )}
    <progress
      value={value}
      max={max}
      style={{ width: '100%', height: '8px', accentColor: '#4c00ff' }}
    />
  </div>
);

// ---------------------------------------------------------------------------
// Accordion
// ---------------------------------------------------------------------------

interface AccordionProps {
  children: React.ReactNode;
}

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
}

const AccordionItem: React.FC<AccordionItemProps> = ({ title, children }) => (
  <details
    style={{
      border: '1px solid #e1e5e9',
      borderRadius: '6px',
      marginBottom: '8px',
      overflow: 'hidden',
    }}
  >
    <summary
      style={{
        padding: '12px 16px',
        fontWeight: 600,
        cursor: 'pointer',
        backgroundColor: '#f9fafb',
        listStyle: 'revert',
      }}
    >
      {title}
    </summary>
    <div style={{ padding: '0 16px' }}>{children}</div>
  </details>
);

type AccordionComponent = React.FC<AccordionProps> & { Item: typeof AccordionItem };

export const Accordion: AccordionComponent = Object.assign(
  ({ children }: AccordionProps) => <div style={{ width: '100%' }}>{children}</div>,
  { Item: AccordionItem },
);

// ---------------------------------------------------------------------------
// Meter
// ---------------------------------------------------------------------------

interface MeterProps {
  kind?: 'semantic';
  value: number;
  min: number;
  max: number;
  low?: number;
  high?: number;
  optimum?: number;
  label?: string;
  content?: string;
}

export const Meter: React.FC<MeterProps> = ({
  value,
  min,
  max,
  low,
  high,
  optimum,
  label,
  content,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    {label && <span style={{ fontSize: '13px', fontWeight: 600 }}>{label}</span>}
    <meter
      value={value}
      min={min}
      max={max}
      low={low}
      high={high}
      optimum={optimum}
      style={{ width: '100%', height: '10px' }}
    />
    {content && <span style={{ fontSize: '12px', color: '#374151' }}>{content}</span>}
  </div>
);

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

type StatusKind = 'warning' | 'emphasis' | 'promo' | 'subtle' | 'success' | 'alert' | 'promoSubtle';

interface StatusBadgeProps {
  text: string;
  kind?: StatusKind;
}

const STATUS_COLORS: Record<StatusKind, { bg: string; fg: string }> = {
  alert: { bg: '#fee2e2', fg: '#991b1b' },
  warning: { bg: '#fef3c7', fg: '#92400e' },
  emphasis: { bg: '#dbeafe', fg: '#1e40af' },
  promo: { bg: '#ede9fe', fg: '#5b21b6' },
  promoSubtle: { bg: '#f5f3ff', fg: '#6d28d9' },
  success: { bg: '#dcfce7', fg: '#166534' },
  subtle: { bg: '#f3f4f6', fg: '#374151' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ text, kind = 'subtle' }) => {
  const c = STATUS_COLORS[kind] ?? STATUS_COLORS.subtle;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 700,
        backgroundColor: c.bg,
        color: c.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
};
