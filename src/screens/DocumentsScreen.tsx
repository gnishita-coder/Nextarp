import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientIconTile } from '../components/GradientIconTile';
import { colors, radius, spacing } from '../theme';
import { formatRelativeTimestamp } from '../storage';
import type { SavedDocument } from '../types';
import { NATIONALITY_FLAGS } from '../types';

interface Props {
  documents: SavedDocument[];
  /** Called when a row is tapped - opens that document's full front+back viewer. */
  onOpenDocument: (id: string) => void;
}

/** Full list of every saved document, reached from the "View all" link or the Documents tab. */
export function DocumentsScreen({ documents, onOpenDocument }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>My documents</Text>
      <Text style={styles.subtitle}>
        {documents.length} document{documents.length === 1 ? '' : 's'} saved on this device
      </Text>

      <FlatList
        data={documents}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Nothing scanned yet. Start a scan from the Home tab.
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => onOpenDocument(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.label}`}>
            {item.sides[0]?.uri ? (
              <Image source={{ uri: item.sides[0].uri }} style={styles.thumbnail} resizeMode="cover" />
            ) : (
              <GradientIconTile documentType={item.documentType} size={48} />
            )}
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>
                {item.label}
                {item.nationality ? ` ${NATIONALITY_FLAGS[item.nationality]}` : ''}
              </Text>
              <Text style={styles.rowTimestamp}>
                {formatRelativeTimestamp(item.createdAt)} · {item.sides.length} side
                {item.sides.length === 1 ? '' : 's'}
              </Text>
            </View>
            <Text style={styles.chevron}>{'>'}</Text>
          </TouchableOpacity>
        )}
      />
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
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardWhite,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
  },
  rowTimestamp: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  chevron: {
    color: colors.mutedLight,
    fontSize: 18,
  },
});
