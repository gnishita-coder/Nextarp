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
  /** Open the native camera for the front-side capture. */
  onContinue: () => void;
}

/**
 * Instructional cue shown after nationality selection and before the OS
 * scanner opens for the FRONT side. It replaces the previous generic
 * "Preparing scanner" screen with a document-specific animation:
 *   - a dashed camera frame,
 *   - a card labelled FRONT that slides + settles into the frame,
 *   - a pulsing "hold steady" ring while it sits centered,
 *   - the checklist instruction message required by the workflow.
 *
 * Uses RN Animated only (Reanimated/Lottie are not part of the project).
 */
export function FrontScanIntroScreen({ documentType, onBack, onContinue }: Props) {
  const docLabel = DOCUMENT_LABELS[documentType];

  // Slide/scale the card in from below, then hold it centered while a
  // subtle "steady" pulse cycles on the frame. Loops so the user always
  // sees the settle animation regardless of when they land on the screen.
  const slide = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const slideLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(slide, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(1200),
        Animated.timing(slide, {
          toValue: 0,
          duration: 500,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(300),
      ]),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    slideLoop.start();
    pulseLoop.start();
    return () => {
      slideLoop.stop();
      pulseLoop.stop();
    };
  }, [slide, pulse]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const cardTranslateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [70, 0],
  });
  const cardScale = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });
  const cardOpacity = slide.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.6, 1],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.9],
  });
  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader
        onBack={onBack}
        accessibilityLabel="Back to home"
        variant="inline"
      />

      <View style={styles.content}>
        <View style={styles.stepPill}>
          <Text style={styles.stepText}>Step 1 of 2 · Front side</Text>
        </View>

        <Text style={styles.title}>Position the front side</Text>
        <Text style={styles.body}>
          Please place the front side of your {docLabel.toLowerCase()} within the
          frame and keep it steady.
        </Text>

        <View style={styles.stage}>
          <Animated.View
            style={[
              styles.frame,
              {
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
            pointerEvents="none">
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </Animated.View>

          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardOpacity,
                transform: [
                  { translateY: cardTranslateY },
                  { scale: cardScale },
                ],
              },
            ]}
            pointerEvents="none">
            <Text style={styles.cardLabel}>FRONT</Text>
            <View style={styles.cardLines}>
              <View style={styles.cardLine} />
              <View style={[styles.cardLine, styles.cardLineShort]} />
              <View style={styles.cardLine} />
            </View>
            <View style={styles.photoMark}>
              <Ionicons name="person" color={colors.purple} size={22} />
            </View>
          </Animated.View>
        </View>

        <View style={styles.tipList}>
          <View style={styles.tipRow}>
            <View style={styles.tipDot}>
              <Ionicons name="checkmark" color="#FFFFFF" size={13} />
            </View>
            <Text style={styles.tipText}>Fit all four corners inside the frame</Text>
          </View>
          <View style={styles.tipRow}>
            <View style={styles.tipDot}>
              <Ionicons name="checkmark" color="#FFFFFF" size={13} />
            </View>
            <Text style={styles.tipText}>Hold the phone steady until capture</Text>
          </View>
          <View style={styles.tipRow}>
            <View style={styles.tipDot}>
              <Ionicons name="checkmark" color="#FFFFFF" size={13} />
            </View>
            <Text style={styles.tipText}>Use a dark, non-glossy surface for best results</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton label="Start scan" onPress={onContinue} />
      </View>
    </SafeAreaView>
  );
}

const FRAME_W = 260;
const FRAME_H = 164;
const CARD_W = 220;
const CARD_H = 138;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  stepPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.purpleSoft,
    marginBottom: spacing.md,
  },
  stepText: {
    color: colors.purpleDeep,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  body: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    fontSize: 15,
    lineHeight: 22,
    color: colors.navySubtle,
    textAlign: 'center',
    maxWidth: 320,
  },
  stage: {
    width: FRAME_W,
    height: FRAME_H,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  frame: {
    position: 'absolute',
    width: FRAME_W,
    height: FRAME_H,
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: colors.purple,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: radius.md,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: radius.md,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: radius.md,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: radius.md,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: radius.lg,
    backgroundColor: colors.cardWhite,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardLabel: {
    fontSize: 11,
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
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
    width: '68%',
  },
  cardLineShort: {
    width: '42%',
  },
  photoMark: {
    position: 'absolute',
    right: 14,
    top: 32,
    width: 44,
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.purpleSoft,
    borderWidth: 1,
    borderColor: '#D8CFF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipList: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    gap: 10,
    paddingHorizontal: spacing.sm,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tipText: {
    flex: 1,
    color: colors.navy,
    fontSize: 13,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
});
