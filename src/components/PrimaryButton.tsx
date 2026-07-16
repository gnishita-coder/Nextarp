import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { primaryGradient, radius } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

/**
 * Pill gradient CTA matched to the Android Success "Save" button.
 *
 * Padding lives on an inner View (not LinearGradient) because
 * react-native-linear-gradient on RN 0.81 / iOS ignores paddingVertical and
 * collapses to a thin unlabeled gradient strip.
 */
export function PrimaryButton({ label, onPress, disabled, loading, style }: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.touchable, style, (disabled || loading) && styles.disabled]}>
      <LinearGradient
        colors={primaryGradient.colors}
        start={primaryGradient.start}
        end={primaryGradient.end}
        style={styles.gradient}>
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.label}>{label}</Text>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.6,
  },
  gradient: {
    width: '100%',
    minHeight: 56,
    borderRadius: radius.pill,
  },
  content: {
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
