export const colors = {
  background: {
    base: '#f5f8ff',
    subtle: '#ecf1ff',
    muted: '#dee6ff',
    inverse: '#0b1225'
  },
  foreground: {
    base: '#101b36',
    muted: '#3f4c70',
    subtle: '#5a678b',
    inverse: '#ffffff'
  },
  accent: {
    primary: '#15306b',
    primaryHover: '#1d3f8b',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#2563eb'
  },
  border: {
    base: '#d7e1ff',
    strong: '#b9c8ff',
    focus: '#8fa8ff'
  }
};

export const spacing = {
  none: '0px',
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px'
};

export const radius = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px'
};

export const typography = {
  fontFamily: {
    sans: 'var(--font-geist-sans, Inter, system-ui)',
    mono: 'var(--font-geist-mono, Menlo, monospace)'
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem'
  },
  lineHeight: {
    tight: '1.2',
    snug: '1.35',
    normal: '1.5',
    relaxed: '1.7'
  }
};

export const shadows = {
  xs: '0 1px 2px 0 rgb(16 27 54 / 0.08)',
  sm: '0 4px 12px -6px rgb(16 27 54 / 0.15), 0 1px 3px 0 rgb(16 27 54 / 0.06)',
  md: '0 18px 40px -24px rgb(21 48 107 / 0.45), 0 12px 24px -18px rgb(21 48 107 / 0.32)',
  lg: '0 32px 70px -36px rgb(16 34 73 / 0.55)'
};

export const transitions = {
  default: 'all 0.2s ease-in-out'
};

export const semanticTokens = {
  button: {
    primary: {
      background: colors.accent.primary,
      foreground: colors.foreground.inverse,
      hover: colors.accent.primaryHover
    },
    secondary: {
      background: colors.background.base,
      foreground: colors.accent.primary,
      hover: colors.background.subtle
    },
    outline: {
      border: colors.border.base,
      foreground: colors.accent.primary,
      hoverBorder: colors.border.focus,
      hoverBackground: colors.background.subtle
    },
    danger: {
      background: colors.accent.danger,
      hover: '#da3a45',
      foreground: colors.foreground.inverse
    }
  },
  badge: {
    neutral: {
      background: colors.background.muted,
      foreground: colors.foreground.base
    },
    success: {
      background: '#e6fdf4',
      foreground: '#0c9a6f'
    },
    warning: {
      background: '#fff6db',
      foreground: '#b07909'
    },
    danger: {
      background: '#fee7ea',
      foreground: '#d13c3c'
    },
    info: {
      background: '#e3f3ff',
      foreground: '#1d8dd9'
    }
  },
  card: {
    background: colors.background.base,
    border: colors.border.base,
    shadow: shadows.md
  }
};

export const tokens = {
  colors,
  spacing,
  radius,
  typography,
  shadows,
  transitions,
  semantic: semanticTokens
};

export type TokenCollection = typeof tokens;

