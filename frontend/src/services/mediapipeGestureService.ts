/**
 * SignBridge AI - MediaPipe Pretrained Gesture Recognizer Service
 * 
 * Provides browser-native, client-side, zero-latency inference for general hand gestures
 * using the official MediaPipe Gesture Recognizer model (`gesture_recognizer.task`).
 * 
 * Official Model Classes Supported:
 * - Open_Palm
 * - Closed_Fist
 * - Pointing_Up
 * - Thumb_Up
 * - Thumb_Down
 * - Victory
 * - ILoveYou
 * 
 * Note: These are classified as General Hand Gestures (Experimental), NOT verified ISL translations.
 */

import { FilesetResolver, GestureRecognizer, DrawingUtils } from '@mediapipe/tasks-vision';
import type { PredictionResult } from '../types';
import { classifyTwoHands, formatTwoHandPrediction } from '../lib/twoHandClassifier';

export const PRETRAINED_GESTURE_METADATA: Record<string, { meaning: string; telugu: string; telugu_romanized: string; description: string }> = {
  Open_Palm: {
    meaning: 'Open Palm / Hello',
    telugu: 'తెరచిన అరచేయి / నమస్కారం',
    telugu_romanized: 'Therachina Arachayi / Namaskaram',
    description: 'All five fingers spread open facing forward.'
  },
  Closed_Fist: {
    meaning: 'Closed Fist / Solid',
    telugu: 'మూసిన పిడికిలి / శక్తి',
    telugu_romanized: 'Moosina Pidikili / Shakthi',
    description: 'All fingers curled tightly into a fist.'
  },
  Pointing_Up: {
    meaning: 'Pointing Up / Direction',
    telugu: 'పైకి చూపుట / చూడండి',
    telugu_romanized: 'Paiki Chooputa / Choodandi',
    description: 'Index finger extended upward, other fingers curled.'
  },
  Thumb_Up: {
    meaning: 'Thumbs Up / Yes',
    telugu: 'బొటనవేలు పైకి / అవును',
    telugu_romanized: 'Botana Velu Paiki / Avunu',
    description: 'Fist with thumb pointing upward.'
  },
  Thumb_Down: {
    meaning: 'Thumbs Down / No',
    telugu: 'బొటనవేలు కిందకి / కాదు',
    telugu_romanized: 'Botana Velu Kindaki / Kaadu',
    description: 'Fist with thumb pointing downward.'
  },
  Victory: {
    meaning: 'Victory / Peace Sign',
    telugu: 'విజయం / శాంతి చిహ్నం',
    telugu_romanized: 'Vijayam / Shanthi Chihnam',
    description: 'Index and middle fingers extended in a V-shape.'
  },
  ILoveYou: {
    meaning: 'I Love You (ILY)',
    telugu: 'నేను నిన్ను ప్రేమిస్తున్నాను (ILY)',
    telugu_romanized: 'Nenu Ninnu Premisthunnanu (ILY)',
    description: 'Thumb, index, and pinky extended; middle and ring curled.'
  }
};

export const SUPPORTED_PRETRAINED_CLASSES = Object.keys(PRETRAINED_GESTURE_METADATA);

class MediapipeGestureService {
  private recognizer: GestureRecognizer | null = null;
  private isInitializing = false;
  private loadError: string | null = null;
  private lastTimestamp = -1;

  public async initialize(): Promise<boolean> {
    if (this.recognizer) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    this.loadError = null;

    try {
      // 1. Resolve WASM fileset (prefer local assets in /wasm, fallback to CDN)
      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks('/wasm');
      } catch (localErr) {
        console.warn('[MediapipeGesture] Local WASM load failed, falling back to CDN:', localErr);
        vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
      }

      // 2. Load Gesture Recognizer Task model (prefer local, fallback to official storage.googleapis.com)
      const modelPath = '/models/gesture_recognizer.task';
      const cdnModelPath = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

      try {
        this.recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numHands: 2
        });
      } catch (localModelErr) {
        console.warn('[MediapipeGesture] Local task model failed, trying CDN model:', localModelErr);
        this.recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: cdnModelPath,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numHands: 2
        });
      }

      console.log('[MediapipeGesture] Pretrained MediaPipe Gesture Recognizer initialized successfully.');
      this.isInitializing = false;
      return true;
    } catch (err: any) {
      console.error('[MediapipeGesture] Initialization failed:', err);
      this.loadError = err?.message || 'Failed to initialize MediaPipe Gesture Recognizer';
      this.isInitializing = false;
      return false;
    }
  }

  public isReady(): boolean {
    return this.recognizer !== null;
  }

  public getLoadError(): string | null {
    return this.loadError;
  }

  public recognizeFrame(
    video: HTMLVideoElement,
    timestampMs: number,
    threshold: number = 0.65
  ): {
    prediction: PredictionResult;
    landmarks: any[] | null;
    handedness: string;
  } {
    const defaultPrediction: PredictionResult = {
      detected: false,
      label: null,
      english_meaning: 'Waiting for hand in frame...',
      confidence: null,
      status: 'no_hand',
      is_verified_isl: false,
      all_probabilities: null,
      rejection_threshold_used: threshold,
      timestamp: new Date().toISOString()
    };

    if (!this.recognizer || video.readyState < 2) {
      return {
        prediction: {
          ...defaultPrediction,
          status: this.loadError ? 'model_unavailable' : 'no_hand',
          english_meaning: this.loadError ? 'Pretrained gesture model failed to load' : 'Video feed not ready'
        },
        landmarks: null,
        handedness: 'Right'
      };
    }

    // Guard monotonic timestamps required by MediaPipe VIDEO mode
    const nowMs = timestampMs > this.lastTimestamp ? timestampMs : this.lastTimestamp + 1;
    this.lastTimestamp = nowMs;

    try {
      const results = this.recognizer.recognizeForVideo(video, nowMs);

      // Check if hand landmarks were detected
      if (!results.landmarks || results.landmarks.length === 0) {
        return {
          prediction: defaultPrediction,
          landmarks: null,
          handedness: 'Right'
        };
      }

      // --- DUAL HAND RECOGNITION BRANCH ---
      if (results.landmarks.length >= 2) {
        const hand0 = results.landmarks[0];
        const hand1 = results.landmarks[1];
        const label0 = results.handedness?.[0]?.[0]?.categoryName || 'Left';

        const leftLandmarks = label0 === 'Left' ? hand0 : hand1;
        const rightLandmarks = label0 === 'Left' ? hand1 : hand0;

        // Run dedicated two-hand geometric classifier
        const twoHandResult = classifyTwoHands(leftLandmarks, rightLandmarks, threshold);
        if (twoHandResult.isRecognized) {
          const formatted = formatTwoHandPrediction(twoHandResult, threshold);
          return {
            prediction: {
              ...formatted,
              hands_detected: 2
            },
            landmarks: results.landmarks,
            handedness: 'Both'
          };
        }

        // Two hands present in frame, but not forming any verified ISL sign or dual gesture
        return {
          prediction: {
            detected: true,
            label: null,
            english_meaning: 'Two hands detected — Moving or unclassified sign',
            telugu: 'రెండు చేతులు గుర్తించబడ్డాయి (సంజ్ఞ ఏర్పడలేదు)',
            telugu_romanized: 'Rendu chethulu gurthinchabaddaayi (samjna erpadaledu)',
            confidence: null,
            status: 'uncertain_rejected',
            is_verified_isl: false,
            gesture_type: 'static',
            hands_detected: 2,
            all_probabilities: null,
            rejection_threshold_used: threshold,
            timestamp: new Date().toISOString()
          },
          landmarks: results.landmarks,
          handedness: 'Both'
        };
      }

      // --- SINGLE HAND RECOGNITION BRANCH ---
      const handLandmarks = results.landmarks[0];
      const handednessStr = results.handedness?.[0]?.[0]?.categoryName || 'Right';

      // Check gestures predicted by the model
      const gestureCategories = results.gestures?.[0];
      if (!gestureCategories || gestureCategories.length === 0) {
        return {
          prediction: {
            detected: true,
            label: null,
            english_meaning: 'Unknown gesture / transitioning...',
            confidence: null,
            status: 'uncertain_rejected',
            is_verified_isl: false,
            gesture_type: 'static',
            hands_detected: 1,
            all_probabilities: null,
            rejection_threshold_used: threshold,
            timestamp: new Date().toISOString()
          },
          landmarks: handLandmarks,
          handedness: handednessStr
        };
      }

      const topGesture = gestureCategories[0];
      const categoryName = topGesture.categoryName;
      const confidence = topGesture.score;

      // Build probability dictionary
      const probMap: Record<string, number> = {};
      for (const g of gestureCategories) {
        probMap[g.categoryName] = Math.round(g.score * 1000) / 1000;
      }

      // Handle unrecognized or unknown gesture
      if (categoryName === 'None' || categoryName === 'Unrecognized' || !categoryName) {
        return {
          prediction: {
            detected: true,
            label: 'Unknown',
            english_meaning: 'Unknown gesture',
            confidence: confidence ? Math.round(confidence * 1000) / 1000 : null,
            status: 'uncertain_rejected',
            is_verified_isl: false,
            gesture_type: 'static',
            hands_detected: 1,
            all_probabilities: probMap,
            rejection_threshold_used: threshold,
            timestamp: new Date().toISOString()
          },
          landmarks: handLandmarks,
          handedness: handednessStr
        };
      }

      // Apply confidence threshold gate
      const meta = PRETRAINED_GESTURE_METADATA[categoryName];
      const meaning = meta?.meaning || categoryName;

      if (confidence < threshold) {
        return {
          prediction: {
            detected: true,
            label: categoryName,
            english_meaning: `Uncertain gesture (${meaning})`,
            telugu: meta?.telugu ? `అనిశ్చిత సంజ్ఞ (${meta.telugu})` : 'అనిశ్చిత సంజ్ఞ',
            telugu_romanized: meta?.telugu_romanized ? `Anischitha samjna (${meta.telugu_romanized})` : 'Anischitha samjna',
            confidence: Math.round(confidence * 1000) / 1000,
            status: 'uncertain_rejected',
            is_verified_isl: false,
            gesture_type: 'static',
            hands_detected: 1,
            all_probabilities: probMap,
            rejection_threshold_used: threshold,
            timestamp: new Date().toISOString()
          },
          landmarks: handLandmarks,
          handedness: handednessStr
        };
      }

      // Accepted prediction
      return {
        prediction: {
          detected: true,
          label: categoryName,
          english_meaning: meaning,
          telugu: meta?.telugu || meaning,
          telugu_romanized: meta?.telugu_romanized || meaning,
          confidence: Math.round(confidence * 1000) / 1000,
          status: 'accepted',
          is_verified_isl: false, // General hand gesture, not verified ISL translation
          gesture_type: 'static',
          hands_detected: 1,
          all_probabilities: probMap,
          rejection_threshold_used: threshold,
          timestamp: new Date().toISOString()
        },
        landmarks: handLandmarks,
        handedness: handednessStr
      };
    } catch (inferErr: any) {
      console.warn('[MediapipeGesture] Inference error on frame:', inferErr);
      return {
        prediction: {
          ...defaultPrediction,
          status: 'error',
          english_meaning: `Recognition error: ${inferErr?.message || inferErr}`
        },
        landmarks: null,
        handedness: 'Right'
      };
    }
  }

  public drawLandmarks(
    canvas: HTMLCanvasElement,
    landmarksData: any,
    status: 'accepted' | 'uncertain_rejected' | 'no_hand' | 'waiting'
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarksData || landmarksData.length === 0) return;

    ctx.save();
    // Mirror drawing to match mirrored video preview
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    const drawingUtils = new DrawingUtils(ctx);

    // Support both single hand array (21 points) and array of hands ([hand0, hand1])
    const handsList: any[][] = Array.isArray(landmarksData[0])
      ? landmarksData
      : [landmarksData];

    for (let hIdx = 0; hIdx < handsList.length; hIdx++) {
      const handLandmarks = handsList[hIdx];
      if (!handLandmarks || handLandmarks.length === 0) continue;

      const isLeft = hIdx === 0 && handsList.length > 1;

      const pointColor =
        status === 'accepted'
          ? '#10b981' // Emerald
          : status === 'uncertain_rejected'
          ? '#f59e0b' // Amber
          : isLeft
          ? '#06b6d4' // Cyan
          : '#8b5cf6'; // Purple

      const connectorColor =
        status === 'accepted'
          ? 'rgba(16, 185, 129, 0.75)'
          : status === 'uncertain_rejected'
          ? 'rgba(245, 158, 11, 0.75)'
          : isLeft
          ? 'rgba(6, 182, 212, 0.75)'
          : 'rgba(139, 92, 246, 0.75)';

      // Draw skeletal connections
      drawingUtils.drawConnectors(handLandmarks, GestureRecognizer.HAND_CONNECTIONS, {
        color: connectorColor,
        lineWidth: 3
      });

      // Draw landmark joints
      drawingUtils.drawLandmarks(handLandmarks, {
        color: pointColor,
        lineWidth: 1,
        radius: 4
      });
    }

    ctx.restore();
  }

  public close() {
    if (this.recognizer) {
      try {
        this.recognizer.close();
      } catch (e) {
        console.warn('Error closing recognizer:', e);
      }
      this.recognizer = null;
    }
    this.isInitializing = false;
  }
}

export const mediapipeGestureService = new MediapipeGestureService();
