import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius, spacing } from '../theme';
import { formatFileSize } from '../storage';
import type { CapturedSide, DocumentType, Nationality } from '../types';
import { DOCUMENT_LABELS, NATIONALITY_FLAGS, NATIONALITY_LABELS } from '../types';

interface Props {
  documentType: DocumentType;
  sides: CapturedSide[];
  nationality?: Nationality;
  /** Called once the user confirms a name in the naming prompt below - the
   * name they typed (already saved with the default label by this point,
   * this just renames it) becomes what shows in Home's Recent scans and the
   * Documents tab from then on. */
  onSaveWithName: (name: string) => void;
  onScanAnother: () => void;
  onOpenDocument: () => void;
  onDone: () => void;
}

export function SuccessScreen({
  documentType,
  sides,
  nationality,
  onSaveWithName,
  onScanAnother,
  onOpenDocument,
  onDone,
}: Props) {
  const docLabel = DOCUMENT_LABELS[documentType];
  const totalFileSize = sides.reduce((total, side) => total + side.fileSizeBytes, 0);

  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState(docLabel);

  const openNamePrompt = () => {
    setNameInput(docLabel);
    setNameModalVisible(true);
  };

  const confirmName = () => {
    setNameModalVisible(false);
    onSaveWithName(nameInput.trim() || docLabel);
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (nameModalVisible) {
        setNameModalVisible(false);
      } else {
        onDone();
      }
      return true;
    });
    return () => subscription.remove();
  }, [nameModalVisible, onDone]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.confetti} pointerEvents="none">
        <Text style={[styles.confettiPiece, styles.confettiOne]}>●</Text>
        <Text style={[styles.confettiPiece, styles.confettiTwo]}>◆</Text>
        <Text style={[styles.confettiPiece, styles.confettiThree]}>—</Text>
        <Text style={[styles.confettiPiece, styles.confettiFour]}>●</Text>
        <Text style={[styles.confettiPiece, styles.confettiFive]}>◆</Text>
      </View>

      <View style={styles.checkShadowWrap}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkGlyph}>{'✓'}</Text>
        </View>
      </View>

      <Text style={styles.title}>Document saved successfully!</Text>
      {nationality && (
        <Text style={styles.nationalityLine}>
          {NATIONALITY_FLAGS[nationality]} {NATIONALITY_LABELS[nationality]}
        </Text>
      )}
      <Text style={styles.subtitle}>
        Both sides were captured clearly and{'\n'}stored securely in ID Vault.
      </Text>

      <View style={styles.thumbRow}>
        {(['front', 'back'] as const).map(side => {
          const captured = sides.find(item => item.side === side);
          return (
          <View key={side} style={styles.thumbColumn}>
            <View style={styles.thumbCard}>
              {captured ? (
                <>
                  <Image source={{ uri: captured.uri }} style={styles.thumbImage} resizeMode="cover" />
                  <View style={styles.thumbCheck}>
                    <Text style={styles.thumbCheckText}>✓</Text>
                  </View>
                </>
              ) : (
                <View style={styles.thumbPlaceholder}><Text style={styles.thumbPlaceholderGlyph}>⌗</Text></View>
              )}
            </View>
            <Text style={styles.thumbLabel}>{side === 'front' ? 'Front side' : 'Back side'}</Text>
          </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.summaryCard}
        onPress={openNamePrompt}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`Edit document name, currently ${docLabel}`}
        accessibilityHint="Opens a dialog to rename this document">
        <View style={styles.summaryIcon}><Text style={styles.summaryIconText}>📁</Text></View>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>{docLabel}</Text>
          <Text style={styles.summaryMeta}>
            {sides.length} {sides.length === 1 ? 'page' : 'pages'} · {formatFileSize(totalFileSize)}
          </Text>
        </View>
        <View style={styles.editIconButton}>
          <Ionicons name="create-outline" color={colors.purple} size={20} />
        </View>
      </TouchableOpacity>

      <View style={styles.spacerBottom} />

      <PrimaryButton label="Open document" onPress={onOpenDocument} style={styles.saveButton} />
      <TouchableOpacity style={styles.scanAnotherButton} onPress={onScanAnother} activeOpacity={0.7}>
        <Text style={styles.scanAnotherLabel}>Scan another</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.doneButton} onPress={onDone} activeOpacity={0.7}>
        <Text style={styles.doneLabel}>Done</Text>
      </TouchableOpacity>

      <Modal
        visible={nameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNameModalVisible(false)}>
        <View style={styles.nameBackdrop}>
          <TouchableOpacity
            style={styles.nameBackdropTouchable}
            activeOpacity={1}
            onPress={() => setNameModalVisible(false)}
          />
          <View style={styles.nameCard}>
            <Text style={styles.nameTitle}>Name this document</Text>
            <Text style={styles.nameBody}>
              Give it a name so it's easy to find later in Documents and Recent scans.
            </Text>
            <TextInput
              style={styles.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder={docLabel}
              placeholderTextColor={colors.mutedLight}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={confirmName}
            />
            <PrimaryButton label="Save" onPress={confirmName} style={styles.nameSaveButton} />
            <TouchableOpacity
              style={styles.nameCancelButton}
              onPress={() => setNameModalVisible(false)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Cancel">
              <Text style={styles.nameCancelLabel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    paddingTop: 28,
  },
  confetti: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    height: 120,
  },
  confettiPiece: {
    position: 'absolute',
    fontSize: 14,
    fontWeight: '800',
  },
  confettiOne: {
    left: '12%',
    top: 35,
    color: colors.purple,
  },
  confettiTwo: {
    left: '28%',
    top: 6,
    color: colors.orange,
  },
  confettiThree: {
    right: '25%',
    top: 12,
    color: colors.pink,
    transform: [{ rotate: '45deg' }],
  },
  confettiFour: {
    right: '11%',
    top: 50,
    color: colors.success,
  },
  confettiFive: {
    left: '18%',
    top: 110,
    color: colors.warning,
  },
  spacerBottom: {
    flex: 1,
    minHeight: 10,
  },
  checkShadowWrap: {
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  checkCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    borderWidth: 5,
    borderColor: colors.successSoft,
  },
  checkGlyph: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.navy,
    marginTop: 17,
  },
  nationalityLine: {
    fontSize: 14,
    color: colors.navySubtle,
    marginTop: 8,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    color: colors.navySubtle,
    textAlign: 'center',
    marginTop: 11,
    paddingHorizontal: spacing.lg,
    lineHeight: 21,
  },
  thumbRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    width: '100%',
  },
  thumbColumn: {
    flex: 1,
  },
  thumbCard: {
    width: '100%',
    aspectRatio: 1.586,
    borderRadius: 10,
    backgroundColor: colors.cardWhite,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  thumbCheck: {
    position: 'absolute',
    right: 7,
    bottom: 7,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.cardWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbCheckText: {
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 10,
    fontWeight: '800',
  },
  thumbPlaceholder: {
    flex: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderGlyph: {
    color: colors.mutedLight,
    fontSize: 24,
  },
  thumbLabel: {
    marginTop: 7,
    color: colors.navySubtle,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryCard: {
    width: '100%',
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 11,
    backgroundColor: colors.cardWhite,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  summaryIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryIconText: {
    fontSize: 19,
  },
  summaryCopy: {
    flex: 1,
    marginLeft: 8,
  },
  summaryTitle: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '800',
  },
  summaryMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  editIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  saveButton: {
    alignSelf: 'stretch',
    borderRadius: radius.pill,
  },
  scanAnotherButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 11,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.purple,
  },
  scanAnotherLabel: {
    color: colors.purple,
    fontWeight: '800',
    fontSize: 15,
  },
  doneButton: {
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    marginBottom: 0,
  },
  doneLabel: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 15,
  },
  nameBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 12, 30, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  nameBackdropTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  nameCard: {
    width: '100%',
    backgroundColor: colors.cardWhite,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'stretch',
  },
  nameTitle: {
    color: colors.navy,
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  nameBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  nameInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    fontWeight: '600',
    color: colors.navy,
    backgroundColor: colors.backgroundSoft,
    marginBottom: spacing.lg,
  },
  nameSaveButton: {
    alignSelf: 'stretch',
  },
  nameCancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  nameCancelLabel: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 15,
  },
});
