import React, { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { GradientIconTile } from '../components/GradientIconTile';
import { colors, elevationShadow, radius, spacing } from '../theme';
import { formatFileSize, formatRelativeTimestamp } from '../storage';
import type { SavedDocument } from '../types';
import { NATIONALITY_FLAGS, NATIONALITY_LABELS } from '../types';

interface Props {
  documents: SavedDocument[];
  /** Called when a row is tapped - opens that document's full front+back viewer. */
  onOpenDocument: (id: string) => void;
  onDeleteDocument: (id: string) => void;
}

/** Full list of every saved document, reached from the "View all" link or the Documents tab. */
export function DocumentsScreen({ documents, onOpenDocument, onDeleteDocument }: Props) {
  const [query, setQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return documents;
    }
    return documents.filter(item => item.label.toLowerCase().includes(normalizedQuery));
  }, [documents, query]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!searchVisible) return false;
      setSearchVisible(false);
      setQuery('');
      return true;
    });
    return () => subscription.remove();
  }, [searchVisible]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.heading}>
        <View>
          <Text style={styles.title}>My documents</Text>
          <Text style={styles.subtitle}>
            {documents.length} document{documents.length === 1 ? '' : 's'} saved on this device
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.toolButton}
            activeOpacity={0.7}
            onPress={() => {
              setSearchVisible(current => !current);
              if (searchVisible) setQuery('');
            }}
            accessibilityRole="button"
            accessibilityLabel="Search documents">
            <View style={styles.searchGlyph}>
              <View style={styles.searchCircle} />
              <View style={styles.searchHandle} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {searchVisible && (
        <View style={styles.searchBox}>
          <View style={[styles.searchGlyph, styles.searchBoxGlyph]}>
            <View style={styles.searchCircle} />
            <View style={styles.searchHandle} />
          </View>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search documents"
            placeholderTextColor={colors.mutedLight}
            returnKeyType="search"
            accessibilityLabel="Search documents"
            autoFocus
          />
        </View>
      )}

      <FlatList
        data={filteredDocuments}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {documents.length === 0 ? 'No documents yet' : 'No matching documents'}
            </Text>
            <Text style={styles.emptyText}>
              {documents.length === 0
                ? 'Nothing scanned yet. Start a scan from the Home tab.'
                : 'Try searching with a different document name.'}
            </Text>
          </View>
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
              <View style={styles.titleLine}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.label}
                </Text>
                {item.nationality ? (
                  <Text style={styles.flag}>{NATIONALITY_FLAGS[item.nationality]}</Text>
                ) : null}
              </View>
              {item.nationality && (
                <Text style={styles.country}>{NATIONALITY_LABELS[item.nationality]}</Text>
              )}
              <Text style={styles.rowMetadata} numberOfLines={1}>
                {formatRelativeTimestamp(item.createdAt)} · {item.sides.length} page
                {item.sides.length === 1 ? '' : 's'} ·{' '}
                {formatFileSize(item.sides.reduce((total, side) => total + side.fileSizeBytes, 0))}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.overflowIcon}
              onPress={() => onDeleteDocument(item.id)}
              activeOpacity={0.65}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.label}`}>
              <Ionicons name="ellipsis-vertical" color={colors.muted} size={20} />
            </TouchableOpacity>
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
    paddingHorizontal: 17,
  },
  heading: {
    minHeight: 54,
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  toolButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.cardWhite,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevationShadow('avatar'),
  },
  searchBox: {
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.cardWhite,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginTop: 16,
  },
  searchGlyph: {
    width: 18,
    height: 18,
  },
  searchBoxGlyph: {
    marginRight: 8,
  },
  searchCircle: {
    position: 'absolute',
    left: 1,
    top: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.navy,
  },
  searchHandle: {
    position: 'absolute',
    width: 7,
    height: 2,
    right: 0,
    bottom: 3,
    borderRadius: 1,
    backgroundColor: colors.navy,
    transform: [{ rotate: '45deg' }],
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 13,
    color: colors.navy,
  },
  listContent: {
    paddingTop: 20,
    paddingBottom: spacing.xl,
  },
  emptyCard: {
    backgroundColor: colors.cardWhite,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardWhite,
    height: 82,
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingVertical: 8,
    marginBottom: 9,
    gap: 10,
    overflow: 'hidden',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 7,
    backgroundColor: colors.backgroundSoft,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.navy,
  },
  flag: {
    fontSize: 13,
  },
  country: {
    color: colors.navySubtle,
    fontSize: 12,
    marginTop: 2,
  },
  rowMetadata: {
    fontSize: 11,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  overflowIcon: {
    width: 28,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
