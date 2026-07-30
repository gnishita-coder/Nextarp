import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { colors, elevationShadow } from '../theme';

interface Props {
  onPress: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function AppBackButton({
  onPress,
  accessibilityLabel = 'Go back',
  style,
}: Props) {
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
      <Ionicons name="chevron-back" size={22} color={colors.navy} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardWhite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...elevationShadow('avatar'),
  },
});
