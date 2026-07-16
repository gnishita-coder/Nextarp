import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { colors, elevationShadow, primaryGradient } from '../theme';
import { FolderIcon, HomeIcon, SettingsIcon } from './TabIcons';

export type TabKey = 'home' | 'documents' | 'settings';

interface Props {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

const TABS: { key: TabKey; label: string; Icon: typeof HomeIcon }[] = [
  { key: 'home', label: 'Home', Icon: HomeIcon },
  { key: 'documents', label: 'Documents', Icon: FolderIcon },
  { key: 'settings', label: 'Settings', Icon: SettingsIcon },
];

/**
 * Floating pill-style bottom tab bar. The active tab sits inside a small
 * gradient "bubble" with a glossy highlight, echoing the glossy-sphere look
 * used elsewhere in the app (the success checkmark, the avatar).
 */
export function BottomTabBar({ active, onChange }: Props) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.card}>
        {TABS.map(({ key, label, Icon }) => {
          const isActive = key === active;
          return (
            <TouchableOpacity
              key={key}
              style={styles.tab}
              activeOpacity={0.75}
              onPress={() => onChange(key)}
            >
              {isActive ? (
                <LinearGradient
                  colors={primaryGradient.colors}
                  start={primaryGradient.start}
                  end={primaryGradient.end}
                  style={styles.bubble}
                >
                  <View style={styles.glossHighlight} />
                  <Icon color="#FFFFFF" size={20} />
                </LinearGradient>
              ) : (
                <View style={styles.iconPlain}>
                  <Icon color={colors.mutedLight} size={20} />
                </View>
              )}
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
    backgroundColor: 'transparent',
  },
  card: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.cardWhite,
    borderRadius: 26,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 6,
    ...elevationShadow('tabBar'),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  bubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...elevationShadow('bubble'),
  },
  glossHighlight: {
    position: 'absolute',
    top: -10,
    left: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  iconPlain: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedLight,
  },
  labelActive: {
    color: colors.purple,
    fontWeight: '700',
  },
});
