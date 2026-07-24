import React from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { PrimaryButton } from './PrimaryButton';
import { colors, radius, spacing } from '../theme';

interface Props {
  visible: boolean;
  /** Called when the user taps Retake Scan - should reopen the scanner. */
  onRetake: () => void;
}

/**
 * On-brand replacement for the native Alert we used to show when a
 * captured scan's average luma indicates the user shot it against a
 * white/very light background.
 *
 * Single call-to-action (Retake) - there is no "use anyway" path, per
 * the client request to force a re-capture on a dark background.
 * ML Kit's own scanner UI is a closed Google activity we can't
 * overlay live, so this appears IMMEDIATELY after ML Kit closes with
 * a light-background image, which visually reads as "the scanner
 * detected the problem and asked me to retake" from the user's POV.
 */
export function WhiteBackgroundWarningModal({ visible, onRetake }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onRetake}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="sunny" color={colors.warning} size={34} />
          </View>

          <Text style={styles.title}>Use a dark background</Text>
          <Text style={styles.body}>
            The scanner works best on a dark, non-glossy surface. Please retake
            the scan on a darker background.
          </Text>

          <PrimaryButton
            label="Retake Scan"
            onPress={onRetake}
            style={styles.retakeButton}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 12, 24, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.cardWhite,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.navy,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: { elevation: 12 },
    }),
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF6E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#F6D9A0',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
  },
  body: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    fontSize: 14,
    lineHeight: 20,
    color: colors.navySubtle,
    textAlign: 'center',
  },
  retakeButton: {
    marginTop: spacing.xs,
  },
});
