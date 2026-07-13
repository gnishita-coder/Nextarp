import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RNFS from 'react-native-fs';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius, spacing } from '../theme';
import { formatFileSize } from '../storage';
import type { QualityReport } from '../quality/imageQuality';
import type { FaceCheckResult } from '../vision/faceCheck';
import type { NationalityCheckResult } from '../vision/nationalityCheck';
import type { DocumentSide, DocumentType, Nationality } from '../types';
import { DOCUMENT_LABELS, NATIONALITY_LABELS } from '../types';

interface Props {
  documentType: DocumentType;
  side: DocumentSide;
  photoPath: string;
  photoWidth: number;
  photoHeight: number;
  quality: QualityReport;
  faceCheck: FaceCheckResult;
  nationalityCheck: NationalityCheckResult;
  nationality?: Nationality;
  saving?: boolean;
  onRetake: () => void;
  onSave: () => void;
}

export function ReviewScreen({
  documentType,
  side,
  photoPath,
  photoWidth,
  photoHeight,
  quality,
  faceCheck,
  nationalityCheck,
  nationality,
  saving,
  onRetake,
  onSave,
}: Props) {
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const normalized = photoPath.startsWith('file://') ? photoPath.replace('file://', '') : photoPath;
    RNFS.stat(normalized)
      .then(stat => {
        if (!cancelled) setFileSizeBytes(Number(stat.size));
      })
      .catch(() => {
        if (!cancelled) setFileSizeBytes(null);
      });
    return () => {
      cancelled = true;
    };
  }, [photoPath]);

  const sideLabel = side === 'front' ? 'Front side' : 'Back side';
  const docLabel = DOCUMENT_LABELS[documentType];
  const uri = photoPath.startsWith('file://') ? photoPath : `file://${photoPath}`;

  // NOTE: this is a warning, not a hard block. An earlier version refused to
  // save at all when no face was found - on-device testing showed a false
  // negative on a clear, well-lit ID photo (printed ID photos have halftone
  // printing, "SPECIMEN" watermarks, holograms etc. that general-purpose
  // face detectors aren't always tuned for), which meant a genuinely valid
  // scan couldn't be saved at all. Better to flag it clearly and let the
  // user override, same as the other quality checks below.
  const noFaceDetected = faceCheck.checkAvailable && !faceCheck.hasFace;

  // Same "warning, not a block" reasoning as the face check - OCR accuracy
  // on a scanned ID varies a lot with lighting/angle/print quality, so this
  // is a best-effort nudge, not a real verification.
  const nationalityMismatch = nationalityCheck.checkAvailable && !nationalityCheck.matchesSelected;

  const checks: { label: string; pass: boolean }[] = [
    { label: 'Sharpness', pass: !quality.isBlurry },
    { label: 'No glare / overexposure', pass: !quality.hasGlare },
    { label: 'Resolution', pass: quality.resolutionOk },
    { label: 'Aspect ratio / orientation', pass: quality.aspectRatioOk },
  ];
  if (faceCheck.checkAvailable) {
    checks.push({ label: 'ID photo detected', pass: faceCheck.hasFace });
  }
  if (nationalityCheck.checkAvailable && nationality) {
    checks.push({
      label: `Matches ${NATIONALITY_LABELS[nationality]}`,
      pass: nationalityCheck.matchesSelected,
    });
  }

  const overallPass = quality.overallPass && !noFaceDetected && !nationalityMismatch;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Review scan</Text>
      <Text style={styles.subtitle}>
        {sideLabel} · {docLabel}
      </Text>

      <Image source={{ uri }} style={styles.preview} resizeMode="cover" />

      {quality.analysisUnavailable && (
        <Text style={styles.analysisUnavailable}>
          Couldn't run sharpness/glare analysis on this image - showing resolution and aspect
          ratio checks only.
        </Text>
      )}

      <View style={styles.checksCard}>
        {checks.map((check, index) => (
          <View
            key={check.label}
            style={[styles.qualityRow, index === checks.length - 1 && styles.qualityRowLast]}>
            <View style={[styles.qualityDot, check.pass ? styles.qualityDotPass : styles.qualityDotFail]}>
              <Text style={styles.qualityCheck}>{check.pass ? '✓' : '!'}</Text>
            </View>
            <Text style={[styles.qualityLabel, !check.pass && styles.qualityLabelFail]} numberOfLines={1}>
              {check.label}
            </Text>
          </View>
        ))}
      </View>

      {quality.warnings.length > 0 && (
        <View style={styles.warningsBox}>
          {quality.warnings.map(warning => (
            <Text key={warning} style={styles.warningText}>
              • {warning}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {fileSizeBytes != null ? formatFileSize(fileSizeBytes) : '—'}
          </Text>
          <Text style={styles.statLabel}>File size</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {photoWidth}×{photoHeight}
          </Text>
          <Text style={styles.statLabel}>Resolution</Text>
        </View>
      </View>

      {noFaceDetected && (
        <View style={styles.rejectBox}>
          <Text style={styles.rejectTitle}>This might not be an ID document</Text>
          <Text style={styles.rejectBody}>
            No face was detected in this photo. If this is genuinely a driving licence or
            passport, the photo on it may just be hard to detect (glare, angle, print quality) -
            you can still save it, or retake for a clearer shot.
          </Text>
        </View>
      )}

      {nationalityMismatch && nationality && (
        <View style={styles.rejectBox}>
          <Text style={styles.rejectTitle}>Country doesn't match {NATIONALITY_LABELS[nationality]}</Text>
          <Text style={styles.rejectBody}>
            The scanned text didn't include anything matching {NATIONALITY_LABELS[nationality]}.
            This is a best-effort text check, not a real verification - it can miss things on
            angled or low-quality scans. Double-check you selected the right nationality, or save
            anyway if this is correct.
          </Text>
        </View>
      )}

      <View style={styles.spacer} />

      <PrimaryButton
        label={overallPass ? 'Save to folder' : 'Save anyway'}
        onPress={onSave}
        loading={saving}
      />
      <TouchableOpacity
        style={[styles.retakeButton, saving && styles.retakeButtonDisabled]}
        onPress={onRetake}
        disabled={saving}
        activeOpacity={0.7}>
        <Text style={styles.retakeLabel}>Retake photo</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.navy,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  preview: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: radius.xl,
    backgroundColor: colors.navy,
  },
  analysisUnavailable: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  checksCard: {
    marginTop: spacing.md,
    backgroundColor: colors.cardWhite,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  qualityRowLast: {
    borderBottomWidth: 0,
  },
  qualityDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  qualityDotPass: {
    backgroundColor: colors.success,
  },
  qualityDotFail: {
    backgroundColor: colors.danger,
  },
  qualityCheck: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  qualityLabel: {
    flex: 1,
    color: colors.navy,
    fontWeight: '600',
    fontSize: 14,
  },
  qualityLabelFail: {
    color: colors.danger,
    fontWeight: '700',
  },
  warningsBox: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(229, 88, 107, 0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  warningText: {
    color: colors.danger,
    fontSize: 12,
    marginBottom: 2,
  },
  rejectBox: {
    marginTop: spacing.lg,
    backgroundColor: 'rgba(229, 88, 107, 0.1)',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.danger,
    padding: spacing.md,
  },
  rejectTitle: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 4,
  },
  rejectBody: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.cardWhite,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.purple,
  },
  statLabel: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  spacer: {
    flex: 1,
  },
  retakeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.navy,
    backgroundColor: colors.cardWhite,
  },
  retakeButtonDisabled: {
    borderColor: colors.mutedLight,
  },
  retakeLabel: {
    color: colors.navy,
    fontWeight: '700',
    fontSize: 15,
  },
});
