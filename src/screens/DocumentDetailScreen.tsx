import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { formatRelativeTimestamp } from '../storage';
import { ScreenHeader } from '../components/ScreenHeader';
import type { SavedDocument } from '../types';
import { NATIONALITY_FLAGS, NATIONALITY_LABELS } from '../types';

interface Props {
  document: SavedDocument;
  onBack: () => void;
  /** Called with the trimmed new name when the user confirms a rename. */
  onRename: (name: string) => void;
}

const SIDE_ORDER: Record<string, number> = { front: 0, back: 1 };

/**
 * Full-page "document viewer" reached by tapping a row in the Documents tab.
 * Shows every captured side (front, then back) stacked as full-width pages
 * on a white background, similar to how a scanned multi-page PDF would be
 * presented, rather than just the small list-row thumbnail.
 */
export function DocumentDetailScreen({ document, onBack, onRename }: Props) {
  const sortedSides = [...document.sides].sort(
    (a, b) => (SIDE_ORDER[a.side] ?? 99) - (SIDE_ORDER[b.side] ?? 99),
  );

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(document.label);

  const startEditingName = () => {
    setNameInput(document.label);
    setIsEditingName(true);
  };

  const confirmRename = () => {
    setIsEditingName(false);
    const trimmed = nameInput.trim();
    if (trimmed.length > 0 && trimmed !== document.label) {
      onRename(trimmed);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        variant="inline"
        onBack={onBack}
        accessibilityLabel="Back to documents"
        right={
          <TouchableOpacity
            style={styles.renameButton}
            onPress={isEditingName ? confirmRename : startEditingName}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isEditingName ? 'Save name' : 'Rename document'}>
            <Text style={styles.renameGlyph}>{isEditingName ? 'Save' : 'Rename'}</Text>
          </TouchableOpacity>
        }>
        <Text style={styles.eyebrow}>DOCUMENT DETAILS</Text>
        {isEditingName ? (
          <TextInput
            style={styles.titleInput}
            value={nameInput}
            onChangeText={setNameInput}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={confirmRename}
          />
        ) : (
          <Text style={styles.title} numberOfLines={1}>
            {document.label}
            {document.nationality ? ` ${NATIONALITY_FLAGS[document.nationality]}` : ''}
          </Text>
        )}
        <Text style={styles.subtitle}>
          {formatRelativeTimestamp(document.createdAt)}
          {document.nationality ? ` · ${NATIONALITY_LABELS[document.nationality]}` : ''}
        </Text>
      </ScreenHeader>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryValue}>{sortedSides.length}</Text>
            <Text style={styles.summaryLabel}>
              page{sortedSides.length === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryTitle}>Stored securely on this device</Text>
            <Text style={styles.summaryDescription}>
              Captured images are available only inside your vault.
            </Text>
          </View>
        </View>

        {sortedSides.map(side => (
          <View key={side.side} style={styles.page}>
            <View style={styles.pageHeading}>
              <Text style={styles.pageLabel}>
                {side.side === 'front' ? 'Front side' : 'Back side'}
              </Text>
              <Text style={styles.pageNumber}>
                {sortedSides.indexOf(side) + 1} / {sortedSides.length}
              </Text>
            </View>
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
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.purple,
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.navy,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.navy,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.purple,
    paddingVertical: 0,
    paddingBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  renameButton: {
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.cardWhite,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  renameGlyph: {
    color: colors.purple,
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.purpleSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.purple,
    textAlign: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#DDD5F7',
    marginHorizontal: spacing.md,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.navy,
  },
  summaryDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    marginTop: 2,
  },
  page: {
    marginTop: spacing.md,
  },
  pageHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  pageLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.navySubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pageNumber: {
    fontSize: 11,
    color: colors.muted,
  },
  pageCard: {
    backgroundColor: colors.cardWhite,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageImage: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: radius.md,
    backgroundColor: colors.navy,
  },
});
