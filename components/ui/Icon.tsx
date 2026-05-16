/**
 * Icon — accessible, consistent Material Symbols wrapper
 *
 * Usage:
 *   <Icon name="dashboard" />                        // decorative, md size, aria-hidden
 *   <Icon name="warning" size="sm" fill />           // filled, sm size, aria-hidden
 *   <Icon name="error" aria-label="Error status" />  // semantic — adds role="img"
 *
 * Size map:
 *   xs → 14px   sm → 18px   md → 20px   lg → 24px   xl → 32px
 */

// ── Size config ───────────────────────────────────────────────────────────────

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_PX: Record<IconSize, number> = {
  xs: 14,
  sm: 18,
  md: 20,
  lg: 24,
  xl: 32,
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface IconProps {
  /** Material Symbols ligature name, e.g. "dashboard", "warning", "check_circle" */
  name:       string
  size?:      IconSize
  /** If true, renders with FILL=1 (solid). Default: false (outline) */
  fill?:      boolean
  className?: string
  /** When provided, icon becomes semantic (adds role="img", removes aria-hidden) */
  'aria-label'?: string
  style?: React.CSSProperties
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Icon({
  name,
  size = 'md',
  fill = false,
  className = '',
  'aria-label': ariaLabel,
  style,
}: IconProps) {
  const px = SIZE_PX[size]

  const iconStyle: React.CSSProperties = {
    fontSize:            `${px}px`,
    width:               `${px}px`,
    minWidth:            `${px}px`,
    maxWidth:            `${px}px`,
    height:              `${px}px`,
    lineHeight:          `${px}px`,
    display:             'block',
    fontVariationSettings: fill ? "'FILL' 1" : "'FILL' 0",
    ...style,
  }

  const isDecorative = !ariaLabel

  return (
    <span
      className={`material-symbols-outlined shrink-0 overflow-hidden ${className}`}
      style={iconStyle}
      aria-hidden={isDecorative ? true : undefined}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
    >
      {name}
    </span>
  )
}
