import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RNFS from 'react-native-fs';
import { colors, spacing } from '../theme';
import { clearAllDocuments } from '../storage';

interface Props {
  documentCount: number;
  onDataCleared: () => void | Promise<void>;
  onLoadingChange?: (loading: boolean) => void;
}

const APP_VERSION = '0.0.1';

export function SettingsScreen({ documentCount, onDataCleared, onLoadingChange }: Props) {
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
            onLoadingChange?.(true);
            try {
              await clearAllDocuments();
              await onDataCleared();
            } finally {
              onLoadingChange?.(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.heading}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage your vault and app information.</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Text style={styles.rowIconText}>▣</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>SDK</Text>
              <Text style={styles.rowValue}>NextarpSDK (test build)</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Text style={styles.rowIconText}>ⓘ</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowValue}>{APP_VERSION}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Text style={styles.rowIconText}>✓</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Enabled documents</Text>
              <Text style={styles.rowValue}>Driving licence, Passport</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Storage</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Text style={styles.rowIconText}>▤</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Saved documents</Text>
              <Text style={styles.rowValue}>
                {documentCount} document{documentCount === 1 ? '' : 's'}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Text style={styles.rowIconText}>⌁</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>On-device folder</Text>
              <Text style={styles.rowValueSmall}>
                {RNFS.DocumentDirectoryPath}/scanned_ids
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClearData}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Clear all scans">
          <View>
            <Text style={styles.clearLabel}>Clear all scans</Text>
            <Text style={styles.clearDescription}>Permanently remove vault data</Text>
          </View>
          <Text style={styles.clearGlyph}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 19,
  },
  heading: {
    marginTop: 13,
    marginBottom: 22,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 3,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  section: {
    backgroundColor: colors.cardWhite,
    borderRadius: 13,
    paddingHorizontal: 12,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 66,
    paddingVertical: 11,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconText: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.purple,
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 14,
    color: colors.navy,
    fontWeight: '700',
  },
  rowValue: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  rowValueSmall: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 15,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 48,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 62,
    padding: 13,
    borderRadius: 13,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#FFDADD',
  },
  clearLabel: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  clearDescription: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  clearGlyph: {
    color: colors.danger,
    fontSize: 26,
    lineHeight: 26,
  },
});
