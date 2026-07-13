import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RNFS from 'react-native-fs';
import { colors, radius, spacing } from '../theme';
import { clearAllDocuments } from '../storage';

interface Props {
  documentCount: number;
  onDataCleared: () => void;
}

const APP_VERSION = '0.0.1';

export function SettingsScreen({ documentCount, onDataCleared }: Props) {
  const handleClearData = () => {
    Alert.alert(
      'Clear all scans?',
      `This deletes all ${documentCount} saved document${documentCount === 1 ? '' : 's'} from this device. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAllDocuments();
            onDataCleared();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>SDK</Text>
          <Text style={styles.rowValue}>NextarpSDK (test build)</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Version</Text>
          <Text style={styles.rowValue}>{APP_VERSION}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Enabled documents</Text>
          <Text style={styles.rowValue}>Driving licence, Passport</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Storage</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Saved documents</Text>
          <Text style={styles.rowValue}>{documentCount}</Text>
        </View>
        <View style={styles.rowMultiline}>
          <Text style={styles.rowLabel}>On-device folder</Text>
          <Text style={styles.rowValueSmall}>{RNFS.DocumentDirectoryPath}/scanned_ids</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.clearButton} onPress={handleClearData}>
        <Text style={styles.clearLabel}>Clear all scans</Text>
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
    fontSize: 24,
    fontWeight: '700',
    color: colors.navy,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  section: {
    backgroundColor: colors.cardWhite,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowMultiline: {
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    fontSize: 14,
    color: colors.navy,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 14,
    color: colors.muted,
  },
  rowValueSmall: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  clearButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.cardWhite,
    marginTop: spacing.sm,
  },
  clearLabel: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 15,
  },
});
