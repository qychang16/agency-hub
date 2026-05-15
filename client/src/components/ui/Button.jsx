import { useState } from 'react'
import { ink, accent, semantic, fonts, textSize, textWeight, space, radius, border, shadow } from '../../utils/designTokens'

// ----- Tel-Cloud Button ------------------------------------------------------
// Single source of truth for buttons across the app.
//
// Props:
//   variant   primary | secondary | danger | ghost | link | success | meta | suggested
//                                                              (default: primary)
//   size      sm | md | lg                                       (default: md)
//   icon      ReactNode                          renders before label
//   iconRight ReactNode                          renders after label
//   iconOnly  boolean                            square button, icon only
//   loading   boolean                            spinner, click disabled
//   disabled  boolean
//   selected  boolean                            on/active (use with ButtonGroup)
//   fullWidth boolean                            fills container width
//   floating  boolean                            FAB style: pill, shadow
//   onClick   function
//   title     string                             tooltip
//   type      string                             defaults to 'button'
//   children  label content
//
// All visual styling derives from designTokens. No hard-coded colors.

const SIZE_STYLES = {
  sm: {
    padding: `${space[1] + 1}px ${space[2] + 2}px`,        // 5px 10px
    fontSize: textSize.xs,
    iconSize: 12,
    minHeight: 26,
  },
  md: {
    padding: `${space[2]}px ${space[3]}px`,                // 8px 12px
    fontSize: textSize.sm,
    iconSize: 14,
    minHeight: 32,
  },
  lg: {
    padding: `${space[2] + 3}px ${space[4]}px`,            // 11px 16px
    fontSize: textSize.md,
    iconSize: 16,
    minHeight: 40,
  },
}

function getVariantStyles({ variant, hover, pressed, selected, disabled }) {
  switch (variant) {
    case 'primary':
      return {
        background: disabled ? ink[400] : pressed ? '#1e1b4b' : hover ? accent.hover : accent.DEFAULT,
        color: '#fff',
        border: 'none',
      }
    case 'secondary':
      return {
        background: pressed ? ink[200] : selected ? ink[100] : hover ? ink[100] : 'transparent',
        color: ink[800],
        border: `0.5px solid ${ink[300]}`,
      }
    case 'danger':
      return {
        background: disabled ? ink[400] : pressed ? '#5a1818' : hover ? '#7a2424' : semantic.danger,
        color: '#fff',
        border: 'none',
      }
    case 'ghost':
      return {
        background: pressed ? ink[200] : selected ? ink[100] : hover ? ink[100] : 'transparent',
        color: ink[700],
        border: 'none',
      }
    case 'link':
      return {
        background: 'transparent',
        color: pressed ? '#3730a3' : hover ? accent.hover : accent.DEFAULT,
        border: 'none',
        padding: 0,
        minHeight: 'auto',
        textDecoration: hover || pressed ? 'underline' : 'none',
      }
    case 'success':
      return {
        background: disabled ? ink[400] : pressed ? '#15402e' : hover ? '#245c43' : semantic.success,
        color: '#fff',
        border: 'none',
      }
    case 'meta':
      // Meta brand blue. Kept as raw hex because it's a third-party brand color,
      // not part of the Tel-Cloud design system.
      return {
        background: disabled ? ink[400] : pressed ? '#0d52b3' : hover ? '#166fe5' : '#1877f2',
        color: '#fff',
        border: 'none',
      }
    case 'suggested':
      // Recruitment-vertical purple to match the tel_cloud_library section accent
      // on the Templates page.
      return {
        background: disabled ? ink[400] : pressed ? '#2e1065' : hover ? '#4c1d96' : '#5b21b6',
        color: '#fff',
        border: 'none',
      }
    default:
      return {}
  }
}

function Spinner({ size }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.4"
      style={{ animation: 'tcBtnSpin 0.8s linear infinite' }}>
      <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/>
    </svg>
  )
}

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  iconOnly = false,
  loading = false,
  disabled = false,
  selected = false,
  fullWidth = false,
  floating = false,
  onClick,
  title,
  type = 'button',
  children,
  style: extraStyle,
  ...rest
}) {
  const [hover, setHover] = useState(false)
  const [pressed, setPressed] = useState(false)
  const isInactive = disabled || loading

  const sizeS = SIZE_STYLES[size] || SIZE_STYLES.md
  const variantS = getVariantStyles({ variant, hover: hover && !isInactive, pressed: pressed && !isInactive, selected, disabled: isInactive })

  // For icon-only buttons, force square shape
  const iconOnlyOverrides = iconOnly ? {
    padding: 0,
    width: sizeS.minHeight,
    height: sizeS.minHeight,
    minWidth: sizeS.minHeight,
    minHeight: sizeS.minHeight,
    justifyContent: 'center',
  } : {}

  // For floating (FAB), pill + shadow + larger
  const floatingOverrides = floating ? {
    borderRadius: radius.pill,
    padding: variant === 'link' ? 0 : `${space[2] + 1}px ${space[4]}px`,
    boxShadow: shadow.floating,
  } : {}

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: size === 'sm' ? space[1] : space[1] + 2,
    fontFamily: fonts.body,
    fontWeight: textWeight.medium,
    letterSpacing: '0.1px',
    borderRadius: radius.md,
    cursor: isInactive ? 'default' : 'pointer',
    opacity: isInactive ? (loading ? 0.85 : 0.55) : 1,
    transition: 'background 0.08s, color 0.08s, opacity 0.12s, box-shadow 0.12s, transform 0.08s, filter 0.08s',
    whiteSpace: 'nowrap',
    width: fullWidth ? '100%' : undefined,
    ...sizeS,
    ...variantS,
    ...iconOnlyOverrides,
    ...floatingOverrides,
    ...extraStyle,
  }

  return (
    <>
      <style>{`@keyframes tcBtnSpin { to { transform: rotate(360deg) } }`}</style>
      <button
        type={type}
        onClick={isInactive ? undefined : onClick}
        title={title}
        disabled={isInactive}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => { setHover(false); setPressed(false) }}
        onMouseDown={() => !isInactive && setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onTouchStart={() => !isInactive && setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        style={baseStyle}
        {...rest}>
        {loading ? <Spinner size={sizeS.iconSize} /> : icon ? <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span> : null}
        {!iconOnly && children && <span>{children}</span>}
        {!loading && iconRight ? <span style={{ display: 'flex', alignItems: 'center' }}>{iconRight}</span> : null}
      </button>
    </>
  )
}