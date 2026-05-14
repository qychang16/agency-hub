// Shared template display utilities
// Format Meta language codes to human-readable display
// Example: 'en' -> 'English', 'en_US' -> 'English (US)'

export const LANGUAGE_DISPLAY = {
  en: 'English',
  en_US: 'English (US)',
  en_GB: 'English (UK)',
  zh_CN: 'Chinese (CN)',
  zh_TW: 'Chinese (TW)',
  ms: 'Malay',
  id: 'Indonesian',
  th: 'Thai',
  vi: 'Vietnamese',
  ja: 'Japanese',
  ko: 'Korean',
  es: 'Spanish',
  pt_BR: 'Portuguese (BR)',
  fr: 'French',
  de: 'German',
}

export function formatLanguage(lang) {
  if (!lang) return 'English'
  return LANGUAGE_DISPLAY[lang] || lang
}

// Status color tokens matching the backend's getTemplateDisplayStatus output
export const STATUS_COLORS = {
  green:  { bg: '#dcfce7', color: '#16a34a' },
  yellow: { bg: '#fef3c7', color: '#92400e' },
  red:    { bg: '#fee2e2', color: '#dc2626' },
  orange: { bg: '#ffedd5', color: '#c2410c' },
  blue:   { bg: '#dbeafe', color: '#1e40af' },
  gray:   { bg: '#f5f3ef', color: '#6e6a63' },
}