import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

const TICK_LENGTH = 22;
const TICK_THICKNESS = 3;

export type AlignmentStatus = 'searching' | 'aligned';

/**
 * Document-alignment rectangle. Renders as a dashed, muted-white outline while
 * we're still "looking" for the document (searching), then switches to a
 * solid green outline once the document reads as correctly framed (aligned) -
 * the standard go/no-go convention for scan UIs.
 *
 * Per feedback: the old design used filled gradient corner squares that read
 * as "clunky little boxes". This version uses thin corner tick marks (two
 * short line segments per corner, no fill) so the frame reads as a clean
 * reticle instead of stickers glued to the corners.
 */
export function AlignmentFrame({
  width,
  height,
  status = 'searching',
}: {
  width: number;
  height: number;
  status?: AlignmentStatus;
}) {
  const isAligned = status === 'aligned';
  const lineColor = isAligned ? colors.success : 'rgba(255,255,255,0.55)';
  const tickColor = isAligned ? colors.success : 'rgba(255,255,255,0.9)';

  return (
    <View style={[styles.wrapper, { width, height }]} pointerEvents="none">
      <View
        style={[
          styles.border,
          {
            borderColor: lineColor,
            borderStyle: isAligned ? 'solid' : 'dashed',
            borderWidth: isAligned ? 2.5 : 1.5,
          },
        ]}
      />
      <Tick color={tickColor} style={styles.topLeft} rotate={0} />
      <Tick color={tickColor} style={styles.topRight} rotate={90} />
      <Tick color={tickColor} style={styles.bottomRight} rotate={180} />
      <Tick color={tickColor} style={styles.bottomLeft} rotate={270} />
    </View>
  );
}

/** A thin "L" made of two short bars, rotated per-corner. */
function Tick({ color, style, rotate }: { color: string; style: object; rotate: number }) {
  return (
    <View style={[styles.tick, style, { transform: [{ rotate: `${rotate}deg` }] }]}>
      <View style={[styles.tickBarHorizontal, { backgroundColor: color }]} />
      <View style={[styles.tickBarVertical, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
  },
  tick: {
    position: 'absolute',
    width: TICK_LENGTH,
    height: TICK_LENGTH,
  },
  tickBarHorizontal: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: TICK_LENGTH,
    height: TICK_THICKNESS,
    borderRadius: TICK_THICKNESS / 2,
  },
  tickBarVertical: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: TICK_THICKNESS,
    height: TICK_LENGTH,
    borderRadius: TICK_THICKNESS / 2,
  },
  topLeft: {
    top: -TICK_THICKNESS / 2,
    left: -TICK_THICKNESS / 2,
  },
  topRight: {
    top: -TICK_THICKNESS / 2,
    right: -TICK_THICKNESS / 2,
  },
  bottomRight: {
    bottom: -TICK_THICKNESS / 2,
    right: -TICK_THICKNESS / 2,
  },
  bottomLeft: {
    bottom: -TICK_THICKNESS / 2,
    left: -TICK_THICKNESS / 2,
  },
});
