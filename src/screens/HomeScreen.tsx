import React from 'react';
import {
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { GradientIconTile } from '../components/GradientIconTile';
import { FrameCornersIcon, TapIcon } from '../components/ModeIcons';
import { colors, primaryGradient, radius, spacing } from '../theme';
import { formatRelativeTimestamp } from '../storage';
import type { CaptureMode, Nationality, SavedDocument } from '../types';
import { NATIONALITY_FLAGS, NATIONALITY_CODES } from '../types';

interface Props {
  documents: SavedDocument[];
  captureMode: CaptureMode;
  onChangeCaptureMode: (mode: CaptureMode) => void;
  /** Called when the user taps Automatic or Manual - should open the document-type picker. */
  onRequestScan: () => void;
  onViewAllDocuments: () => void;
  /** Currently selected nationality (small header icon) and handler to open its picker sheet. */
  nationality: Nationality;
  onPressNationality: () => void;
}

export function HomeScreen({
  documents,
  captureMode,
  onChangeCaptureMode,
  onRequestScan,
  onViewAllDocuments,
  nationality,
  onPressNationality,
}: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>ID vault</Text>
          <Text style={styles.subtitle}>
            {documents.length} document{documents.length === 1 ? '' : 's'} saved
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.nationalityButton}
            onPress={onPressNationality}
            activeOpacity={0.8}>
            <Text style={styles.nationalityFlag}>{NATIONALITY_FLAGS[nationality]}</Text>
            <Text style={styles.nationalityCode}>{NATIONALITY_CODES[nationality]}</Text>
          </TouchableOpacity>
          <View style={styles.avatarShadowWrap}>
            <LinearGradient
              colors={primaryGradient.colors}
              start={primaryGradient.start}
              end={primaryGradient.end}
              style={styles.avatar}
            >
              <View style={styles.avatarGloss} />
              <Text style={styles.avatarLabel}>IF</Text>
            </LinearGradient>
          </View>
        </View>
      </View>

      <LinearGradient
        colors={primaryGradient.colors}
        start={primaryGradient.start}
        end={primaryGradient.end}
        style={styles.heroCard}
      >
        <View style={styles.heroBlob} pointerEvents="none" />

        <View style={styles.heroIconWrap}>
          <GradientIconTile documentType="driving_licence" size={56} />
        </View>
        <Text style={styles.heroTitle}>Scan a new document</Text>
        <Text style={styles.heroSubtitle}>Driving licence or passport</Text>

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeButton, captureMode === 'automatic' && styles.modeButtonActive]}
            activeOpacity={0.85}
            onPress={() => {
              onChangeCaptureMode('automatic');
              onRequestScan();
            }}
          >
            <View
              style={[
                styles.modeIconBubble,
                captureMode === 'automatic'
                  ? styles.modeIconBubbleActive
                  : styles.modeIconBubbleInactive,
              ]}
            >
              {captureMode === 'automatic' && <View style={styles.modeIconGloss} />}
              <FrameCornersIcon
                color={captureMode === 'automatic' ? colors.purpleDeep : '#FFFFFF'}
                size={18}
              />
            </View>
            <Text
              style={[
                styles.modeLabel,
                captureMode === 'automatic' ? styles.modeLabelActive : styles.modeLabelInactive,
              ]}
            >
              Automatic
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, captureMode === 'manual' && styles.modeButtonActive]}
            activeOpacity={0.85}
            onPress={() => {
              onChangeCaptureMode('manual');
              onRequestScan();
            }}
          >
            <View
              style={[
                styles.modeIconBubble,
                captureMode === 'manual' ? styles.modeIconBubbleActive : styles.modeIconBubbleInactive,
              ]}
            >
              {captureMode === 'manual' && <View style={styles.modeIconGloss} />}
              <TapIcon color={captureMode === 'manual' ? colors.purpleDeep : '#FFFFFF'} size={18} />
            </View>
            <Text
              style={[
                styles.modeLabel,
                captureMode === 'manual' ? styles.modeLabelActive : styles.modeLabelInactive,
              ]}
            >
              Manual
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Recent scans</Text>
        {documents.length > 0 && (
          <TouchableOpacity onPress={onViewAllDocuments}>
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={documents.slice(0, 5)}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No scans yet. Tap "Scan a new document" to capture your first ID.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
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
                {formatRelativeTimestamp(item.createdAt)}
              </Text>
            </View>
            <Text style={styles.chevron}>{'>'}</Text>
          </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 15,
    color: colors.muted,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nationalityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardWhite,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nationalityFlag: {
    fontSize: 18,
  },
  nationalityCode: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.navy,
  },
  avatarShadowWrap: {
    shadowColor: colors.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarGloss: {
    position: 'absolute',
    top: -10,
    left: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  avatarLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  heroCard: {
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  heroBlob: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroIconWrap: {
    marginBottom: spacing.md,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  modeIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modeIconBubbleActive: {
    backgroundColor: colors.purple,
    ...Platform.select({
      ios: {
        shadowColor: colors.purple,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  modeIconBubbleInactive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  modeIconGloss: {
    position: 'absolute',
    top: -8,
    left: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  modeLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  modeLabelActive: {
    color: colors.purpleDeep,
  },
  modeLabelInactive: {
    color: '#FFFFFF',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  listTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.navy,
  },
  viewAll: {
    color: colors.purple,
    fontWeight: '600',
    fontSize: 14,
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
