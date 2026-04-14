export const COLORS = {
  primary: '#2E86AB',
  secondary: '#A23B72',
  accent: '#F18F01',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  muted: '#6C757D',
  border: '#E9ECEF',
  danger: '#E74C3C',
  warning: '#FFC107',
  success: '#28A745',
}

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
}

export const TYPOGRAPHY = {
  heading1: { fontSize: 28, fontWeight: '700' as const },
  heading2: { fontSize: 22, fontWeight: '700' as const },
  heading3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodySmall: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
}

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
}