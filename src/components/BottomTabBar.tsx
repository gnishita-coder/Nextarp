import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, type IoniconsIconName } from '@react-native-vector-icons/ionicons/static';
import { colors, elevationShadow } from '../theme';

export type TabKey = 'home' | 'documents' | 'settings';

interface Props {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

const TABS: {
  key: TabKey;
  label: string;
  activeIcon: IoniconsIconName;
  inactiveIcon: IoniconsIconName;
}[] = [
  { key: 'home', label: 'Home', activeIcon: 'home', inactiveIcon: 'home-outline' },
  {
    key: 'documents',
    label: 'Documents',
    activeIcon: 'documents',
    inactiveIcon: 'documents-outline',
  },
  { key: 'settings', label: 'Settings', activeIcon: 'settings', inactiveIcon: 'settings-outline' },
];

/** Compact floating navigation card used on the vault screens. */
export function BottomTabBar({ active, onChange }: Props) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.card}>
        {TABS.map(({ key, label, activeIcon, inactiveIcon }) => {
          const isActive = key === active;
          return (
            <TouchableOpacity
              key={key}
              style={styles.tab}
              activeOpacity={0.75}
              onPress={() => onChange(key)}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: isActive }}
            >
              <View style={styles.iconPlain}>
                <Ionicons
                  name={isActive ? activeIcon : inactiveIcon}
                  color={isActive ? colors.purple : '#3D3948'}
                  size={24}
                />
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.cardWhite,
    height: 74,
    borderRadius: 22,
    marginHorizontal: 12,
    marginTop: 5,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...elevationShadow('tabBar'),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  iconPlain: {
    width: '100%',
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    width: '100%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: '#3D3948',
  },
  labelActive: {
    color: colors.purple,
    fontWeight: '800',
  },
});
