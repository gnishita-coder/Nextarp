import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import type { DocumentSide, DocumentType } from '../types';
import { DOCUMENT_LABELS } from '../types';

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
  const sideLabel = side === 'front' ? 'front side' : 'back side';
  const docLabel = DOCUMENT_LABELS[documentType];

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.purple} />
      <Text style={styles.text}>
        Opening scanner for the {sideLabel} of your {docLabel.toLowerCase()}...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  text: {
    marginTop: spacing.lg,
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
  },
});
