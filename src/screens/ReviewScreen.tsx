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
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing } from '../theme';
import { formatFileSize } from '../storage';
import type { QualityReport } from '../quality/imageQuality';
import type { FaceCheckResult } from '../vision/faceCheck';
import type { NationalityCheckResult } from '../vision/nationalityCheck';
import type { DocumentType, Nationality } from '../types';
import { DOCUMENT_LABELS, NATIONALITY_LABELS } from '../types';

interface Props {
  documentType: DocumentType;
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
  onChangeCountry?: () => void;
  /** Front side never saves the document on its own - it always moves on to
   * the back-side capture screen. */
  onNext: () => void;
}

/**
 * Review screen for the FRONT side of a driving licence / passport. The back
 * side has its own dedicated screen (see BackSideScreen.tsx), so this screen
 * only ever needs two actions: Next (move on to the back side) and Retake
 * (redo this capture) - and a single popup that appears whenever any check
 * below is flagged red, whether that's blur/glare/resolution/orientation, a
 * missing face, or a nationality mismatch.
 */
export function ReviewScreen({
  documentType,
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
  onChangeCountry,
  onNext,
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

  const overallPass = quality.overallPass && !noFaceDetected && !nationalityMismatch;

  // The popup appears whenever ANY check below is red - not just face or
  // nationality - so a blurry/glary/low-res/misaligned shot surfaces the
  // same verification screen with the exact failed checks.
  const issueAlert = useMemo(() => {
    if (overallPass) return null;

    const reasons: string[] = [];
    if (nationalityMismatch && nationality) {
      reasons.push(`Document does not match ${NATIONALITY_LABELS[nationality]}`);
    }
    if (noFaceDetected) reasons.push('No ID photo or face was detected');
    if (quality.isBlurry) reasons.push('Image is blurry or out of focus');
    if (quality.hasGlare) reasons.push('Glare or overexposure was detected');
    if (!quality.resolutionOk) reasons.push('Image resolution is too low');
    if (!quality.aspectRatioOk) reasons.push('Document is cropped, rotated, or misaligned');
    if (reasons.length === 0) {
      reasons.push(...quality.warnings);
    }
    if (reasons.length === 0) reasons.push('Verification could not be completed');

    const onlyNationalityFailed =
      nationalityMismatch &&
      !noFaceDetected &&
      quality.overallPass;
    const onlyFaceFailed =
      noFaceDetected &&
      !nationalityMismatch &&
      quality.overallPass;

    return {
      title: onlyNationalityFailed
        ? 'Country could not be verified'
        : onlyFaceFailed
          ? 'ID photo not detected'
          : 'Unable to verify document',
      body: onlyNationalityFailed && nationality
        ? `We couldn't confirm that this document matches the selected country (${NATIONALITY_LABELS[nationality]}).`
        : onlyFaceFailed
          ? "We couldn't detect an ID photo or face in the captured document."
          : 'The captured image did not pass all required verification checks.',
      reasons,
      showChangeCountry: nationalityMismatch,
    };
  }, [overallPass, noFaceDetected, nationalityMismatch, nationality, quality]);

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

  const docLabel = DOCUMENT_LABELS[documentType];
  const uri = photoPath.startsWith('file://') ? photoPath : `file://${photoPath}`;
  const handleRetakeFromVerification = () => {
    setIssueAlertVisible(false);
    // The verification UI is a native full-screen Modal. Give it time to
    // dismiss so the app-level loading overlay is visible before reopening
    // the native scanner.
    setTimeout(onRetake, 140);
  };

  const checks: { label: string; pass: boolean; status: string }[] = [
    { label: 'Sharpness', pass: !quality.isBlurry, status: 'Excellent' },
    { label: 'No glare / overexposure', pass: !quality.hasGlare, status: 'Good' },
    { label: 'Resolution', pass: quality.resolutionOk, status: 'Excellent' },
    { label: 'Aspect ratio / orientation', pass: quality.aspectRatioOk, status: 'Correct' },
  ];
  if (faceCheck.checkAvailable) {
    checks.push({ label: 'ID photo detected', pass: faceCheck.hasFace, status: 'Yes' });
  }
  if (nationalityCheck.checkAvailable && nationality) {
    checks.push({
      label: `Matches ${NATIONALITY_LABELS[nationality]}`,
      pass: nationalityCheck.matchesSelected,
      status: 'Yes',
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces>
        <ScreenHeader
          onBack={onBack}
          accessibilityLabel="Back to home"
          title="Review scan"
          subtitle={`Front side · ${docLabel}`}
        />

        <View style={styles.previewCard}>
          <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
        </View>

        {quality.analysisUnavailable && (
          <Text style={styles.analysisUnavailable}>
            Couldn't run sharpness/glare analysis on this image - showing resolution and aspect
            ratio checks only.
          </Text>
        )}

        <View style={styles.checksCard}>
          <View style={styles.checksHeader}>
            <Text style={styles.sectionTitle}>Image quality</Text>
            <View style={[styles.overallPill, !overallPass && styles.statusPillFail]}>
              <Text style={[styles.overallText, !overallPass && styles.statusTextFail]}>
                {overallPass ? 'Excellent' : 'Check'}
              </Text>
            </View>
          </View>
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
              <Text style={[styles.statusText, !check.pass && styles.statusTextFail]}>
                {check.pass ? check.status : 'Check'}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{fileSizeBytes != null ? formatFileSize(fileSizeBytes) : '—'}</Text>
            <Text style={styles.statLabel}>File size</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{photoWidth} × {photoHeight}</Text>
            <Text style={styles.statLabel}>Resolution</Text>
          </View>
        </View>

        <View style={styles.spacer} />

        {!issueAlertVisible && (
          <View style={styles.actions}>
            {/* No "continue anyway" override - if a check above is flagged
                red, Retake is the only option, same as BackSideScreen. Next
                only ever appears once every check has passed. */}
            {overallPass ? (
              <PrimaryButton label="Continue to back side" onPress={onNext} loading={saving} />
            ) : (
              <TouchableOpacity
                style={[styles.retakeButton, saving && styles.retakeButtonDisabled]}
                onPress={onRetake}
                disabled={saving}
                activeOpacity={0.7}>
                <Text style={styles.retakeLabel}>Retake photo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={issueAlertVisible && issueAlert != null}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setIssueAlertVisible(false)}>
        <SafeAreaView style={styles.verifyScreen}>
          <View style={styles.verifyContent}>
            <View style={styles.verifyIcon}>
              <Text style={styles.verifyIconText}>!</Text>
            </View>

            <Text style={styles.verifyTitle}>{issueAlert?.title}</Text>
            <Text style={styles.verifyBody}>{issueAlert?.body}</Text>

            <View style={styles.reasons}>
              <Text style={styles.reasonsTitle}>Possible reasons</Text>
              {issueAlert?.reasons.map(reason => (
                <Text key={reason} style={styles.reasonItem}>•  {reason}</Text>
              ))}
            </View>

            <PrimaryButton
              label="Retake photo"
              onPress={handleRetakeFromVerification}
              loading={saving}
              style={styles.verifyPrimaryButton}
            />
            {issueAlert?.showChangeCountry && (
              <TouchableOpacity
                style={styles.verifySecondaryButton}
                onPress={onChangeCountry ?? (() => setIssueAlertVisible(false))}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Change country">
                <Text style={styles.verifySecondaryLabel}>Change country</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.verifyCancelButton}
              onPress={() => setIssueAlertVisible(false)}
              activeOpacity={0.7}>
              <Text style={styles.verifyCancelLabel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
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
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  previewCard: {
    borderRadius: 15,
    backgroundColor: colors.cardWhite,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  preview: {
    width: '100%',
    aspectRatio: 1.72,
    borderRadius: 12,
    backgroundColor: colors.navy,
    overflow: 'hidden',
  },
  analysisUnavailable: {
    fontSize: 9,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  checksCard: {
    backgroundColor: colors.cardWhite,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checksHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    flex: 1,
    color: colors.navy,
    fontSize: 16,
    fontWeight: '800',
  },
  overallPill: {
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  overallText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '800',
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  qualityRowLast: {
    borderBottomWidth: 0,
  },
  qualityDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 10,
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
    fontSize: 10,
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
  statusPillFail: {
    backgroundColor: colors.dangerSoft,
  },
  statusText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '800',
  },
  statusTextFail: {
    color: colors.danger,
  },
  verifyScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  verifyContent: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 44,
    alignItems: 'center',
  },
  verifyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  verifyIconText: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 35,
    fontWeight: '800',
  },
  verifyTitle: {
    color: colors.navy,
    fontWeight: '800',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 12,
  },
  verifyBody: {
    color: colors.navySubtle,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 310,
  },
  reasons: {
    alignSelf: 'stretch',
    marginTop: 36,
    marginHorizontal: 20,
  },
  reasonsTitle: {
    color: colors.navy,
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 10,
  },
  reasonItem: {
    color: colors.navySubtle,
    fontSize: 13,
    lineHeight: 25,
  },
  verifyPrimaryButton: {
    marginTop: 38,
    borderRadius: radius.pill,
  },
  verifySecondaryButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.purpleDeep,
    backgroundColor: 'transparent',
  },
  verifySecondaryLabel: {
    color: colors.navy,
    fontWeight: '800',
    fontSize: 15,
  },
  verifyCancelButton: {
    marginTop: 15,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
  },
  verifyCancelLabel: {
    color: colors.navySubtle,
    fontSize: 14,
    fontWeight: '500',
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
    minHeight: 10,
  },
  actions: {
    marginTop: 8,
    marginBottom: 0,
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
