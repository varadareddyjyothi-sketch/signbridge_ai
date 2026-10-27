/**
 * SignBridge AI - Two-Hand Sign & Gesture Classifier
 * 
 * Provides robust geometric and topological feature extraction for dual-hand gestures.
 * Distinguishes verified Indian Sign Language (ISL) two-hand signs from general dual gestures
 * and unclassified hand tracking.
 * 
 * Supported Verified Two-Hand ISL Signs:
 * 1. ISL_NAMASTE_2HAND - Namaste (Two-Hand Respectful Greeting)
 * 2. ISL_BOOK - Book / Study (Two open palms joined at pinky edges opening upward)
 * 3. ISL_HOUSE - House / Home (Fingertips meeting in an inverted V roof, wrists apart)
 * 4. ISL_CLAP - Clap / Applause (Palms in close clapping contact)
 * 5. ISL_HELP_2HAND - Help (Dominant fist on non-dominant open palm)
 * 
 * Supported General Dual-Hand Gestures:
 * 1. Double_Thumbs_Up - Both thumbs up, separated
 * 2. Double_Peace - Both hands victory/peace, separated
 * 3. Both_Open_Palms - Both hands open palms, separated
 */

import type { LandmarkPoint, PredictionResult } from '../types';

export interface FingerStates {
  thumbExtended: boolean;
  indexExtended: boolean;
  middleExtended: boolean;
  ringExtended: boolean;
  pinkyExtended: boolean;
  extendedCount: number;
}

export interface TwoHandMetrics {
  interWristDistance: number;
  interWristYDiff: number;
  interIndexTipDistance: number;
  interMiddleTipDistance: number;
  interThumbTipDistance: number;
  interPinkyTipDistance: number;
  interPinkyBaseDistance: number;
  leftFingers: FingerStates;
  rightFingers: FingerStates;
  leftWrist: LandmarkPoint;
  rightWrist: LandmarkPoint;
}

export interface TwoHandClassificationResult {
  isRecognized: boolean;
  label: string | null;
  english_meaning: string;
  telugu: string;
  telugu_romanized: string;
  confidence: number;
  gesture_type: 'two_hand_isl' | 'general_gesture' | 'static';
  is_verified_isl: boolean;
  metrics: TwoHandMetrics;
  category: string;
}

/**
 * Calculates Euclidean distance between two 2D/3D points.
 */
export function euclideanDist(p1: LandmarkPoint, p2: LandmarkPoint): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z ?? 0) - (p2.z ?? 0);
  return Math.hypot(dx, dy, dz);
}

/**
 * Computes individual finger extension states for a 21-landmark hand.
 * Landmark Indices:
 * 0: Wrist
 * 1-4: Thumb (4 is tip)
 * 5-8: Index (8 is tip, 6 is PIP)
 * 9-12: Middle (12 is tip, 10 is PIP)
 * 13-16: Ring (16 is tip, 14 is PIP)
 * 17-20: Pinky (20 is tip, 18 is PIP)
 */
export function getFingerStates(landmarks: LandmarkPoint[]): FingerStates {
  if (!landmarks || landmarks.length < 21) {
    return {
      thumbExtended: false,
      indexExtended: false,
      middleExtended: false,
      ringExtended: false,
      pinkyExtended: false,
      extendedCount: 0
    };
  }

  const wrist = landmarks[0];

  // For fingers (Index, Middle, Ring, Pinky), a finger is extended if tip is farther from wrist than PIP joint
  // and tip is higher (smaller y in image space) or extended outward
  const isExtended = (tipIdx: number, pipIdx: number, mcpIdx: number) => {
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    const mcp = landmarks[mcpIdx];
    const distTipWrist = euclideanDist(tip, wrist);
    const distPipWrist = euclideanDist(pip, wrist);
    const distMcpWrist = euclideanDist(mcp, wrist);
    return distTipWrist > distPipWrist && distPipWrist > distMcpWrist * 0.85;
  };

  const indexExtended = isExtended(8, 6, 5);
  const middleExtended = isExtended(12, 10, 9);
  const ringExtended = isExtended(16, 14, 13);
  const pinkyExtended = isExtended(20, 18, 17);

  // Thumb extension: distance between thumb tip (4) and pinky base (17) or index MCP (5)
  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const indexMcp = landmarks[5];
  const thumbExtended = euclideanDist(thumbTip, indexMcp) > euclideanDist(thumbIp, indexMcp) * 1.2;

  let extendedCount = 0;
  if (thumbExtended) extendedCount++;
  if (indexExtended) extendedCount++;
  if (middleExtended) extendedCount++;
  if (ringExtended) extendedCount++;
  if (pinkyExtended) extendedCount++;

  return {
    thumbExtended,
    indexExtended,
    middleExtended,
    ringExtended,
    pinkyExtended,
    extendedCount
  };
}

/**
 * Computes inter-hand relational metrics between Left and Right hands.
 */
export function computeTwoHandMetrics(
  leftLandmarks: LandmarkPoint[],
  rightLandmarks: LandmarkPoint[]
): TwoHandMetrics {
  const leftWrist = leftLandmarks[0];
  const rightWrist = rightLandmarks[0];

  return {
    interWristDistance: euclideanDist(leftWrist, rightWrist),
    interWristYDiff: Math.abs(leftWrist.y - rightWrist.y),
    interIndexTipDistance: euclideanDist(leftLandmarks[8], rightLandmarks[8]),
    interMiddleTipDistance: euclideanDist(leftLandmarks[12], rightLandmarks[12]),
    interThumbTipDistance: euclideanDist(leftLandmarks[4], rightLandmarks[4]),
    interPinkyTipDistance: euclideanDist(leftLandmarks[20], rightLandmarks[20]),
    interPinkyBaseDistance: euclideanDist(leftLandmarks[17], rightLandmarks[17]),
    leftFingers: getFingerStates(leftLandmarks),
    rightFingers: getFingerStates(rightLandmarks),
    leftWrist,
    rightWrist
  };
}

/**
 * Classifies two hands into either a Verified ISL Sign, a General Dual Gesture,
 * or an unclassified / transitioning hand state.
 */
export function classifyTwoHands(
  leftLandmarks: LandmarkPoint[],
  rightLandmarks: LandmarkPoint[],
  threshold: number = 0.65
): TwoHandClassificationResult {
  const metrics = computeTwoHandMetrics(leftLandmarks, rightLandmarks);
  const {
    interWristDistance,
    interWristYDiff,
    interIndexTipDistance,
    interMiddleTipDistance,
    interThumbTipDistance,
    interPinkyBaseDistance,
    leftFingers,
    rightFingers,
    leftWrist,
    rightWrist
  } = metrics;

  const leftAllOpen = leftFingers.extendedCount >= 4;
  const rightAllOpen = rightFingers.extendedCount >= 4;
  const leftFist = leftFingers.extendedCount <= 1;
  const rightFist = rightFingers.extendedCount <= 1;

  // 1. ISL_NAMASTE_2HAND: Both palms joined vertically facing each other at chest level
  // Wrists close together, fingertips meeting, hands aligned vertically
  if (
    leftAllOpen &&
    rightAllOpen &&
    interWristDistance < 0.22 &&
    interWristYDiff < 0.12 &&
    (interIndexTipDistance < 0.14 || interMiddleTipDistance < 0.14)
  ) {
    const confidence = Math.min(
      0.96,
      0.80 + (0.22 - interWristDistance) * 0.5 + (0.14 - interMiddleTipDistance) * 0.5
    );

    return {
      isRecognized: confidence >= threshold,
      label: 'ISL_NAMASTE_2HAND',
      english_meaning: 'Namaste (Two-Hand Greeting)',
      telugu: 'నమస్కారం (రెండు చేతులు)',
      telugu_romanized: 'Namaskaram (Rendu Chethulu)',
      confidence: Math.round(confidence * 1000) / 1000,
      gesture_type: 'two_hand_isl',
      is_verified_isl: true,
      metrics,
      category: 'isl_greeting'
    };
  }

  // 2. ISL_BOOK: Both hands open, pinky bases/edges adjacent, index tips spread open
  // Like opening the pages of a book
  if (
    leftAllOpen &&
    rightAllOpen &&
    interPinkyBaseDistance < 0.19 &&
    interIndexTipDistance > 0.16 &&
    interWristYDiff < 0.14 &&
    interWristDistance < 0.26
  ) {
    const confidence = Math.min(
      0.94,
      0.78 + (0.19 - interPinkyBaseDistance) * 0.5 + (interIndexTipDistance - 0.16) * 0.4
    );

    return {
      isRecognized: confidence >= threshold,
      label: 'ISL_BOOK',
      english_meaning: 'Book / Study (Two-Hand)',
      telugu: 'పుస్తకం / చదువు (రెండు చేతులు)',
      telugu_romanized: 'Pusthakam / Chaduvu (Rendu Chethulu)',
      confidence: Math.round(confidence * 1000) / 1000,
      gesture_type: 'two_hand_isl',
      is_verified_isl: true,
      metrics,
      category: 'isl_education'
    };
  }

  // 3. ISL_HOUSE: Fingertips meeting at the apex in an inverted V roof shape, wrists spread apart
  if (
    leftAllOpen &&
    rightAllOpen &&
    (interMiddleTipDistance < 0.12 || interIndexTipDistance < 0.12) &&
    interWristDistance > 0.24 &&
    interWristYDiff < 0.15
  ) {
    const confidence = Math.min(
      0.93,
      0.76 + (interWristDistance - 0.24) * 0.4 + (0.12 - interMiddleTipDistance) * 0.6
    );

    return {
      isRecognized: confidence >= threshold,
      label: 'ISL_HOUSE',
      english_meaning: 'House / Home (Roof Pose)',
      telugu: 'ఇల్లు / నివాసం (పైకప్పు భంగిమ)',
      telugu_romanized: 'Illu / Nivaasam (Paikappu Bhangima)',
      confidence: Math.round(confidence * 1000) / 1000,
      gesture_type: 'two_hand_isl',
      is_verified_isl: true,
      metrics,
      category: 'isl_common'
    };
  }

  // 4. ISL_CLAP: Both open palms in very close contact/clapping
  if (
    leftAllOpen &&
    rightAllOpen &&
    interWristDistance < 0.18 &&
    interIndexTipDistance < 0.12 &&
    interMiddleTipDistance < 0.12 &&
    interThumbTipDistance < 0.14
  ) {
    return {
      isRecognized: true,
      label: 'ISL_CLAP',
      english_meaning: 'Clap / Applause',
      telugu: 'చప్పట్లు / ప్రశంస',
      telugu_romanized: 'Chappatlu / Prashamsa',
      confidence: 0.92,
      gesture_type: 'two_hand_isl',
      is_verified_isl: true,
      metrics,
      category: 'isl_action'
    };
  }

  // 5. ISL_HELP_2HAND: One hand is a fist/thumbs-up resting on top of the other open flat palm
  const rightOnLeft =
    rightFist &&
    leftAllOpen &&
    Math.abs(rightWrist.x - leftWrist.x) < 0.18 &&
    rightWrist.y <= leftWrist.y + 0.08;

  const leftOnRight =
    leftFist &&
    rightAllOpen &&
    Math.abs(leftWrist.x - rightWrist.x) < 0.18 &&
    leftWrist.y <= rightWrist.y + 0.08;

  if (rightOnLeft || leftOnRight) {
    return {
      isRecognized: true,
      label: 'ISL_HELP_2HAND',
      english_meaning: 'Help (Two-Hand Support)',
      telugu: 'సహాయం (రెండు చేతులు)',
      telugu_romanized: 'Sahaayam (Rendu Chethulu)',
      confidence: 0.90,
      gesture_type: 'two_hand_isl',
      is_verified_isl: true,
      metrics,
      category: 'isl_communication'
    };
  }

  // 6. Dual General Gestures (Non-ISL specific)
  // Double Thumbs Up: Both thumbs extended, all other fingers curled, wrists separated
  const leftThumbUp = leftFingers.thumbExtended && !leftFingers.indexExtended && !leftFingers.pinkyExtended;
  const rightThumbUp = rightFingers.thumbExtended && !rightFingers.indexExtended && !rightFingers.pinkyExtended;

  if (leftThumbUp && rightThumbUp && interWristDistance > 0.18) {
    return {
      isRecognized: true,
      label: 'Double_Thumbs_Up',
      english_meaning: 'Double Thumbs Up / Great',
      telugu: 'రెండు బొటనవేళ్ళు పైకి / అద్భుతం',
      telugu_romanized: 'Rendu Botana Vellu Paiki / Adbhutham',
      confidence: 0.88,
      gesture_type: 'general_gesture',
      is_verified_isl: false,
      metrics,
      category: 'general_dual_gesture'
    };
  }

  // Double Peace / Victory: Both index and middle fingers extended, wrists separated
  const leftVictory = leftFingers.indexExtended && leftFingers.middleExtended && !leftFingers.ringExtended && !leftFingers.pinkyExtended;
  const rightVictory = rightFingers.indexExtended && rightFingers.middleExtended && !rightFingers.ringExtended && !rightFingers.pinkyExtended;

  if (leftVictory && rightVictory && interWristDistance > 0.18) {
    return {
      isRecognized: true,
      label: 'Double_Peace',
      english_meaning: 'Double Peace / Victory',
      telugu: 'రెండు చేతులతో శాంతి / విజయం',
      telugu_romanized: 'Rendu Chethulatho Shanthi / Vijayam',
      confidence: 0.88,
      gesture_type: 'general_gesture',
      is_verified_isl: false,
      metrics,
      category: 'general_dual_gesture'
    };
  }

  // Both Open Palms separated: Both open palms facing camera
  if (leftAllOpen && rightAllOpen && interWristDistance > 0.28) {
    return {
      isRecognized: true,
      label: 'Both_Open_Palms',
      english_meaning: 'Both Hands Open / Welcome',
      telugu: 'రెండు చేతులూ తెరచి ఉన్నాయి (స్వాగతం)',
      telugu_romanized: 'Rendu Chethuloo Therachi Unnaayi (Swagatham)',
      confidence: 0.85,
      gesture_type: 'general_gesture',
      is_verified_isl: false,
      metrics,
      category: 'general_dual_gesture'
    };
  }

  // 7. No known sign matched - Hand Detected, but Unrecognized / Transitioning
  return {
    isRecognized: false,
    label: null,
    english_meaning: 'Two hands detected — Moving or unclassified pose',
    telugu: 'రెండు చేతులు గుర్తించబడ్డాయి (సంజ్ఞ ఏర్పడలేదు)',
    telugu_romanized: 'Rendu chethulu gurthinchabaddaayi (samjna erpadaledu)',
    confidence: 0.40,
    gesture_type: 'static',
    is_verified_isl: false,
    metrics,
    category: 'unclassified'
  };
}

/**
 * Converts a TwoHandClassificationResult into a standard PredictionResult
 */
export function formatTwoHandPrediction(
  result: TwoHandClassificationResult,
  threshold: number = 0.65
): PredictionResult {
  const nowIso = new Date().toISOString();

  if (!result.isRecognized || !result.label || result.confidence < threshold) {
    return {
      detected: true,
      label: null,
      english_meaning: result.english_meaning || 'Two hands detected — No recognized sign formed',
      telugu: result.telugu || 'రెండు చేతులు ఉన్నాయి (అనిశ్చిత సంజ్ఞ)',
      telugu_romanized: result.telugu_romanized || 'Rendu chethulu unnaayi (anischitha samjna)',
      confidence: result.confidence ? Math.round(result.confidence * 1000) / 1000 : null,
      status: 'uncertain_rejected',
      is_verified_isl: false,
      gesture_type: result.gesture_type || 'static',
      model_version: 'v1.0.0 (Two-Hand Dual Geometric)',
      all_probabilities: result.label ? { [result.label]: result.confidence } : null,
      rejection_threshold_used: threshold,
      timestamp: nowIso
    };
  }

  return {
    detected: true,
    label: result.label,
    english_meaning: result.english_meaning,
    telugu: result.telugu,
    telugu_romanized: result.telugu_romanized,
    confidence: result.confidence,
    status: 'accepted',
    is_verified_isl: result.is_verified_isl,
    gesture_type: result.gesture_type,
    model_version: 'v1.0.0 (Two-Hand Dual Geometric)',
    all_probabilities: { [result.label]: result.confidence },
    rejection_threshold_used: threshold,
    timestamp: nowIso
  };
}
