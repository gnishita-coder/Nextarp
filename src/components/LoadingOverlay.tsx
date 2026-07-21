import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, elevationShadow, radius, spacing } from '../theme';

interface Props {
  visible: boolean;
  title?: string;
  message?: string;
}

/** Blocks repeated taps and gives consistent feedback during asynchronous work. */
export function LoadingOverlay({
  visible,
  title = 'Please wait',
  message = 'Getting everything ready…',
}: Props) {
  if (!visible) return null;

  return (
    <View
      style={styles.backdrop}
      accessibilityRole="progressbar"
      accessibilityLabel={`${title}. ${message}`}>
      <View style={styles.card}>
        <View style={styles.spinnerHalo}>
          <ActivityIndicator size="large" color={colors.purple} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: 'rgba(24, 19, 49, 0.28)',
  },
  card: {
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.cardWhite,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    ...elevationShadow('tabBar'),
  },
  spinnerHalo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purpleSoft,
  },
  title: {
    marginTop: spacing.md,
    color: colors.navy,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    marginTop: spacing.xs,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
