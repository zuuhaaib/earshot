/**
 * A list you can rearrange. Press and hold a row's grip, then drag it; the
 * other rows shuffle out of the way. The arrows do the same job one step at a
 * time, for anyone who'd rather tap (or is using a screen reader).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useInks, wash } from './print';

type RowProps = {
  index: number;
  count: number;
  height: number;
  /** How far this row should shuffle while another is being dragged. */
  shift: number;
  active: boolean;
  dragging: boolean;
  dy: SharedValue<number>;
  onStart: (index: number) => void;
  onMove: (index: number, dy: number) => void;
  onEnd: () => void;
  onStep: (index: number, by: number) => void;
  label: string;
  children: React.ReactNode;
};

function Row({ index, count, height, shift, active, dragging, dy, onStart, onMove, onEnd, onStep, label, children }: RowProps) {
  const inks = useInks();
  const y = useSharedValue(0);
  useEffect(() => {
    // While a drag is on, slide aside; the moment it ends, snap home (the list has re-ordered underneath).
    y.value = dragging ? withTiming(shift, { duration: 150 }) : 0;
  }, [shift, dragging, y]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: active ? dy.value : y.value }, { scale: active ? 1.03 : 1 }],
    zIndex: active ? 10 : 0,
    opacity: active ? 0.94 : 1,
  }));

  const pan = usePanGesture({
    runOnJS: true,
    activateAfterLongPress: 140,
    onActivate: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onStart(index);
    },
    onUpdate: (e) => onMove(index, e.translationY),
    onFinalize: () => onEnd(),
  });

  const arrow = (by: number, disabled: boolean) => (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onStep(index, by);
      }}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Move ${label} ${by < 0 ? 'up' : 'down'}`}
      style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.25 : 1 }}
    >
      <Svg width={14} height={10} viewBox="0 0 14 10">
        <Path d={by < 0 ? 'M1 9 L7 2 L13 9' : 'M1 1 L7 8 L13 1'} stroke={inks.ink} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );

  return (
    <Animated.View style={[{ height, flexDirection: 'row', alignItems: 'center' }, style]}>
      <GestureDetector gesture={pan}>
        <View
          accessibilityLabel={`Hold and drag to move ${label}`}
          style={{ width: 34, height: height - 8, alignItems: 'center', justifyContent: 'center' }}
        >
          <Svg width={14} height={22} viewBox="0 0 14 22">
            {[3, 11, 19].map((cy) => (
              <React.Fragment key={cy}>
                <Circle cx={3} cy={cy} r={2.2} fill={wash(inks.ink, 0.7)} />
                <Circle cx={11} cy={cy} r={2.2} fill={wash(inks.ink, 0.7)} />
              </React.Fragment>
            ))}
          </Svg>
        </View>
      </GestureDetector>
      <View style={{ flex: 1 }}>{children}</View>
      {arrow(-1, index === 0)}
      {arrow(1, index === count - 1)}
    </Animated.View>
  );
}

export function Sortable<T>({
  items,
  keyOf,
  labelOf,
  rowHeight,
  renderRow,
  onReorder,
  onDragging,
}: {
  items: T[];
  keyOf: (item: T, index: number) => string;
  labelOf: (item: T) => string;
  rowHeight: number;
  renderRow: (item: T, index: number) => React.ReactNode;
  /** Called with the old and new position when something's been moved. */
  onReorder: (from: number, to: number) => void;
  /** Lets the screen stop scrolling while a row is in the air. */
  onDragging?: (dragging: boolean) => void;
}) {
  const dy = useSharedValue(0);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const clamp = (n: number) => Math.max(0, Math.min(items.length - 1, n));

  // The ref is the truth for the gesture callbacks; the state is just for drawing.
  const live = useRef<{ from: number; to: number } | null>(null);

  const start = (index: number) => {
    dy.value = 0;
    live.current = { from: index, to: index };
    setDrag(live.current);
    onDragging?.(true);
  };
  const move = (index: number, by: number) => {
    if (!live.current) return;
    dy.value = by;
    const to = clamp(index + Math.round(by / rowHeight));
    if (to !== live.current.to) {
      live.current = { ...live.current, to };
      setDrag(live.current);
    }
  };
  const end = () => {
    const d = live.current;
    if (!d) return; // a touch that never became a drag
    live.current = null;
    setDrag(null);
    dy.value = 0;
    onDragging?.(false);
    if (d.from !== d.to) onReorder(d.from, d.to);
  };

  return (
    <View>
      {items.map((item, i) => {
        let shift = 0;
        if (drag && i !== drag.from) {
          if (drag.from < drag.to && i > drag.from && i <= drag.to) shift = -rowHeight;
          if (drag.from > drag.to && i < drag.from && i >= drag.to) shift = rowHeight;
        }
        return (
          <Row
            key={keyOf(item, i)}
            index={i}
            count={items.length}
            height={rowHeight}
            shift={shift}
            active={drag?.from === i}
            dragging={!!drag}
            dy={dy}
            onStart={start}
            onMove={move}
            onEnd={end}
            onStep={(index, by) => onReorder(index, clamp(index + by))}
            label={labelOf(item)}
          >
            {renderRow(item, i)}
          </Row>
        );
      })}
    </View>
  );
}

/** Move one element of a list from one position to another. */
export function moved<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
