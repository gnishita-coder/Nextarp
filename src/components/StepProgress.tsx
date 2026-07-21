import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

type StepState = 'done' | 'active' | 'pending';

interface Props {
  /** 1-based index of the current step. */
  currentStep: number;
  /** When true, every step is shown as completed (e.g. after both sides captured). */
  completed?: boolean;
  labels?: [string, string];
}

function stepState(step: number, currentStep: number, completed?: boolean): StepState {
  if (completed || step < currentStep) {
    return 'done';
  }
  if (step === currentStep) {
    return 'active';
  }
  return 'pending';
}

function StepDot({ step, state }: { step: number; state: StepState }) {
  const isDone = state === 'done';
  const isActive = state === 'active';

  return (
    <View
      style={[
        styles.dot,
        isDone && styles.dotDone,
        isActive && styles.dotActive,
        state === 'pending' && styles.dotPending,
      ]}>
      {isDone ? (
        <Text style={styles.checkmark}>✓</Text>
      ) : (
        <Text style={[styles.dotNumber, isActive && styles.dotNumberActive]}>{step}</Text>
      )}
    </View>
  );
}

/** Two-step progress rail with numbered circles and optional labels. */
export function StepProgress({
  currentStep,
  completed = false,
  labels = ['Front', 'Back'],
}: Props) {
  const fillPercent = completed ? 100 : currentStep <= 1 ? 0 : 50;
  const stepOneState = stepState(1, currentStep, completed);
  const stepTwoState = stepState(2, currentStep, completed);

  return (
    <View style={styles.wrap} accessibilityRole="progressbar">
      <View style={styles.railArea}>
        <View style={styles.railTrack} />
        <View style={[styles.railFill, { width: `${fillPercent}%` }]} />
        <View style={styles.dotsRow}>
          <StepDot step={1} state={stepOneState} />
          <StepDot step={2} state={stepTwoState} />
        </View>
      </View>
      <View style={styles.labelsRow}>
        <Text
          style={[
            styles.label,
            (stepOneState === 'done' || stepOneState === 'active') && styles.labelHighlight,
          ]}>
          {labels[0]}
        </Text>
        <Text
          style={[
            styles.label,
            (stepTwoState === 'done' || stepTwoState === 'active') && styles.labelHighlight,
          ]}>
          {labels[1]}
        </Text>
      </View>
    </View>
  );
}

const DOT_SIZE = 28;

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.sm,
  },
  railArea: {
    height: DOT_SIZE,
    justifyContent: 'center',
  },
  railTrack: {
    position: 'absolute',
    left: DOT_SIZE / 2,
    right: DOT_SIZE / 2,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.purpleSoft,
  },
  railFill: {
    position: 'absolute',
    left: DOT_SIZE / 2,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.purple,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  dotDone: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  dotActive: {
    backgroundColor: colors.cardWhite,
    borderColor: colors.purple,
    borderWidth: 2.5,
  },
  dotPending: {
    backgroundColor: colors.cardWhite,
    borderColor: '#D5CEEE',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: -1,
  },
  dotNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
  },
  dotNumberActive: {
    color: colors.purple,
    fontWeight: '800',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    minWidth: DOT_SIZE,
    textAlign: 'center',
  },
  labelHighlight: {
    color: colors.navy,
    fontWeight: '700',
  },
});
