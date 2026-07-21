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
      hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}>
      <Ionicons name="chevron-back" size={23} color={colors.navy} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardWhite,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...elevationShadow('avatar'),
  },
});
