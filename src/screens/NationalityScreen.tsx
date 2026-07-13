import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientIconTile } from '../components/GradientIconTile';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius, spacing } from '../theme';
import type { DocumentType, Nationality } from '../types';
import {
  DOCUMENT_LABELS,
  NATIONALITIES,
  NATIONALITY_CODES,
  NATIONALITY_FLAGS,
  NATIONALITY_LABELS,
} from '../types';

// Client scope for this build: Driving Licence and Passport only (matches
// DocumentTypeSheet's SELECTABLE_TYPES).
const SELECTABLE_TYPES: DocumentType[] = ['driving_licence', 'passport'];

interface Props {
  onContinue: (nationality: Nationality, documentType: DocumentType) => void;
  onCancel: () => void;
}

/**
 * Pre-scan step: choose nationality, then which document to scan. Matches
 * the client's "Choose your nationality" / "Identification Method" mockup.
 *
 * IMPORTANT SCOPE NOTE: this only records which nationality the user
 * selected - it does not verify the scanned document actually matches that
 * country (e.g. reading the MRZ/OCR to confirm it's a Spanish vs Turkish
 * document). That would be a separate, much larger feature (document
 * text/MRZ recognition) not built here.
 */
export function NationalityScreen({ onContinue, onCancel }: Props) {
  const [nationality, setNationality] = useState<Nationality>('ES');
  const [documentType, setDocumentType] = useState<DocumentType | null>(null);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
          <Text style={styles.closeGlyph}>{'✕'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Choose your nationality</Text>
        <Text style={styles.subtitle}>
          This selects which country's document you're scanning - it doesn't verify the
          document itself.
        </Text>

        <View style={styles.optionList}>
          {NATIONALITIES.map(code => {
            const selected = code === nationality;
            return (
              <TouchableOpacity
                key={code}
                style={[styles.optionRow, selected && styles.optionRowSelected]}
                activeOpacity={0.8}
                onPress={() => setNationality(code)}
              >
                <Text style={styles.flag}>{NATIONALITY_FLAGS[code]}</Text>
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                    {NATIONALITY_LABELS[code]}
                  </Text>
                  <Text style={styles.optionSubLabel}>{NATIONALITY_CODES[code]}</Text>
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Identification method</Text>
        <View style={styles.optionList}>
          {SELECTABLE_TYPES.map(type => {
            const selected = type === documentType;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.optionRow, selected && styles.optionRowSelected]}
                activeOpacity={0.8}
                onPress={() => setDocumentType(type)}
              >
                <GradientIconTile documentType={type} size={44} />
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                    {DOCUMENT_LABELS[type]}
                  </Text>
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label="Continue"
          disabled={!documentType}
          onPress={() => documentType && onContinue(nationality, documentType)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: {
    color: colors.navy,
    fontSize: 15,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.navy,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.navy,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  optionList: {
    gap: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.cardWhite,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionRowSelected: {
    borderColor: colors.purple,
  },
  flag: {
    fontSize: 32,
    width: 44,
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
  optionLabelSelected: {
    color: colors.purpleDeep,
  },
  optionSubLabel: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.purple,
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: colors.purple,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
});
