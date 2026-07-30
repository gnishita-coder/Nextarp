import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppBackButton } from './AppBackButton';
import { colors, spacing } from '../theme';

type Props = {
  onBack: () => void;
  accessibilityLabel?: string;
  /** Centered page title (Review / Back style). */
  title?: string;
  subtitle?: string;
  /** Trailing control (e.g. Rename). Used with variant="inline". */
  right?: ReactNode;
  /**
   * overlay — back sits on the left; title stays centered (Review/Back).
   * inline — back + optional children row (Detail / sheets).
   */
  variant?: 'overlay' | 'inline';
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Shared top chrome for every screen with a back arrow.
 * Parents should still wrap with SafeAreaView edges including `top`
 * (or apply insets themselves on full-screen Modals).
 */
export function ScreenHeader({
  onBack,
  accessibilityLabel = 'Go back',
  title,
  subtitle,
  right,
  variant = 'overlay',
  children,
  style,
}: Props) {
  if (variant === 'inline') {
    return (
      <View style={[styles.inlineWrap, style]}>
        <AppBackButton onPress={onBack} accessibilityLabel={accessibilityLabel} />
        {children ? <View style={styles.inlineBody}>{children}</View> : null}
        {right ? <View style={styles.inlineRight}>{right}</View> : null}
      </View>
    );
  }

  return (
    <View style={[styles.overlayWrap, style]}>
      <AppBackButton
        style={styles.overlayBack}
        onPress={onBack}
        accessibilityLabel={accessibilityLabel}
      />
      {(title != null || subtitle != null) && (
        <View style={styles.overlayTitles} pointerEvents="none">
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      )}
      {right ? <View style={styles.overlayRight}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlayWrap: {
    minHeight: 56,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  overlayBack: {
    position: 'absolute',
    left: 0,
    top: 7,
    zIndex: 2,
  },
  overlayTitles: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 56,
  },
  overlayRight: {
    position: 'absolute',
    right: 0,
    top: 7,
    zIndex: 2,
  },
  inlineWrap: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  inlineBody: {
    flex: 1,
    minWidth: 0,
  },
  inlineRight: {
    flexShrink: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 3,
  },
});
