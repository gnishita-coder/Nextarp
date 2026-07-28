import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { colors, spacing } from '../theme';
import type { DocumentSide, DocumentType } from '../types';

interface Props {
  documentType: DocumentType;
  side: DocumentSide;
}

/**
 * Brief transitional screen shown while the OS-native document scanner
 * (Apple VisionKit / Google ML Kit, via @dariyd/react-native-document-scanner)
 * is opening or closing. The actual live scanning UI is the OS's own
 * full-screen modal - we don't render or control that part.
 */
export function ScanningScreen({ documentType, side }: Props) {
  // Keep these values in the accessibility description even though the
  // visual copy stays intentionally short like the approved loading mockup.
  const scanDescription = `${side} side ${documentType.replace('_', ' ')}`;

  return (
    <View style={styles.container} accessibilityLabel={`Preparing scanner for ${scanDescription}`}>
      <View style={styles.content}>
        <View style={styles.iconRing}>
          <View style={styles.shieldWrap}>
            <Ionicons name="shield" color={colors.purple} size={58} />
            <Ionicons
              name="scan-outline"
              color="#FFFFFF"
              size={28}
              style={styles.shieldDocument}
            />
          </View>
        </View>

        <Text style={styles.title}>Preparing scanner</Text>
        <Text style={styles.text}>
          Place your document on a dark,{'\n'}non-glossy surface for best results.
        </Text>

        <View style={styles.checklist}>
          <View style={styles.checkRow}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" color="#FFFFFF" size={13} />
            </View>
            <Text style={styles.checkLabel}>Initializing camera</Text>
          </View>
          <View style={styles.checkRow}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" color="#FFFFFF" size={13} />
            </View>
            <Text style={styles.checkLabel}>Loading document model</Text>
          </View>
          <View style={styles.checkRow}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" color="#FFFFFF" size={13} />
            </View>
            <Text style={styles.checkLabel}>Checking environment</Text>
          </View>
          <View style={styles.checkRow}>
            <View style={styles.loadingCircle}>
              <ActivityIndicator size="small" color={colors.purple} />
            </View>
            <Text style={styles.checkLabel}>Opening scanner...</Text>
          </View>
        </View>
      </View>

      <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" color={colors.muted} size={15} />
        <Text style={styles.privacyText}>
          Your data is encrypted and{'\n'}never shared.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 0,
    paddingBottom: 48,
  },
  content: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderStyle: 'dotted',
    borderColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  shieldWrap: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldDocument: {
    position: 'absolute',
  },
  title: {
    color: colors.navy,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  text: {
    marginTop: 10,
    color: colors.navySubtle,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  checklist: {
    width: '100%',
    maxWidth: 310,
    marginTop: 36,
    paddingHorizontal: 10,
    gap: 13,
  },
  checkRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  loadingCircle: {
    width: 20,
    height: 20,
    marginRight: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: {
    flex: 1,
    color: colors.navy,
    fontSize: 14,
    fontWeight: '500',
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  privacyText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
});
