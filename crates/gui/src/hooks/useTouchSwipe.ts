import { useRef, TouchEvent } from "react";

export const useTouchSwipe = (
  onSwipe: (direction: "left" | "right") => void,
  threshold = 50
) => {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (!touchStart.current) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;

    // Check if horizontal movement exceeds threshold and vertical movement is limited
    if (Math.abs(dx) > threshold && Math.abs(dy) < threshold * 1.5) {
      if (dx > 0) {
        onSwipe("right");
      } else {
        onSwipe("left");
      }
    }

    touchStart.current = null;
  };

  return { onTouchStart, onTouchEnd };
};
