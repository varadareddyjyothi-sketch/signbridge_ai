/**
 * SignBridge AI - Frontend Landmark Preprocessing & Normalization
 * Matches the backend Python implementation in ml/features.py identically.
 */

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export const NUM_LANDMARKS = 21;
export const COORDINATES_PER_LANDMARK = 3;
export const FEATURE_DIMENSION = 63; // 21 * 3

/**
 * Normalizes 21 3D MediaPipe hand landmarks:
 * 1. Translation: shifts wrist landmark (index 0) to origin (0, 0, 0)
 * 2. Handedness: mirrors x-axis if Left hand
 * 3. Scale: divides by the maximum Euclidean distance from wrist to any landmark
 */
export function normalizeLandmarks(
  landmarks: LandmarkPoint[],
  handedness?: 'Left' | 'Right' | string
): number[] {
  if (!landmarks || landmarks.length !== NUM_LANDMARKS) {
    throw new Error(`Expected ${NUM_LANDMARKS} landmarks, got ${landmarks ? landmarks.length : 0}`);
  }

  // 1. Translation: Wrist at index 0
  const wristX = landmarks[0].x;
  const wristY = landmarks[0].y;
  const wristZ = landmarks[0].z ?? 0.0;

  const translated: [number, number, number][] = landmarks.map((pt) => {
    let dx = pt.x - wristX;
    const dy = pt.y - wristY;
    const dz = (pt.z ?? 0.0) - wristZ;

    // 2. Handedness: Mirror x if left hand
    if (handedness && handedness.toLowerCase() === 'left') {
      dx = -dx;
    }
    return [dx, dy, dz];
  });

  // 3. Scale: Maximum Euclidean distance
  let maxDist = 0.0;
  for (const [x, y, z] of translated) {
    const dist = Math.hypot(x, y, z);
    if (dist > maxDist) {
      maxDist = dist;
    }
  }

  const scale = maxDist > 1e-6 ? maxDist : 1.0;

  // Flatten into 63-element array
  const features: number[] = [];
  for (const [x, y, z] of translated) {
    features.push(x / scale, y / scale, z / scale);
  }

  return features;
}
