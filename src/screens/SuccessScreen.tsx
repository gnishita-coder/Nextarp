import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import RNFS from 'react-native-fs';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, primaryGradient, radius, spacing } from '../theme';
import type { CapturedSide, DocumentType, Nationality } from '../types';
import { DOCUMENT_LABELS, NATIONALITY_FLAGS, NATIONALITY_LABELS } from '../types';

interface Props {
  documentType: DocumentType;
  folderPath: string;
  sides: CapturedSide[];
  nationality?: Nationality;
  onDone: () => void;
  onScanAnother: () => void;
}

export function SuccessScreen({
  documentType,
  folderPath,
  sides,
  nationality,
  onDone,
  onScanAnother,
}: Props) {
  const docLabel = DOCUMENT_LABELS[documentType];
  const relativeFolder = folderPath.startsWith(RNFS.DocumentDirectoryPath)
    ? folderPath.slice(RNFS.DocumentDirectoryPath.length + 1)
    : folderPath;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.spacerTop} />

      <View style={styles.checkShadowWrap}>
        <LinearGradient
          colors={primaryGradient.colors}
          start={primaryGradient.start}
          end={primaryGradient.end}
          style={styles.checkCircle}
        >
          <View style={styles.checkGloss} />
          <Text style={styles.checkGlyph}>{'✓'}</Text>
        </LinearGradient>
      </View>

      <Text style={styles.title}>{docLabel} saved</Text>
      {nationality && (
        <Text style={styles.nationalityLine}>
          {NATIONALITY_FLAGS[nationality]} {NATIONALITY_LABELS[nationality]}
        </Text>
      )}
      <Text style={styles.subtitle}>
        {sides.length > 1
          ? 'Both sides were captured clearly and stored on this device.'
          : 'The scan was captured clearly and stored on this device.'}
      </Text>

      <View style={styles.thumbRow}>
        {sides.map(s => (
          <View key={s.side} style={styles.thumbCard}>
            <Image source={{ uri: s.uri }} style={styles.thumbImage} resizeMode="cover" />
          </View>
        ))}
      </View>

      <View style={styles.folderRow}>
        <Text style={styles.folderIcon}>{'\u{1F4C1}'}</Text>
        <Text style={styles.folderPath}>{relativeFolder}</Text>
      </View>

      <View style={styles.spacerBottom} />

      <PrimaryButton label="Done" onPress={onDone} />
      <TouchableOpacity style={styles.scanAnotherButton} onPress={onScanAnother}>
        <Text style={styles.scanAnotherLabel}>Scan another document</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  spacerTop: {
    flex: 1,
  },
  spacerBottom: {
    flex: 1,
  },
  checkShadowWrap: {
    shadowColor: colors.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  checkGloss: {
    position: 'absolute',
    top: -18,
    left: -14,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  checkGlyph: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.navy,
    marginTop: spacing.lg,
  },
  nationalityLine: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  thumbRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  thumbCard: {
    width: 130,
    height: 90,
    borderRadius: radius.md,
    backgroundColor: colors.cardWhite,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  folderIcon: {
    fontSize: 13,
  },
  folderPath: {
    color: colors.muted,
    fontSize: 13,
  },
  scanAnotherButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  scanAnotherLabel: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 14,
  },
});
