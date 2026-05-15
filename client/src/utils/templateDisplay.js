// Shared template display utilities
// Format Meta language codes to human-readable display.
// Single source of truth for the language list lives in templateLanguages.js.

import { TEMPLATE_LANGUAGE_LABELS } from './templateLanguages'

export function formatLanguage(lang) {
  if (!lang) return 'English'
  return TEMPLATE_LANGUAGE_LABELS[lang] || lang
}

// Backwards-compat export. Kept in case anything else in the codebase imports it.
export const LANGUAGE_DISPLAY = TEMPLATE_LANGUAGE_LABELS

// Status color tokens matching the backend's getTemplateDisplayStatus output
export const STATUS_COLORS = {
  green:  { bg: '#dcfce7', color: '#16a34a' },
  yellow: { bg: '#fef3c7', color: '#92400e' },
  red:    { bg: '#fee2e2', color: '#dc2626' },
  orange: { bg: '#ffedd5', color: '#c2410c' },
  blue:   { bg: '#dbeafe', color: '#1e40af' },
  gray:   { bg: '#f5f3ef', color: '#6e6a63' },
}