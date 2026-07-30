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
import { colors, radius, spacing } from '../theme';
import type { DocumentType } from '../types';
import { DOCUMENT_LABELS } from '../types';

interface Props {
  documentType: DocumentType;
  /** Auto-advance to the flip screen after the confirmation animation runs. */
  onContinue: () => void;
  /** Hardware back handler (returns to the front review). */
  onBack: () => void;
}

/** How long the celebratory success moment stays on screen before the flip
 *  cue takes over. Long enough to read + notice the check animation, short
 *  enough not to feel like an extra loading step. */
const AUTO_ADVANCE_MS = 1600;

/**
 * Brief celebratory confirmation shown after the front-side review passes
 * all quality checks and the photo has been persisted, right before the
 * DocumentFlipScreen prompts the user to flip the document over.
 *
 * The screen self-dismisses after a short delay - there is no button. It
 * exists to give the workflow a clean "front captured" beat instead of
 * jumping straight from Review into the flip animation.
 */
export function FrontCaptureSuccessScreen({ documentType, onContinue, onBack }: Props) {
  const scale = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 90,
      }),
      Animated.parallel([
        Animated.timing(ringScale, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(ringOpacity, {
            toValue: 0.55,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 580,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    const timer = setTimeout(onContinue, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [scale, ringScale, ringOpacity, onContinue]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const docLabel = DOCUMENT_LABELS[documentType];
  const ringScaleValue = ringScale.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View
        style={styles.content}
        accessibilityLabel={`Front side of ${docLabel} captured`}>
        <View style={styles.badgeStage}>
          <Animated.View
            style={[
              styles.ring,
              {
                opacity: ringOpacity,
                transform: [{ scale: ringScaleValue }],
              },
            ]}
            pointerEvents="none"
          />
          <Animated.View
            style={[styles.checkBadge, { transform: [{ scale }] }]}>
            <Ionicons name="checkmark" color="#FFFFFF" size={54} />
          </Animated.View>
        </View>

        <Text style={styles.title}>Front side captured</Text>
        <Text style={styles.body}>
          Great — the front of your {docLabel.toLowerCase()} passed all
          quality checks.
        </Text>

        <View style={styles.nextHint}>
          <Ionicons name="sync" color={colors.purple} size={16} />
          <Text style={styles.nextHintText}>Preparing back-side scan…</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const BADGE_SIZE = 108;

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
  },
  badgeStage: {
    width: BADGE_SIZE + 80,
    height: BADGE_SIZE + 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  ring: {
    position: 'absolute',
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.success,
  },
  checkBadge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 15,
    lineHeight: 22,
    color: colors.navySubtle,
    textAlign: 'center',
    maxWidth: 320,
  },
  nextHint: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.purpleSoft,
  },
  nextHintText: {
    color: colors.purpleDeep,
    fontSize: 13,
    fontWeight: '700',
  },
});
