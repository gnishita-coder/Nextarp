/**
 * Shared design tokens for the Nextarp Document Capture SDK screens.
 * Values are matched against the approved UI mockups (ID vault / scan / review / success).
 */

import { Platform, type ViewStyle } from 'react-native';

export const colors = {
  background: '#F8F7FC',
  backgroundSoft: '#F3F1FA',
  cardWhite: '#FFFFFF',

  navy: '#211C3E',
  navySubtle: '#4B4668',
  muted: '#8A86A1',
  mutedLight: '#B7B3C8',
  border: '#EAE7F2',

  purple: '#6847D8',
  purpleDeep: '#5433C2',
  purpleSoft: '#EEE9FF',
  pink: '#A94FC1',
  orange: '#EA795D',

  cameraBackground: '#0E0C18',
  cameraOverlay: 'rgba(14, 12, 24, 0.55)',
  cameraPillBackground: 'rgba(255, 255, 255, 0.08)',

  success: '#36B96C',
  successSoft: '#EAF9F0',
  danger: '#EF5B61',
  dangerSoft: '#FFF0F1',
  warning: '#F1A84A',
} as const;

/** Primary brand gradient used on the hero "scan" card, primary buttons, and success check. */
export const primaryGradient = {
  colors: [colors.purpleDeep, colors.purple, colors.pink],
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
  sm: 8,
  md: 14,
  lg: 20,
  xl: 24,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 36,
};

export const typography = {
  title: { fontSize: 24, fontWeight: '800' as const, color: colors.navy },
  subtitle: { fontSize: 13, fontWeight: '400' as const, color: colors.muted },
  heading: { fontSize: 18, fontWeight: '800' as const, color: colors.navy },
  body: { fontSize: 14, fontWeight: '600' as const, color: colors.navy },
  caption: { fontSize: 12, fontWeight: '400' as const, color: colors.muted },
};

/** Cross-platform shadows tuned so iOS matches the softer Android elevation look. */
export function elevationShadow(
  level: 'tabBar' | 'bubble' | 'tile' | 'avatar',
): ViewStyle {
  const presets: Record<typeof level, ViewStyle> = {
    tabBar: Platform.select({
      ios: {
        shadowColor: colors.navy,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
      },
      android: { elevation: 10 },
      default: {},
    })!,
    bubble: Platform.select({
      ios: {
        shadowColor: colors.purple,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
      default: {},
    })!,
    tile: Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
      default: {},
    })!,
    avatar: Platform.select({
      ios: {
        shadowColor: colors.purple,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
      default: {},
    })!,
  };
  return presets[level];
}

/** Frosted-glass styling for inactive Automatic/Manual tiles on the hero card. */
export const heroModeColors = {
  buttonInactive: 'rgba(255,255,255,0.18)',
  buttonInactiveBorder: 'rgba(255,255,255,0.28)',
  iconBubbleInactive: 'rgba(255,255,255,0.22)',
  iconBubbleActive: Platform.select({
    ios: {
      backgroundColor: colors.purple,
      shadowColor: colors.purple,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
    },
    android: {
      backgroundColor: colors.purple,
      elevation: 4,
    },
    default: { backgroundColor: colors.purple },
  })!,
};
