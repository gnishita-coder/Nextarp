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
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { GradientIconTile } from '../components/GradientIconTile';
import { FrameCornersIcon } from '../components/ModeIcons';
import { SwipeableRow } from '../components/SwipeableRow';
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
  /** Called for "View all" - takes the user to the Documents tab list. */
  onViewAllDocuments: () => void;
  /** Called when a recent-scan row is tapped - opens that document's detail viewer. */
  onOpenDocument: (id: string) => void;
  /** Called when a row is swiped left and its Delete button is tapped. */
  onDeleteDocument: (id: string) => void;
  /** Currently selected nationality (small header icon) and handler to open its picker sheet. */
  nationality: Nationality;
  onPressNationality: () => void;
}

export function HomeScreen({
  documents,
  captureMode,
  onRequestScan,
  onViewAllDocuments,
  onOpenDocument,
  onDeleteDocument,
  nationality,
  onPressNationality,
}: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>ID Vault</Text>
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
            <Text style={styles.nationalityChevron}>⌄</Text>
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

      <View style={styles.heroCard}>
        <LinearGradient
          colors={['#5635D3', '#6741D6', '#B65D9B']}
          start={{ x: 0.85, y: 0 }}
          end={{ x: 0.1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.heroGlow} pointerEvents="none" />

        <View style={styles.heroIcon}>
          <FrameCornersIcon color="#FFFFFF" size={27} />
          <View style={styles.heroIconDocument}>
            <View style={styles.heroIconDot} />
          </View>
        </View>
        <Text style={styles.heroTitle}>Scan a new document</Text>
        <Text style={styles.heroSubtitle}>Driving licence or passport</Text>

        <TouchableOpacity
          style={styles.scanButton}
          activeOpacity={0.88}
          onPress={onRequestScan}
          accessibilityRole="button"
          accessibilityLabel="Start scan"
          accessibilityHint="Opens the document type picker">
          <View style={styles.scanButtonIcon}>
            <FrameCornersIcon color={colors.purpleDeep} size={20} />
            <View style={styles.scanButtonIconDocument}>
              <View style={styles.scanButtonIconDot} />
            </View>
          </View>
          <Text style={styles.scanButtonLabel}>Start Scan</Text>
        </TouchableOpacity>

        <Text style={styles.selectedMode}>
          {captureMode === 'automatic' ? 'Automatic mode (recommended)' : 'Manual mode'}
        </Text>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Recent scans</Text>
        {documents.length > 0 && (
          <TouchableOpacity onPress={onViewAllDocuments}>
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={documents.slice(0, 10)}
        keyExtractor={item => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No scans yet. Tap Start Scan to capture your first ID.
          </Text>
        }
        renderItem={({ item }) => (
          <SwipeableRow style={styles.swipeWrap} onDelete={() => onDeleteDocument(item.id)}>
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
                  {formatRelativeTimestamp(item.createdAt)} · {item.sides.length} sides
                </Text>
              </View>
              <View style={styles.chevron}>
                <Ionicons name="chevron-forward" color={colors.muted} size={18} />
              </View>
            </TouchableOpacity>
          </SwipeableRow>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 9,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nationalityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.cardWhite,
    borderRadius: radius.pill,
    height: 30,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nationalityFlag: {
    fontSize: 14,
  },
  nationalityCode: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.navy,
  },
  nationalityChevron: {
    color: colors.muted,
    fontSize: 11,
    marginTop: -2,
  },
  avatarShadowWrap: {
    ...Platform.select({
      ios: {
        shadowColor: colors.purple,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.22,
        shadowRadius: 5,
      },
      android: { elevation: 4 },
    }),
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    fontWeight: '800',
    fontSize: 10,
  },
  heroCard: {
    height: 300,
    marginTop: 20,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 22,
    paddingBottom: 17,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    top: -55,
    right: -52,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconDocument: {
    position: 'absolute',
    width: 11,
    height: 8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFFFFF',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    marginTop: 13,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginTop: 2,
  },
  scanButton: {
    height: 78,
    borderRadius: 11,
    backgroundColor: colors.cardWhite,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: colors.navy,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  scanButtonLabel: {
    color: colors.purpleDeep,
    fontSize: 20,
    fontWeight: '800',
  },
  scanButtonIcon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonIconDocument: {
    position: 'absolute',
    width: 9,
    height: 7,
    borderWidth: 1.5,
    borderColor: colors.purpleDeep,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardWhite,
  },
  scanButtonIconDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: colors.purpleDeep,
  },
  selectedMode: {
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 20,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 9,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
  },
  viewAll: {
    color: colors.purple,
    fontWeight: '600',
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 18,
  },
  list: {
    flex: 1,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  swipeWrap: {
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: colors.cardWhite,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardWhite,
    height: 78,
    borderRadius: 0,
    paddingHorizontal: 10,
    gap: 11,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 7,
    backgroundColor: colors.border,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.navy,
  },
  rowTimestamp: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  chevron: {
    width: 24,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
