// ─── TEL-CLOUD DESIGN TOKENS ──────────────────────────────────────────────────
// Single source of truth for all visual styling across the app.
// Import from here everywhere — never hard-code hex values in components.

// ─── COLOUR ───────────────────────────────────────────────────────────────────
// Neutral "ink" ramp — warm off-whites through to near-black.
// Deliberately warm (not cool grey) so the app doesn't feel generic-SaaS.
export const ink = {
  50:  '#faf9f7',  // page background
  100: '#f5f3ef',  // subtle surface (hover states, sub-panels)
  200: '#ebe8e2',  // muted surface
  300: '#dcd8d0',  // borders (use 0.5px)
  400: '#c2bdb3',  // dividers
  500: '#9a958c',  // disabled / placeholder
  600: '#6e6a63',  // tertiary text (timestamps, meta, hints)
  700: '#4a4742',  // secondary text (labels, captions)
  800: '#14130f',  // primary text (names, message body, titles)
  900: '#0a0907',  // headings / highest contrast
}

// Single accent — Library Indigo. Used sparingly: primary buttons,
// active-state rails, links. NEVER use as a background for large areas.
export const accent = {
  DEFAULT: '#2d2a7a',  // Library Indigo
  soft:    '#eeedf5',  // for subtle active backgrounds and avatars
  hover:   '#24216a',  // darker variant for button hover
  text:    '#2d2a7a',  // same as default, named for clarity when used for text
}

// Semantic colours — status only, never decorative.
export const semantic = {
  success:      '#2d6a4f',
  successSoft:  '#e7efe9',
  warning:      '#9a6a00',
  warningSoft:  '#f5ecd9',
  danger:       '#8e2a2a',
  dangerSoft:   '#f0dfdf',
}

// ─── TYPOGRAPHY ───────────────────────────────────────────────────────────────
export const fonts = {
  display: "'Satoshi', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  body:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:    "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
}

// Type scale — limited on purpose. Stick to these sizes.
export const textSize = {
  xs:      '11px',   // tags, meta
  sm:      '12px',   // body small, UI text
  md:      '13px',   // body default
  lg:      '15px',   // emphasised body
  xl:      '22px',   // section titles — bumped for more presence
  xl2:     '28px',   // page titles — bumped
  display: '34px',   // hero / login — bumped
}

export const textWeight = {
  regular:  400,
  medium:   500,
  semibold: 600,
  bold:     700,
}

// Uppercase micro-labels (e.g. "CONTACT") — used for section headers
export const microLabel = {
  fontSize:       '10px',
  fontWeight:     600,
  letterSpacing:  '1.2px',
  textTransform:  'uppercase',
  color:          ink[600],
}

// ─── SPACING ──────────────────────────────────────────────────────────────────
// 4px scale — use these numbers, don't invent 7s, 9s, 11s, etc.
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
}

// ─── RADIUS ───────────────────────────────────────────────────────────────────
// Three sizes only — sm for chips/tags, md for buttons/inputs/cards, lg for modals.
export const radius = {
  sm: 3,
  md: 4,
  lg: 6,
  pill: 999,
}

// ─── BORDERS & SHADOWS ────────────────────────────────────────────────────────
export const border = {
  subtle: `0.5px solid ${ink[300]}`,   // default internal border
  strong: `1px solid ${ink[400]}`,     // emphasised (rare)
  focus:  `1px solid ${accent.DEFAULT}`,
}

export const shadow = {
  none:    'none',
  subtle:  '0 1px 2px rgba(10, 9, 7, 0.04)',
  floating:'0 8px 24px rgba(10, 9, 7, 0.08), 0 2px 6px rgba(10, 9, 7, 0.04)',
  overlay: '0 24px 60px rgba(10, 9, 7, 0.18)',
}

// ─── LEGACY BRIDGE ────────────────────────────────────────────────────────────
// During refactor, some old code still imports these from constants.js.
// Re-export under the old names so we can migrate incrementally.
export const ACCENT = accent.DEFAULT
export const ACCENT_LIGHT = accent.soft
export const ACCENT_MID = accent.DEFAULT
export const NAVY = ink[900]

// ─── EXPORT ALL AS SINGLE OBJECT FOR CONVENIENCE ──────────────────────────────
export const tokens = {
  ink, accent, semantic,
  fonts, textSize, textWeight, microLabel,
  space, radius, border, shadow,
}

export default tokens