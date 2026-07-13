/**
 * Shared design tokens for the Nextarp Document Capture SDK screens.
 * Values are matched against the approved UI mockups (ID vault / scan / review / success).
 */

export const colors = {
  background: '#F4F2FB',
  backgroundSoft: '#F8F6FD',
  cardWhite: '#FFFFFF',

  navy: '#241F45',
  navySubtle: '#3A3564',
  muted: '#8D89A8',
  mutedLight: '#B7B4CC',
  border: '#ECEAF6',

  purple: '#6C4FE0',
  purpleDeep: '#5136B8',
  pink: '#B15AC0',
  orange: '#F0935A',

  cameraBackground: '#0E0C18',
  cameraOverlay: 'rgba(14, 12, 24, 0.55)',
  cameraPillBackground: 'rgba(255, 255, 255, 0.08)',

  success: '#3FBF74',
  danger: '#E5586B',
} as const;

/** Primary brand gradient used on the hero "scan" card, primary buttons, and success check. */
export const primaryGradient = {
  colors: [colors.purple, colors.pink, colors.orange],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

/** Smaller icon-tile gradient, per document type, so each doc keeps a distinct accent. */
export const docTypeGradients: Record<string, string[]> = {
  driving_licence: [colors.purple, colors.pink],
  passport: ['#E0555F', '#F0935A'],
  national_id: [colors.purple, '#8C6AE0'],
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.navy },
  subtitle: { fontSize: 15, fontWeight: '400' as const, color: colors.muted },
  heading: { fontSize: 20, fontWeight: '700' as const, color: colors.navy },
  body: { fontSize: 15, fontWeight: '600' as const, color: colors.navy },
  caption: { fontSize: 13, fontWeight: '400' as const, color: colors.muted },
};
