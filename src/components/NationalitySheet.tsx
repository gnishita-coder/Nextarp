import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import type { Nationality } from '../types';
import { NATIONALITIES, NATIONALITY_CODES, NATIONALITY_FLAGS, NATIONALITY_LABELS } from '../types';

interface Props {
  visible: boolean;
  selected: Nationality;
  onSelect: (nationality: Nationality) => void;
  onClose: () => void;
}

/**
 * Small bottom-sheet picker for the app-wide nationality setting - opened
 * from the flag icon in the Home header, matching the reference "Select
 * your language" sheet the client shared (compact, tap-a-row-to-select,
 * no separate full-screen step). Replaces the old full-screen
 * NationalityScreen, which required nationality + document type together
 * before every single scan.
 */
export function NationalitySheet({ visible, selected, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Select your nationality</Text>
          <Text style={styles.subtitle}>Sets which country's ID you're scanning</Text>

          {NATIONALITIES.map(code => {
            const isSelected = code === selected;
            return (
              <TouchableOpacity
                key={code}
                style={[styles.option, isSelected && styles.optionSelected]}
                activeOpacity={0.8}
                onPress={() => {
                  onSelect(code);
                  onClose();
                }}>
                <Text style={styles.flag}>{NATIONALITY_FLAGS[code]}</Text>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>{NATIONALITY_LABELS[code]}</Text>
                  <Text style={styles.optionSubLabel}>{NATIONALITY_CODES[code]}</Text>
                </View>
                {isSelected && <Text style={styles.check}>{'✓'}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 12, 30, 0.45)',
  },
  backdropTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: colors.cardWhite,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.navy,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  optionSelected: {
    backgroundColor: colors.backgroundSoft,
  },
  flag: {
    fontSize: 28,
    width: 36,
    textAlign: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
  },
  optionSubLabel: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  check: {
    color: colors.purple,
    fontSize: 18,
    fontWeight: '700',
  },
});
