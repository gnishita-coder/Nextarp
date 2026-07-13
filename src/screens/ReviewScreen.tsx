import React, { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
  onBack: () => void;
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
  onBack,
  onRetake,
  onSave,
}: Props) {
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);
  const [issueAlertVisible, setIssueAlertVisible] = useState(false);

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

  // Face check takes priority over nationality - only one popup is shown.
  const issueAlert = useMemo(() => {
    if (noFaceDetected) {
      return {
        title: 'No ID photo detected',
        body: "We couldn't find a face in this scan. Retake for a clearer shot, or continue if this is correct.",
      };
    }
    if (nationalityMismatch && nationality) {
      return {
        title: `Doesn't match ${NATIONALITY_LABELS[nationality]}`,
        body: `This document doesn't appear to match ${NATIONALITY_LABELS[nationality]}. Check the nationality or retake the photo.`,
      };
    }
    return null;
  }, [noFaceDetected, nationalityMismatch, nationality]);

  useEffect(() => {
    setIssueAlertVisible(issueAlert != null);
  }, [issueAlert, photoPath]);

  // Hardware / gesture back: dismiss issue popup first, otherwise go Home.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (issueAlertVisible) {
        setIssueAlertVisible(false);
        return true;
      }
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [issueAlertVisible, onBack]);

  const sideLabel = side === 'front' ? 'Front side' : 'Back side';
  const docLabel = DOCUMENT_LABELS[documentType];
  const uri = photoPath.startsWith('file://') ? photoPath : `file://${photoPath}`;

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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back to home">
            <Text style={styles.backGlyph}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Review scan</Text>
          <Text style={styles.subtitle}>
            {sideLabel} · {docLabel}
          </Text>
        </View>

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

        <View style={styles.spacer} />

        {!issueAlertVisible && (
          <View style={styles.actions}>
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
          </View>
        )}
      </ScrollView>

      <Modal
        visible={issueAlertVisible && issueAlert != null}
        transparent
        animationType="fade"
        onRequestClose={() => setIssueAlertVisible(false)}>
        <View style={styles.alertBackdrop}>
          <TouchableOpacity
            style={styles.alertBackdropTouchable}
            activeOpacity={1}
            onPress={() => setIssueAlertVisible(false)}
          />
          <View style={styles.alertCard}>
            <View style={styles.alertIconWrap}>
              <Text style={styles.alertIcon}>{'!'}</Text>
            </View>
            <Text style={styles.alertTitle}>{issueAlert?.title}</Text>
            <Text style={styles.alertBody}>{issueAlert?.body}</Text>
            <TouchableOpacity
              style={[styles.alertRetakeButton, saving && styles.retakeButtonDisabled]}
              onPress={onRetake}
              disabled={saving}
              activeOpacity={0.7}>
              <Text style={styles.retakeLabel}>Retake photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.alertCloseButton}
              onPress={() => setIssueAlertVisible(false)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <Text style={styles.alertCloseLabel}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: colors.cardWhite,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    marginTop: 6,
  },
  backGlyph: {
    color: colors.navy,
    fontSize: 42,
    fontWeight: '600',
    lineHeight: 38,
    marginTop: -8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.navy,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
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
  alertBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 12, 30, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  alertBackdropTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  alertCard: {
    width: '100%',
    backgroundColor: colors.cardWhite,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  alertIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  alertIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  alertTitle: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 17,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  alertBody: {
    color: colors.navySubtle,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  alertRetakeButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.navy,
    backgroundColor: colors.cardWhite,
  },
  alertCloseButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.navy,
    backgroundColor: colors.cardWhite,
  },
  alertCloseLabel: {
    color: colors.navy,
    fontWeight: '700',
    fontSize: 15,
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
    minHeight: spacing.xl,
  },
  actions: {
    marginTop: -20,
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
