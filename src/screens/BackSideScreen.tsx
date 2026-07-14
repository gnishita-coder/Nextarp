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
import LinearGradient from 'react-native-linear-gradient';
import RNFS from 'react-native-fs';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, primaryGradient, radius, spacing } from '../theme';
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
 * Dedicated screen for capturing and reviewing the back side of a
 * two-sided document (driving licence / passport). Opened from the front
 * Review screen's Next button - not via a side-picker sheet.
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
  const [issueAlertVisible, setIssueAlertVisible] = useState(false);

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

  const issueAlert = useMemo(() => {
    if (nationalityMismatch && nationality) {
      return {
        title: `Doesn't match ${NATIONALITY_LABELS[nationality]}`,
        body: `This document doesn't appear to match ${NATIONALITY_LABELS[nationality]}. Check the nationality or retake the photo.`,
      };
    }
    return null;
  }, [nationalityMismatch, nationality]);

  useEffect(() => {
    setIssueAlertVisible(issueAlert != null);
  }, [issueAlert, photo?.path]);

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

  const checks: { label: string; pass: boolean }[] = hasPhoto
    ? [
        { label: 'Sharpness', pass: !quality.isBlurry },
        { label: 'No glare / overexposure', pass: !quality.hasGlare },
        { label: 'Resolution', pass: quality.resolutionOk },
        { label: 'Aspect ratio / orientation', pass: quality.aspectRatioOk },
      ]
    : [];

  if (hasPhoto && nationalityCheck?.checkAvailable && nationality) {
    checks.push({
      label: `Matches ${NATIONALITY_LABELS[nationality]}`,
      pass: nationalityCheck.matchesSelected,
    });
  }

  const overallPass = hasPhoto && quality.overallPass && !nationalityMismatch;
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back to home">
            <LinearGradient
              colors={primaryGradient.colors}
              start={primaryGradient.start}
              end={primaryGradient.end}
              style={styles.backButtonGradient}>
              <Text style={styles.backGlyph}>{'‹'}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.title}>{hasPhoto ? 'Review scan' : 'Back side'}</Text>
          <Text style={styles.subtitle}>
            {docLabel}: Back side
          </Text>
        </View>

        {!hasPhoto ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Capture the back side</Text>
            <Text style={styles.emptyBody}>
              Flip your {docLabel.toLowerCase()} and scan the reverse side to finish this
              document.
            </Text>
            <PrimaryButton
              label="Capture back side"
              onPress={onCapture}
              loading={capturing}
              style={styles.captureButton}
            />
          </View>
        ) : (
          <>
            <Image source={{ uri: uri! }} style={styles.preview} resizeMode="cover" />

            {quality.analysisUnavailable && (
              <Text style={styles.analysisUnavailable}>
                Couldn't run sharpness/glare analysis on this image - showing resolution and
                aspect ratio checks only.
              </Text>
            )}

            <View style={styles.checksCard}>
              {checks.map((check, index) => (
                <View
                  key={check.label}
                  style={[styles.qualityRow, index === checks.length - 1 && styles.qualityRowLast]}>
                  <View
                    style={[
                      styles.qualityDot,
                      check.pass ? styles.qualityDotPass : styles.qualityDotFail,
                    ]}>
                    <Text style={styles.qualityCheck}>{check.pass ? '✓' : '!'}</Text>
                  </View>
                  <Text
                    style={[styles.qualityLabel, !check.pass && styles.qualityLabelFail]}
                    numberOfLines={1}>
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
                  {photo.width}×{photo.height}
                </Text>
                <Text style={styles.statLabel}>Resolution</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.spacer} />

        {hasPhoto && !issueAlertVisible && (
          <View style={styles.actions}>
            {overallPass && (
              <PrimaryButton
                label="Save to folder"
                onPress={onSave}
                loading={saving}
              />
            )}
            {!overallPass && (
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
              style={[styles.alertRetakeButton, capturing && styles.retakeButtonDisabled]}
              onPress={onRetake}
              disabled={capturing}
              activeOpacity={0.7}>
              <Text style={styles.retakeLabel}>Retake photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.alertCloseButton}
              onPress={() => setIssueAlertVisible(false)}
              activeOpacity={0.7}>
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
    overflow: 'hidden',
    zIndex: 1,
    marginTop: 6,
  },
  backButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    color: '#FFFFFF',
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
  emptyCard: {
    backgroundColor: colors.cardWhite,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.navy,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  captureButton: {
    alignSelf: 'stretch',
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
    marginTop: spacing.xl,
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
});
