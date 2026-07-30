import React, { useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing } from '../theme';
import type { DocumentType } from '../types';
import { DOCUMENT_LABELS } from '../types';

interface Props {
  documentType: DocumentType;
  onBack: () => void;
  /** Move on to back-side capture (camera opens after this). */
  onContinue: () => void;
}

/**
 * Full-screen cue between validated front review and back-side capture.
 * Uses RN Animated (no Lottie/Reanimated in the project) to flip a card
 * face, then invites the user to scan the reverse side.
 */
export function DocumentFlipScreen({ documentType, onBack, onContinue }: Props) {
  const flip = useRef(new Animated.Value(0)).current;
  const docLabel = DOCUMENT_LABELS[documentType];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flip, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(700),
        Animated.timing(flip, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(500),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flip]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const frontRotate = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader
        onBack={onBack}
        accessibilityLabel="Back to front review"
        variant="inline"
      />

      <View style={styles.content}>
        <View style={styles.centerBlock}>
          <View style={styles.successPill}>
            <Ionicons name="checkmark-circle" color={colors.success} size={22} />
            <Text style={styles.successText}>Front side captured</Text>
          </View>

          <Text style={styles.title}>Flip your document</Text>
          <Text style={styles.body}>
            Please flip your {docLabel.toLowerCase()} and scan the back side.
          </Text>

          <View style={styles.stage}>
            <Animated.View
              style={[
                styles.cardFace,
                styles.cardFront,
                {
                  transform: [
                    { perspective: 1000 },
                    { rotateY: frontRotate },
                  ],
                },
              ]}>
              <Text style={styles.cardLabel}>FRONT</Text>
              <View style={styles.cardLines}>
                <View style={styles.cardLine} />
                <View style={[styles.cardLine, styles.cardLineShort]} />
                <View style={styles.cardLine} />
              </View>
              <View style={styles.photoMark} />
            </Animated.View>

            <Animated.View
              style={[
                styles.cardFace,
                styles.cardBack,
                {
                  transform: [
                    { perspective: 1000 },
                    { rotateY: backRotate },
                  ],
                },
              ]}>
              <Text style={styles.cardLabel}>BACK</Text>
              <View style={styles.cardLines}>
                <View style={styles.cardLine} />
                <View style={styles.cardLine} />
                <View style={[styles.cardLine, styles.cardLineShort]} />
              </View>
              <Text style={styles.barcodeHint}>▮▮▮▮▮</Text>
            </Animated.View>
          </View>

          <Text style={styles.hint}>
            Place it on a dark, non-glossy surface so all four corners stay visible.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton label="Scan back side" onPress={onContinue} />
      </View>
    </SafeAreaView>
  );
}

const CARD_W = 228;
const CARD_H = 144;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  centerBlock: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  body: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    fontSize: 16,
    lineHeight: 23,
    color: colors.navySubtle,
    textAlign: 'center',
    maxWidth: 320,
  },
  stage: {
    width: CARD_W,
    height: CARD_H,
    marginBottom: spacing.lg,
  },
  cardFace: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    borderRadius: radius.lg,
    padding: spacing.md,
    backfaceVisibility: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardFront: {
    backgroundColor: colors.cardWhite,
  },
  cardBack: {
    backgroundColor: colors.purpleSoft,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.purple,
    marginBottom: spacing.sm,
  },
  cardLines: {
    gap: 8,
    marginTop: 4,
  },
  cardLine: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    width: '78%',
  },
  cardLineShort: {
    width: '48%',
  },
  photoMark: {
    position: 'absolute',
    right: 14,
    top: 36,
    width: 44,
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.purpleSoft,
    borderWidth: 1,
    borderColor: '#D8CFF5',
  },
  barcodeHint: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    letterSpacing: 2,
    color: colors.navy,
    opacity: 0.45,
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 300,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
});
