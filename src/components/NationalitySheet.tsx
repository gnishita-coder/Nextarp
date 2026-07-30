import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { colors, radius, spacing } from '../theme';
import { ScreenHeader } from './ScreenHeader';
import type { Nationality } from '../types';
import { NATIONALITIES, NATIONALITY_CODES, NATIONALITY_FLAGS, NATIONALITY_LABELS } from '../types';

interface Props {
  visible: boolean;
  selected: Nationality;
  onSelect: (nationality: Nationality) => void;
  onClose: () => void;
}

export function NationalitySheet({ visible, selected, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const visibleNationalities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return NATIONALITIES;
    return NATIONALITIES.filter(code =>
      `${NATIONALITY_LABELS[code]} ${NATIONALITY_CODES[code]}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader variant="inline" onBack={onClose} accessibilityLabel="Back" />

        <View style={styles.content}>
          <Text style={styles.title}>Select your nationality</Text>
          <Text style={styles.subtitle}>Select the country that issued{'\n'}your ID</Text>

          <View style={styles.search}>
            <Ionicons name="search-outline" color={colors.muted} size={20} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search country..."
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search country"
            />
          </View>

          <View style={styles.options}>
            {visibleNationalities.map(code => {
              const isSelected = code === selected;
              return (
                <TouchableOpacity
                  key={code}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityLabel={NATIONALITY_LABELS[code]}
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => onSelect(code)}>
                  <Text style={styles.flag}>{NATIONALITY_FLAGS[code]}</Text>
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>{NATIONALITY_LABELS[code]}</Text>
                    <Text style={styles.optionSubLabel}>{NATIONALITY_CODES[code]}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark" color={colors.purple} size={24} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cancel nationality selection">
          <Text style={styles.cancelLabel}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  search: {
    height: 50,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardWhite,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.navy,
    fontSize: 14,
    paddingVertical: 0,
  },
  options: {
    marginTop: spacing.md,
    gap: 2,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 58,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.md,
  },
  optionSelected: {
    backgroundColor: colors.purpleSoft,
  },
  flag: {
    fontSize: 25,
    width: 36,
    textAlign: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.navy,
  },
  optionSubLabel: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  cancelButton: {
    marginHorizontal: 32,
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.cardWhite,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelLabel: {
    color: colors.navySubtle,
    fontWeight: '700',
    fontSize: 15,
  },
});
