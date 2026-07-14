import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../theme';

interface Props {
  children: React.ReactNode;
  onDelete: () => void;
  /** Applied to the outer wrapper - use for margin/spacing between rows. */
  style?: any;
}

const DELETE_WIDTH = 88;

/**
 * Wraps a row with iOS/Android-style "swipe left to reveal Delete" behaviour.
 * Implemented with core React Native Animated + PanResponder (no extra
 * gesture/reanimated dependency installed in this project) - a horizontal
 * drag on the row slides it left to reveal a red Delete button underneath;
 * releasing past the halfway point snaps it open, otherwise it snaps closed.
 * Tapping the revealed Delete button fires onDelete and closes the row again.
 */
export function SwipeableRow({ children, onDelete, style }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const currentOffset = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_evt, gesture) => {
        const next = Math.min(0, Math.max(-DELETE_WIDTH, currentOffset.current + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const shouldOpen = currentOffset.current + gesture.dx < -DELETE_WIDTH / 2;
        const target = shouldOpen ? -DELETE_WIDTH : 0;
        currentOffset.current = target;
        Animated.spring(translateX, {
          toValue: target,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      },
      onPanResponderTerminate: () => {
        currentOffset.current = 0;
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      },
    }),
  ).current;

  const handleDelete = () => {
    currentOffset.current = 0;
    Animated.timing(translateX, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    onDelete();
  };

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.deleteBackdrop}>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.8}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View
        style={[styles.foreground, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  deleteBackdrop: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: colors.danger,
  },
  deleteButton: {
    width: DELETE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  foreground: {
    backgroundColor: 'transparent',
  },
});
