import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { colors, radii, spacing } from "@/design/tokens";

interface SliderProps {
  min: number;
  max: number;
  /** Current integer value. */
  value: number;
  onChange: (next: number) => void;
  /** Step. Defaults to 1. */
  step?: number;
}

/**
 * A premium-feeling integer slider built on react-native-gesture-handler.
 * - Tap to jump.
 * - Drag the thumb (or anywhere on the track) to scrub.
 * - Snaps to the nearest integer with a soft selection haptic on change.
 *
 * Built without an extra dependency; the codebase already has
 * react-native-gesture-handler and reanimated.
 */
export function Slider({ min, max, value, onChange, step = 1 }: SliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const range = Math.max(0, max - min);
  // Shared value is the value's normalised position (0..1).
  const norm = useSharedValue(range > 0 ? (value - min) / range : 0);
  const lastEmitted = useRef(value);

  // Keep the shared value in sync with prop updates.
  useEffect(() => {
    const target = range > 0 ? (value - min) / range : 0;
    norm.value = withTiming(target, { duration: 180 });
    lastEmitted.current = value;
  }, [value, min, range, norm]);

  const emit = useCallback(
    (nextValue: number) => {
      if (nextValue !== lastEmitted.current) {
        lastEmitted.current = nextValue;
        Haptics.selectionAsync().catch(() => {});
        onChange(nextValue);
      }
    },
    [onChange],
  );

  const updateFromX = useCallback(
    (x: number) => {
      if (trackWidth <= 0) return;
      const clampedX = Math.max(0, Math.min(trackWidth, x));
      const ratio = clampedX / trackWidth;
      const raw = min + ratio * range;
      const stepped = Math.round(raw / step) * step;
      const next = Math.max(min, Math.min(max, stepped));
      norm.value = withSpring((next - min) / range, { damping: 18, mass: 0.4 });
      emit(next);
    },
    [emit, max, min, norm, range, step, trackWidth],
  );

  const pan = Gesture.Pan()
    .minDistance(0)
    .onUpdate((e) => {
      "worklet";
      const x = e.x;
      const clampedX = Math.max(0, Math.min(trackWidth, x));
      norm.value = trackWidth === 0 ? 0 : clampedX / trackWidth;
      const ratio = trackWidth === 0 ? 0 : clampedX / trackWidth;
      const stepped = Math.round((min + ratio * range) / step) * step;
      const next = Math.max(min, Math.min(max, stepped));
      runOnJS(emit)(next);
    });

  const handleTrackPress = useCallback(
    (event: { nativeEvent: { locationX: number } }) => {
      updateFromX(event.nativeEvent.locationX);
    },
    [updateFromX],
  );

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, norm.value)) * 100}%`,
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    left: `${Math.max(0, Math.min(1, norm.value)) * 100}%`,
  }));

  return (
    <GestureHandlerRootView>
      <GestureDetector gesture={pan}>
        <Pressable onPress={handleTrackPress} onLayout={handleLayout}>
          <View
            style={{
              height: 36,
              justifyContent: "center",
              paddingHorizontal: 0,
            }}
          >
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.surfaceDeep,
                overflow: "hidden",
              }}
            >
              <Animated.View
                style={[
                  {
                    height: 4,
                    backgroundColor: colors.primary,
                    borderRadius: 2,
                  },
                  fillStyle,
                ]}
              />
            </View>
            <Animated.View
              style={[
                {
                  position: "absolute",
                  width: 24,
                  height: 24,
                  borderRadius: radii.lg,
                  backgroundColor: colors.surfaceElevated,
                  borderWidth: 2,
                  borderColor: colors.primary,
                  marginLeft: -12,
                  // Soft shadow.
                  shadowColor: "#000",
                  shadowOpacity: 0.12,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 3,
                },
                thumbStyle,
              ]}
            />
          </View>
        </Pressable>
      </GestureDetector>
      <View style={{ height: spacing.xxs }} />
    </GestureHandlerRootView>
  );
}
