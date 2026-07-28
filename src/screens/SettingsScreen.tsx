import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  APP_VERSION,
  getMinSdkLabel,
  getMinSdkValue,
  REACT_NATIVE_VERSION,
} from '../constants/appInfo';
import { colors, spacing } from '../theme';

interface Props {
  documentCount: number;
}

interface InfoRowProps {
  icon: string;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Text style={styles.rowIconText}>{icon}</Text>
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

export function SettingsScreen({ documentCount }: Props) {
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
          <InfoRow icon="ⓘ" label="Version" value={APP_VERSION} />
          <View style={styles.divider} />
          <InfoRow icon="⚛" label="React Native" value={REACT_NATIVE_VERSION} />
          <View style={styles.divider} />
          <InfoRow icon="▲" label={getMinSdkLabel()} value={getMinSdkValue()} />
          <View style={styles.divider} />
          <InfoRow icon="✓" label="Enabled documents" value="Driving licence" />
        </View>

        <Text style={styles.sectionLabel}>Storage</Text>
        <View style={styles.section}>
          <InfoRow
            icon="▤"
            label="Saved documents"
            value={`${documentCount} document${documentCount === 1 ? '' : 's'}`}
          />
        </View>
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
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 48,
  },
});
