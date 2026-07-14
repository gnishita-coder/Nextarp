import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { formatRelativeTimestamp } from '../storage';
import type { SavedDocument } from '../types';
import { NATIONALITY_FLAGS, NATIONALITY_LABELS } from '../types';

interface Props {
  document: SavedDocument;
  onBack: () => void;
}

const SIDE_ORDER: Record<string, number> = { front: 0, back: 1 };

/**
 * Full-page "document viewer" reached by tapping a row in the Documents tab.
 * Shows every captured side (front, then back) stacked as full-width pages
 * on a white background, similar to how a scanned multi-page PDF would be
 * presented, rather than just the small list-row thumbnail.
 */
export function DocumentDetailScreen({ document, onBack }: Props) {
  const sortedSides = [...document.sides].sort(
    (a, b) => (SIDE_ORDER[a.side] ?? 99) - (SIDE_ORDER[b.side] ?? 99),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back to documents">
          <Text style={styles.backGlyph}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {document.label}
            {document.nationality ? ` ${NATIONALITY_FLAGS[document.nationality]}` : ''}
          </Text>
          <Text style={styles.subtitle}>
            {formatRelativeTimestamp(document.createdAt)}
            {document.nationality ? ` · ${NATIONALITY_LABELS[document.nationality]}` : ''}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {sortedSides.map(side => (
          <View key={side.side} style={styles.page}>
            <Text style={styles.pageLabel}>
              {side.side === 'front' ? 'Front side' : 'Back side'}
            </Text>
            <View style={styles.pageCard}>
              <Image source={{ uri: side.uri }} style={styles.pageImage} resizeMode="contain" />
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: colors.cardWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    color: colors.navy,
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 30,
    marginTop: -6,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  page: {
    marginTop: spacing.md,
  },
  pageLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pageCard: {
    backgroundColor: colors.cardWhite,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  pageImage: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: radius.md,
    backgroundColor: colors.navy,
  },
});
