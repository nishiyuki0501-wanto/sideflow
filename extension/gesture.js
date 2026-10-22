// Shared by reveal/close and profile navigation. No timed lockout after firing:
// a deliberate reversal or renewed acceleration starts the next stroke immediately.
export function createGestureGate({ threshold = 45, quietMs = 100 } = {}) {
  let last = -Infinity, distance = 0, firedDirection = 0;
  let reverseDistance = 0, peak = 0, previousMagnitude = 0;
  return (delta, now = performance.now()) => {
    if (!Number.isFinite(delta) || !delta) return 0;
    const magnitude = Math.abs(delta), direction = Math.sign(delta);
    const idle = now - last >= quietMs;
    last = now;
    if (idle) {
      distance = 0;
      firedDirection = 0;
      reverseDistance = 0;
      peak = 0;
    }
    if (firedDirection) {
      if (direction !== firedDirection) {
        // Tiny alternating deltas at the end of inertia must not toggle the UI.
        reverseDistance += delta;
        previousMagnitude = magnitude;
        if (Math.abs(reverseDistance) < threshold) return 0;
        firedDirection = direction;
        reverseDistance = 0;
        peak = magnitude;
        return direction;
      }
      reverseDistance = 0;
      const renewedStroke = previousMagnitude <= peak * 0.4 &&
        magnitude >= Math.max(12, previousMagnitude * 2.5);
      previousMagnitude = magnitude;
      peak = Math.max(peak, magnitude);
      if (!renewedStroke) return 0;
      firedDirection = 0;
      distance = 0;
      peak = magnitude;
    }
    previousMagnitude = magnitude;
    peak = Math.max(peak, magnitude);
    if (Math.sign(distance) !== direction) distance = 0;
    distance += delta;
    if (Math.abs(distance) < threshold) return 0;
    firedDirection = direction;
    distance = 0;
    return direction;
  };
}
