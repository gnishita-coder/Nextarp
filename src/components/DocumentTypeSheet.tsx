import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { GradientIconTile } from './GradientIconTile';
import { colors, elevationShadow, radius, spacing } from '../theme';
import { ScreenHeader } from './ScreenHeader';
import type { DocumentType } from '../types';
import { DOCUMENT_LABELS } from '../types';

interface Props {
  visible: boolean;
  onSelect: (documentType: DocumentType) => void;
  onClose: () => void;
}

// Client scope for this build: Driving Licence and Passport only.
const SELECTABLE_TYPES = ['driving_licence', 'passport'] as const satisfies readonly DocumentType[];
const TYPE_DESCRIPTIONS: Record<(typeof SELECTABLE_TYPES)[number], string> = {
  driving_licence: 'Government-issued driving licence',
  passport: 'International passport',
};

/**
 * Document-type picker shown after the user taps Automatic/Manual on the
 * Home screen, per checklist item 2.3 ("Document type selection screen").
 */
export function DocumentTypeSheet({ visible, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <View
        style={[
          styles.screen,
          { paddingTop: insets.top + 4, paddingBottom: insets.bottom },
        ]}>
        <ScreenHeader
          variant="inline"
          onBack={onClose}
          accessibilityLabel="Back"
        />

        <View style={styles.headings}>
          <Text style={styles.title}>Select document type</Text>
          <Text style={styles.subtitle}>What are you scanning?</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.options}>
            {SELECTABLE_TYPES.map(type => (
              <TouchableOpacity
                key={type}
                style={styles.option}
                activeOpacity={0.82}
                onPress={() => onSelect(type)}
                accessibilityRole="button"
                accessibilityLabel={DOCUMENT_LABELS[type]}
                accessibilityHint={TYPE_DESCRIPTIONS[type]}>
                <GradientIconTile documentType={type} size={54} />
                <View style={styles.optionCopy}>
                  <Text style={styles.optionLabel}>{DOCUMENT_LABELS[type]}</Text>
                  <Text style={styles.optionDescription}>{TYPE_DESCRIPTIONS[type]}</Text>
                </View>
                <Ionicons name="chevron-forward" color={colors.muted} size={20} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cancel document selection">
          <Text style={styles.cancelLabel}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headings: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  options: {
    gap: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 104,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.cardWhite,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevationShadow('tile'),
  },
  optionCopy: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  cancelButton: {
    marginHorizontal: 32,
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.cardWhite,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelLabel: {
    color: colors.navySubtle,
    fontWeight: '700',
    fontSize: 15,
  },
});
