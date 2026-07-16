import React from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, docTypeGradients, elevationShadow } from '../theme';
import type { DocumentType } from '../types';

interface Props {
  documentType: DocumentType;
  size?: number;
}

/**
 * Small rounded-square gradient tile with a simple ID-card glyph drawn from Views,
 * matching the icon tiles in the mockups. A soft top-left gloss highlight plus a
 * tinted drop shadow give it the glossy "3D bubble" look used across the app
 * (bottom tab bubble, avatar, success checkmark).
 */
export function GradientIconTile({ documentType, size = 48 }: Props) {
  const gradientColors = docTypeGradients[documentType] ?? [colors.purple, colors.pink];

  return (
    <View
      style={[
        styles.shadowWrap,
        { width: size, height: size, borderRadius: size * 0.32, shadowColor: gradientColors[0] },
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.tile, { width: size, height: size, borderRadius: size * 0.32 }]}
      >
        <View
          style={[
            styles.gloss,
            { width: size * 0.6, height: size * 0.6, borderRadius: size * 0.3, top: -size * 0.18, left: -size * 0.16 },
          ]}
        />
        <View style={[styles.card, { width: size * 0.52, height: size * 0.38 }]}>
          <View style={styles.photoDot} />
          <View style={styles.lines}>
            <View style={styles.lineLong} />
            <View style={styles.lineShort} />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    ...elevationShadow('tile'),
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gloss: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  card: {
    borderRadius: 4,
    borderWidth: 1.4,
    borderColor: 'rgba(255,255,255,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  photoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginRight: 4,
  },
  lines: {
    flex: 1,
    justifyContent: 'center',
  },
  lineLong: {
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginBottom: 3,
    width: '100%',
  },
  lineShort: {
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
    width: '60%',
  },
});
