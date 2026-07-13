import React from 'react';
import { StyleSheet, View } from 'react-native';

interface IconProps {
  color: string;
  size?: number;
}

/** Simple house glyph built from Views (roof triangle + body + door notch). */
export function HomeIcon({ color, size = 22 }: IconProps) {
  const roofSize = size * 0.34;
  const bodyWidth = size * 0.68;
  const bodyHeight = size * 0.42;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          width: 0,
          height: 0,
          borderLeftWidth: roofSize,
          borderRightWidth: roofSize,
          borderBottomWidth: roofSize,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
        }}
      />
      <View
        style={{
          width: bodyWidth,
          height: bodyHeight,
          backgroundColor: color,
          borderRadius: 2,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: bodyWidth * 0.26,
            height: bodyHeight * 0.7,
            backgroundColor: 'rgba(0,0,0,0.18)',
            borderTopLeftRadius: 1,
            borderTopRightRadius: 1,
            marginTop: bodyHeight * 0.3,
          }}
        />
      </View>
    </View>
  );
}

/** Simple folder glyph: a body rectangle with a small tab notch on the top-left. */
export function FolderIcon({ color, size = 22 }: IconProps) {
  const width = size * 0.86;
  const height = size * 0.62;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width, alignItems: 'flex-start' }}>
        <View
          style={{
            width: width * 0.42,
            height: height * 0.22,
            backgroundColor: color,
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
          }}
        />
        <View
          style={{
            width,
            height,
            backgroundColor: color,
            borderRadius: 3,
            borderTopLeftRadius: 0,
          }}
        />
      </View>
    </View>
  );
}

/** Gear glyph: a ring with radial teeth, computed with basic trigonometry (no icon-font dep). */
export function SettingsIcon({ color, size = 22 }: IconProps) {
  const center = size / 2;
  const ringOuter = size * 0.62;
  const ringInner = size * 0.28;
  const toothCount = 6;
  const toothWidth = size * 0.15;
  const toothHeight = size * 0.2;
  const toothRadius = size * 0.34;

  const teeth = Array.from({ length: toothCount }).map((_, i) => {
    const angleDeg = (360 / toothCount) * i;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = center + toothRadius * Math.cos(angleRad) - toothWidth / 2;
    const y = center + toothRadius * Math.sin(angleRad) - toothHeight / 2;
    return (
      <View
        key={i}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: toothWidth,
          height: toothHeight,
          backgroundColor: color,
          borderRadius: 1.5,
          transform: [{ rotate: `${angleDeg + 90}deg` }],
        }}
      />
    );
  });

  return (
    <View style={{ width: size, height: size }}>
      {teeth}
      <View
        style={[
          styles.ring,
          {
            width: ringOuter,
            height: ringOuter,
            borderRadius: ringOuter / 2,
            borderWidth: ringOuter * 0.28,
            borderColor: color,
            left: center - ringOuter / 2,
            top: center - ringOuter / 2,
          },
        ]}
      />
      <View
        style={{
          position: 'absolute',
          left: center - ringInner / 2,
          top: center - ringInner / 2,
          width: ringInner,
          height: ringInner,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
  },
});
