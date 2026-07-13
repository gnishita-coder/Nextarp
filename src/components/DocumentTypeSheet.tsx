import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GradientIconTile } from './GradientIconTile';
import { colors, radius, spacing } from '../theme';
import type { DocumentType } from '../types';
import { DOCUMENT_LABELS } from '../types';

interface Props {
  visible: boolean;
  onSelect: (documentType: DocumentType) => void;
  onClose: () => void;
}

// Client scope for this build: Driving Licence and Passport only.
const SELECTABLE_TYPES: DocumentType[] = ['driving_licence', 'passport'];

/**
 * Document-type picker shown after the user taps Automatic/Manual on the
 * Home screen, per checklist item 2.3 ("Document type selection screen").
 */
export function DocumentTypeSheet({ visible, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Select document type</Text>
          <Text style={styles.subtitle}>Choose the ID you want to scan</Text>

          {SELECTABLE_TYPES.map(type => (
            <TouchableOpacity
              key={type}
              style={styles.option}
              activeOpacity={0.8}
              onPress={() => onSelect(type)}
            >
              <GradientIconTile documentType={type} size={44} />
              <Text style={styles.optionLabel}>{DOCUMENT_LABELS[type]}</Text>
              <Text style={styles.chevron}>{'>'}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </TouchableOpacity>
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
  },
  chevron: {
    color: colors.mutedLight,
    fontSize: 18,
  },
  cancelButton: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelLabel: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 15,
  },
});
