import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RNFS from 'react-native-fs';
import { PrimaryButton } from '../components/PrimaryButton';
import { AppBackButton } from '../components/AppBackButton';
import { StepProgress } from '../components/StepProgress';
import { colors, radius, spacing } from '../theme';
import { formatFileSize } from '../storage';
import type { QualityReport } from '../quality/imageQuality';
import type { NationalityCheckResult } from '../vision/nationalityCheck';
import type { CapturedPhoto, DocumentType, Nationality } from '../types';
import { DOCUMENT_LABELS, NATIONALITY_LABELS } from '../types';

interface Props {
  documentType: DocumentType;
  nationality?: Nationality;
  /** Present after the user has captured (or retaken) the back side. */
  photo?: CapturedPhoto;
  quality?: QualityReport;
  nationalityCheck?: NationalityCheckResult;
  capturing?: boolean;
  saving?: boolean;
  onBack: () => void;
  onCapture: () => void;
  onRetake: () => void;
  onSave: () => void;
}

/**
 * Dedicated screen for capturing and reviewing the back side of a two-sided
 * document (driving licence / passport). Reached from the front Review
 * screen's Next button. No face-detection check here - driving licence and
 * passport backs never carry a photo - and the nationality/OCR check is
 * skipped too (see App.tsx SKIPPED_NATIONALITY_CHECK): several real backs
 * (e.g. the Turkish and Spanish driving licence back) have no printed
 * country name at all, just a table of vehicle category codes.
 *
 * Unlike the front Review screen, there's no issue popup here and no
 * "Save anyway" override - if a check is flagged red, Retake is the only
 * option, since the back side has no face/nationality nuance that a popup
 * needs to explain (that's specific to the front side).
 */
export function BackSideScreen({
  documentType,
  nationality,
  photo,
  quality,
  nationalityCheck,
  capturing,
  saving,
  onBack,
  onCapture,
  onRetake,
  onSave,
}: Props) {
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);

  const docLabel = DOCUMENT_LABELS[documentType];
  const hasPhoto = photo != null && quality != null;

  useEffect(() => {
    if (!photo) {
      setFileSizeBytes(null);
      return;
    }
    let cancelled = false;
    const normalized = photo.path.startsWith('file://')
      ? photo.path.replace('file://', '')
      : photo.path;
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
  }, [photo]);

  const nationalityMismatch =
    !!nationalityCheck?.checkAvailable && !nationalityCheck.matchesSelected;

  const overallPass = hasPhoto ? quality.overallPass && !nationalityMismatch : false;

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const checks: { label: string; pass: boolean; status: string }[] = hasPhoto
    ? [
        { label: 'Sharpness', pass: !quality.isBlurry, status: 'Excellent' },
        { label: 'No glare / overexposure', pass: !quality.hasGlare, status: 'Good' },
        { label: 'Resolution', pass: quality.resolutionOk, status: 'Excellent' },
        { label: 'Aspect ratio / orientation', pass: quality.aspectRatioOk, status: 'Correct' },
      ]
    : [];

  if (hasPhoto && nationalityCheck?.checkAvailable && nationality) {
    checks.push({
      label: `Matches ${NATIONALITY_LABELS[nationality]}`,
      pass: nationalityCheck.matchesSelected,
      status: 'Yes',
    });
  }

  const uri =
    photo != null
      ? photo.path.startsWith('file://')
        ? photo.path
        : `file://${photo.path}`
      : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces>
        <View style={styles.header}>
          <AppBackButton
            style={styles.backButton}
            onPress={onBack}
            accessibilityLabel="Go to previous screen"
          />
          <Text style={styles.title}>{hasPhoto ? 'Review scan' : 'Capture back side'}</Text>
          <Text style={styles.subtitle}>
            {hasPhoto ? `Back side · ${docLabel}` : 'Step 2 of 2'}
          </Text>
        </View>

        {!hasPhoto ? (
          <>
            <StepProgress currentStep={2} labels={['Front', 'Back']} />
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>Capture the back side</Text>
            <Text style={styles.emptyBody}>
                Flip your {docLabel.toLowerCase()} over and place it inside the frame.
            </Text>
            </View>
            <View style={styles.placeholderCard}>
              <View style={styles.placeholderPhoto} />
              <View style={styles.placeholderLines}>
                <View style={styles.placeholderLine} />
                <View style={styles.placeholderLineShort} />
                <View style={styles.placeholderLine} />
              </View>
              <View style={styles.scanCorners}>
                <Text style={styles.scanGlyph}>⌗</Text>
              </View>
            </View>
            <Text style={styles.hint}>Keep all four corners visible and avoid glare</Text>
          </>
        ) : (
          <>
            <View style={styles.previewCard}>
              <Image source={{ uri: uri! }} style={styles.preview} resizeMode="contain" />
              <View style={styles.sideBadge}><Text style={styles.sideBadgeText}>BACK SIDE</Text></View>
            </View>

            {quality.analysisUnavailable && (
              <Text style={styles.analysisUnavailable}>
                Couldn't run sharpness/glare analysis on this image - showing resolution and
                aspect ratio checks only.
              </Text>
            )}

            <Text style={styles.sectionTitle}>Image quality</Text>
            <View style={styles.checksCard}>
              {checks.map((check, index) => (
                <View
                  key={check.label}
                  style={[styles.qualityRow, index === checks.length - 1 && styles.qualityRowLast]}>
                  <Text
                    style={[styles.qualityLabel, !check.pass && styles.qualityLabelFail]}
                    numberOfLines={1}>
                    {check.label}
                  </Text>
                  <View style={[styles.statusPill, !check.pass && styles.statusPillFail]}>
                    <Text style={[styles.statusText, !check.pass && styles.statusTextFail]}>
                      {check.pass ? check.status : 'Check'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBlock}>
                <Text style={styles.statValue}>{fileSizeBytes != null ? formatFileSize(fileSizeBytes) : '—'}</Text>
                <Text style={styles.statLabel}>File size</Text>
              </View>
              <View style={styles.statBlock}>
                <Text style={styles.statValue}>{photo.width} × {photo.height}</Text>
                <Text style={styles.statLabel}>Resolution</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.spacer} />

        {!hasPhoto ? (
          <View style={styles.actions}>
            <PrimaryButton
              label="Capture back side"
              onPress={onCapture}
              loading={capturing}
              style={styles.captureButton}
            />
          </View>
        ) : (
          <View style={styles.actions}>
            {overallPass ? (
              <PrimaryButton label="Save to folder" onPress={onSave} loading={saving} />
            ) : (
              <TouchableOpacity
                style={[styles.retakeButton, (saving || capturing) && styles.retakeButtonDisabled]}
                onPress={onRetake}
                disabled={saving || capturing}
                activeOpacity={0.7}>
                <Text style={styles.retakeLabel}>Retake photo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
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
    top: 6,
    zIndex: 1,
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
  emptyCopy: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  placeholderCard: {
    width: '100%',
    aspectRatio: 1.586,
    marginTop: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CFC8EA',
    backgroundColor: colors.purpleSoft,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xl,
  },
  placeholderPhoto: {
    width: 70,
    height: 82,
    borderRadius: radius.md,
    backgroundColor: '#DDD6F5',
  },
  placeholderLines: {
    flex: 1,
    marginLeft: spacing.lg,
    gap: spacing.md,
  },
  placeholderLine: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D5CEEE',
  },
  placeholderLineShort: {
    width: '65%',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D5CEEE',
  },
  scanCorners: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.cardWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanGlyph: {
    color: colors.purple,
    fontSize: 22,
    fontWeight: '700',
  },
  hint: {
    marginTop: spacing.md,
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  captureButton: {
    alignSelf: 'stretch',
  },
  previewCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.cardWhite,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  preview: {
    width: '100%',
    aspectRatio: 1.586,
    borderRadius: radius.lg,
    backgroundColor: colors.navy,
    overflow: 'hidden',
  },
  sideBadge: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(33,28,62,0.82)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
  },
  sideBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  analysisUnavailable: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  checksCard: {
    backgroundColor: colors.cardWhite,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    color: colors.navy,
    fontSize: 16,
    fontWeight: '800',
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
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
  statusPill: {
    minWidth: 70,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    alignItems: 'center',
  },
  statusPillFail: {
    backgroundColor: colors.dangerSoft,
  },
  statusText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '800',
  },
  statusTextFail: {
    color: colors.danger,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    borderRadius: 10,
    backgroundColor: colors.cardWhite,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.purple,
  },
  statLabel: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 3,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.xl,
  },
  actions: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
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
