import React from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, docTypeGradients, elevationShadow } from '../theme';
import type { DocumentType } from '../types';
import { FrameCornersIcon } from './ModeIcons';

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
        <View style={[styles.scanIcon, { width: size * 0.52, height: size * 0.52 }]}>
          <FrameCornersIcon color="#FFFFFF" size={size * 0.52} />
          {documentType === 'passport' ? (
            <View
              style={[
                styles.passportCircle,
                {
                  width: size * 0.14,
                  height: size * 0.14,
                  borderRadius: size * 0.07,
                },
              ]}
            />
          ) : (
            <View
              style={[
                styles.scanDocument,
                {
                  width: size * 0.23,
                  height: size * 0.16,
                  borderRadius: size * 0.045,
                },
              ]}>
              <View
                style={[
                  styles.scanDot,
                  {
                    width: size * 0.05,
                    height: size * 0.05,
                    borderRadius: size * 0.025,
                  },
                ]}
              />
              <View style={[styles.scanLine, { width: size * 0.07 }]} />
            </View>
          )}
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
  scanIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanDocument: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  scanDot: {
    backgroundColor: '#FFFFFF',
  },
  scanLine: {
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  passportCircle: {
    position: 'absolute',
    borderWidth: 1.6,
    borderColor: '#FFFFFF',
  },
});
