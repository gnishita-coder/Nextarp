import React from 'react';
import { StyleSheet, View } from 'react-native';

interface IconProps {
  color: string;
  size?: number;
}

/** Four corner brackets around empty space - reads as "auto-frame / auto-focus",
 * echoing the alignment-frame corners used on the scan screen. */
export function FrameCornersIcon({ color, size = 20 }: IconProps) {
  const corner = size * 0.4;
  const thickness = Math.max(2, size * 0.11);
  const cornerStyle = { width: corner, height: corner, borderColor: color, borderWidth: thickness };
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          cornerStyle,
          styles.corner,
          { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 3 },
        ]}
      />
      <View
        style={[
          cornerStyle,
          styles.corner,
          { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 3 },
        ]}
      />
      <View
        style={[
          cornerStyle,
          styles.corner,
          { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 3 },
        ]}
      />
      <View
        style={[
          cornerStyle,
          styles.corner,
          { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 3 },
        ]}
      />
    </View>
  );
}

/** Fingertip + tap ripple glyph - reads as "manual tap to capture". */
export function TapIcon({ color, size = 20 }: IconProps) {
  const dot = size * 0.34;
  const ringOne = size * 0.62;
  const ringTwo = size * 0.9;
  return (
    <View style={[styles.tapWrap, { width: size, height: size }]}>
      <View
        style={{
          position: 'absolute',
          width: ringTwo,
          height: ringTwo,
          borderRadius: ringTwo / 2,
          borderWidth: 1.4,
          borderColor: color,
          opacity: 0.35,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: ringOne,
          height: ringOne,
          borderRadius: ringOne / 2,
          borderWidth: 1.6,
          borderColor: color,
          opacity: 0.6,
        }}
      />
      <View
        style={{
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  corner: {
    position: 'absolute',
  },
  tapWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
