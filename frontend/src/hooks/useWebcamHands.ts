/**
 * SignBridge AI - useWebcamHands Hook
 * 
 * Manages webcam lifecycle, MediaPipe dual-hand tracking (0, 1, or 2 hands simultaneously),
 * distinct Left/Right skeletal rendering, feature extraction, and camera status management.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { LandmarkPoint } from '../types';
import { normalizeLandmarks } from '../lib/landmarks';

// Landmark connectivity edges for drawing the hand skeleton
const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm Base
  [5, 9], [9, 13], [13, 17]
];

export interface DetectedHand {
  handedness: 'Left' | 'Right';
  landmarks: LandmarkPoint[];
  rawLandmarks: any[];
  normalizedFeatures: number[];
  wrist: LandmarkPoint;
}

export type CameraStatus =
  | 'stopped'
  | 'starting'
  | 'no_hand'
  | 'one_hand'
  | 'two_hands'
  | 'error';

export interface UseWebcamHandsReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isCameraActive: boolean;
  isHandDetected: boolean;
  handsCount: number; // 0, 1, or 2
  detectedHands: DetectedHand[];
  handedness: 'Left' | 'Right' | 'Both' | 'None';
  landmarks: LandmarkPoint[] | null; // Primary hand for backward compatibility
  normalizedFeatures: number[] | null; // Primary hand for backward compatibility
  twoHandLandmarks: {
    left: LandmarkPoint[] | null;
    right: LandmarkPoint[] | null;
  };
  cameraStatus: CameraStatus;
  cameraStatusMessage: string;
  cameraError: string | null;
  startCamera: (mode?: 'user' | 'environment') => Promise<void>;
  stopCamera: () => void;
  retryCamera: () => Promise<void>;
  toggleCameraFacing: () => Promise<void>;
  facingMode: 'user' | 'environment';
  hasMultipleCameras: boolean;
  fps: number;
}

export function useWebcamHands(): UseWebcamHandsReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isHandDetected, setIsHandDetected] = useState(false);
  const [handsCount, setHandsCount] = useState<number>(0);
  const [detectedHands, setDetectedHands] = useState<DetectedHand[]>([]);
  const [handedness, setHandedness] = useState<'Left' | 'Right' | 'Both' | 'None'>('None');
  const [landmarks, setLandmarks] = useState<LandmarkPoint[] | null>(null);
  const [normalizedFeatures, setNormalizedFeatures] = useState<number[] | null>(null);
  const [twoHandLandmarks, setTwoHandLandmarks] = useState<{
    left: LandmarkPoint[] | null;
    right: LandmarkPoint[] | null;
  }>({ left: null, right: null });

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('stopped');
  const [cameraStatusMessage, setCameraStatusMessage] = useState<string>('Camera is turned off');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);

  // Mobile / Camera facing support
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);
  const facingModeRef = useRef<'user' | 'environment'>('user');
  const isCameraActiveRef = useRef<boolean>(false);

  const streamRef = useRef<MediaStream | null>(null);
  const handsModelRef = useRef<any>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(performance.now());
  const lastFrameProcessTimeRef = useRef(performance.now());
  const isProcessingRef = useRef(false);

  // Detect multiple cameras (e.g. mobile front & back)
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          setHasMultipleCameras(videoInputs.length > 1);
        })
        .catch(() => {});
    }
  }, []);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    isProcessingRef.current = false;
    isCameraActiveRef.current = false;
    setIsCameraActive(false);
    setIsHandDetected(false);
    setHandsCount(0);
    setDetectedHands([]);
    setHandedness('None');
    setLandmarks(null);
    setNormalizedFeatures(null);
    setTwoHandLandmarks({ left: null, right: null });
    setCameraStatus('stopped');
    setCameraStatusMessage('Camera stopped. Click Start Camera to begin.');
  }, []);

  // Draw dual-hand skeletons and spatial relationships on canvas overlay
  const drawHandsSkeleton = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      hands: DetectedHand[],
      width: number,
      height: number
    ) => {
      ctx.clearRect(0, 0, width, height);

      const mapX = (xNorm: number) =>
        facingModeRef.current === 'user' ? (1 - xNorm) * width : xNorm * width;

      // 1. If 2 hands are present, draw an interactive inter-hand relation bridge
      if (hands.length >= 2) {
        const leftHand = hands.find((h) => h.handedness === 'Left') || hands[0];
        const rightHand = hands.find((h) => h.handedness === 'Right') || hands[1];

        const lx = mapX(leftHand.wrist.x);
        const ly = leftHand.wrist.y * height;
        const rx = mapX(rightHand.wrist.x);
        const ry = rightHand.wrist.y * height;

        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)'; // Amber/Gold bridge
        ctx.moveTo(lx, ly);
        ctx.lineTo(rx, ry);
        ctx.stroke();

        // Dual-hand badge on top-left of canvas
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.beginPath();
        ctx.roundRect(12, 12, 170, 26, 6);
        ctx.fill();

        ctx.font = '600 11px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#10b981';
        ctx.fillText('● 2 HANDS TRACKED', 22, 29);
        ctx.restore();
      }

      // 2. Draw each hand with distinct styling
      for (const hand of hands) {
        const isLeft = hand.handedness === 'Left';
        const rawLandmarks = hand.rawLandmarks;

        // Visual Palette: Left Hand = Cyan (#06b6d4), Right Hand = Violet/Indigo (#8b5cf6)
        const boneColor = isLeft ? '#06b6d4' : '#8b5cf6';
        const jointGlowColor = isLeft ? '#22d3ee' : '#c084fc';
        const badgeBg = isLeft ? '#0891b2' : '#7c3aed';

        // Draw Bones (Connections)
        ctx.lineWidth = 3;
        ctx.strokeStyle = boneColor;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
          const start = rawLandmarks[startIdx];
          const end = rawLandmarks[endIdx];
          if (!start || !end) continue;

          ctx.beginPath();
          ctx.moveTo(mapX(start.x), start.y * height);
          ctx.lineTo(mapX(end.x), end.y * height);
          ctx.stroke();
        }

        // Draw Joints
        for (let i = 0; i < rawLandmarks.length; i++) {
          const pt = rawLandmarks[i];
          const cx = mapX(pt.x);
          const cy = pt.y * height;

          ctx.beginPath();
          ctx.arc(cx, cy, i === 0 ? 6 : 4, 0, 2 * Math.PI);

          if (i === 4 || i === 8 || i === 12 || i === 16 || i === 20) {
            // Fingertips: Vibrant Emerald Glow
            ctx.fillStyle = '#10b981';
            ctx.shadowColor = '#10b981';
            ctx.shadowBlur = 8;
          } else if (i === 0) {
            // Wrist
            ctx.fillStyle = isLeft ? '#06b6d4' : '#8b5cf6';
            ctx.shadowColor = jointGlowColor;
            ctx.shadowBlur = 6;
          } else {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = jointGlowColor;
            ctx.shadowBlur = 4;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Draw Hand Identifier Badge near wrist
        const wristPt = rawLandmarks[0];
        if (wristPt) {
          const wx = mapX(wristPt.x);
          const wy = wristPt.y * height - 14;

          ctx.save();
          ctx.fillStyle = badgeBg;
          ctx.beginPath();
          ctx.arc(wx, wy, 10, 0, 2 * Math.PI);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(isLeft ? 'L' : 'R', wx, wy);
          ctx.restore();
        }
      }
    },
    []
  );

  // Initialize MediaPipe Hands instance configured for up to 2 hands
  const initMediaPipeHands = useCallback(async () => {
    if (handsModelRef.current) return handsModelRef.current;

    let HandsConstructor = (window as any).Hands;
    if (!HandsConstructor) {
      try {
        const mpHands = await import('@mediapipe/hands');
        HandsConstructor = mpHands.Hands || (mpHands as any).default?.Hands;
      } catch (e) {
        console.warn('Could not import @mediapipe/hands via npm, waiting for CDN script...', e);
      }
    }

    if (!HandsConstructor) {
      throw new Error('MediaPipe Hands library is not loaded. Check network connection.');
    }

    const hands = new HandsConstructor({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    // Configure for TWO HANDS detection with robust tracking
    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.45
    });

    hands.onResults((results: any) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');

      // Calculate FPS
      frameCountRef.current++;
      const now = performance.now();
      if (now - lastFpsUpdateRef.current >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / (now - lastFpsUpdateRef.current)));
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;
      }

      const multiLandmarks = results.multiHandLandmarks || [];
      const multiHandedness = results.multiHandedness || [];

      if (multiLandmarks.length > 0) {
        const parsedHands: DetectedHand[] = [];

        for (let i = 0; i < multiLandmarks.length; i++) {
          const rawLms = multiLandmarks[i];
          const handednessLabel = multiHandedness[i]?.label === 'Left' ? 'Left' : 'Right';

          const points: LandmarkPoint[] = rawLms.map((lm: any) => ({
            x: lm.x,
            y: lm.y,
            z: lm.z ?? 0.0
          }));

          // Avoid duplicate phantom detections of the exact same hand (check distance between wrists)
          const wrist = points[0];
          const isDuplicate = parsedHands.some((existing) => {
            const dx = existing.wrist.x - wrist.x;
            const dy = existing.wrist.y - wrist.y;
            return Math.hypot(dx, dy) < 0.04;
          });

          if (isDuplicate) continue;

          let normalized: number[] = [];
          try {
            normalized = normalizeLandmarks(points, handednessLabel);
          } catch {
            normalized = [];
          }

          parsedHands.push({
            handedness: handednessLabel,
            landmarks: points,
            rawLandmarks: rawLms,
            normalizedFeatures: normalized,
            wrist
          });
        }

        // If 2 hands detected but both have the same handedness label (tracking artifact),
        // disambiguate by mirrored x position (the one with smaller (1-x) is on left of screen)
        if (parsedHands.length === 2 && parsedHands[0].handedness === parsedHands[1].handedness) {
          const screenX0 = 1 - parsedHands[0].wrist.x;
          const screenX1 = 1 - parsedHands[1].wrist.x;
          if (screenX0 < screenX1) {
            parsedHands[0].handedness = 'Left';
            parsedHands[1].handedness = 'Right';
          } else {
            parsedHands[0].handedness = 'Right';
            parsedHands[1].handedness = 'Left';
          }
        }

        const count = parsedHands.length;
        setHandsCount(count);
        setIsHandDetected(count > 0);
        setDetectedHands(parsedHands);

        // Populate twoHandLandmarks
        const leftHand = parsedHands.find((h) => h.handedness === 'Left');
        const rightHand = parsedHands.find((h) => h.handedness === 'Right');
        setTwoHandLandmarks({
          left: leftHand?.landmarks || null,
          right: rightHand?.landmarks || null
        });

        // Set primary hand data for backward compatibility
        const primary = parsedHands[0];
        setLandmarks(primary.landmarks);
        setNormalizedFeatures(primary.normalizedFeatures.length > 0 ? primary.normalizedFeatures : null);

        if (count === 2) {
          setHandedness('Both');
          setCameraStatus('two_hands');
          setCameraStatusMessage('Two Hands Detected (Left & Right)');
        } else if (count === 1) {
          setHandedness(primary.handedness);
          setCameraStatus('one_hand');
          setCameraStatusMessage(`One Hand Detected (${primary.handedness} Hand)`);
        } else {
          setHandedness('None');
          setCameraStatus('no_hand');
          setCameraStatusMessage('No Hands Detected');
        }

        // Render skeletons on canvas
        if (canvas && ctx) {
          drawHandsSkeleton(ctx, parsedHands, canvas.width, canvas.height);
        }
      } else {
        // No hands detected in frame
        setHandsCount(0);
        setIsHandDetected(false);
        setDetectedHands([]);
        setHandedness('None');
        setLandmarks(null);
        setNormalizedFeatures(null);
        setTwoHandLandmarks({ left: null, right: null });
        setCameraStatus('no_hand');
        setCameraStatusMessage('No Hands Detected — Bring hand(s) into frame');

        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      isProcessingRef.current = false;
    });

    handsModelRef.current = hands;
    return hands;
  }, [drawHandsSkeleton]);

  // Throttled frame processing loop with watchdog to prevent UI freezes
  const processFrame = useCallback(async () => {
    if (!videoRef.current || videoRef.current.readyState < 2 || !handsModelRef.current) {
      animFrameIdRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const now = performance.now();
    const isMobileDevice =
      typeof window !== 'undefined' &&
      (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth <= 768);
    const minInterval = isMobileDevice ? 48 : 38; // ~21-26 FPS target for zero-lag responsiveness

    if (now - lastFrameProcessTimeRef.current < minInterval) {
      animFrameIdRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (!isProcessingRef.current) {
      isProcessingRef.current = true;
      lastFrameProcessTimeRef.current = now;

      // Watchdog timeout to prevent permanent lock if MediaPipe stalls
      const watchdog = setTimeout(() => {
        isProcessingRef.current = false;
      }, 250);

      try {
        await handsModelRef.current.send({ image: videoRef.current });
      } catch {
        // Ignored, proceed to next frame
      } finally {
        clearTimeout(watchdog);
        isProcessingRef.current = false;
      }
    }

    animFrameIdRef.current = requestAnimationFrame(processFrame);
  }, []);

  // Start camera stream with adaptive mobile/desktop constraints
  const startCamera = useCallback(
    async (desiredMode?: 'user' | 'environment') => {
      setCameraError(null);
      setCameraStatus('starting');
      setCameraStatusMessage('Initializing camera & MediaPipe dual-hand vision engine...');

      const targetMode = desiredMode || facingModeRef.current;
      facingModeRef.current = targetMode;
      setFacingMode(targetMode);

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Your browser does not support camera access (MediaDevices API).');
        }

        // Cleanly stop any existing stream tracks first
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => {
            track.stop();
            track.enabled = false;
          });
          streamRef.current = null;
        }

        const isMobileDevice =
          typeof window !== 'undefined' &&
          (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth <= 768);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: targetMode,
            width: { ideal: isMobileDevice ? 640 : 1280, max: 1920 },
            height: { ideal: isMobileDevice ? 480 : 720, max: 1080 }
          },
          audio: false
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Initialize MediaPipe with dual-hand tracking
        await initMediaPipeHands();

        setIsCameraActive(true);
        isCameraActiveRef.current = true;
        setCameraStatus('no_hand');
        setCameraStatusMessage('Camera active — Waiting for hand(s) in frame...');

        // Start processing loop
        animFrameIdRef.current = requestAnimationFrame(processFrame);
      } catch (err: any) {
        console.error('Camera start error:', err);
        let msg = err.message || 'Could not access camera.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          msg = 'Camera permission denied. Please allow camera access in your browser address bar.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          msg = 'No camera device detected on this system.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          msg = 'Camera is currently in use by another application or tab.';
        }
        setCameraError(msg);
        setCameraStatus('error');
        setCameraStatusMessage(`Camera error: ${msg}`);
        stopCamera();
      }
    },
    [initMediaPipeHands, processFrame, stopCamera]
  );

  // Toggle front/rear camera on mobile devices
  const toggleCameraFacing = useCallback(async () => {
    const nextMode = facingModeRef.current === 'user' ? 'environment' : 'user';
    facingModeRef.current = nextMode;
    setFacingMode(nextMode);

    if (isCameraActiveRef.current) {
      stopCamera();
      await new Promise((resolve) => setTimeout(resolve, 200));
      await startCamera(nextMode);
    }
  }, [startCamera, stopCamera]);

  // Retry camera upon failure
  const retryCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await startCamera();
  }, [startCamera, stopCamera]);

  // Tab visibility listener: pauses frame loop while hidden to save battery & CPU
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (animFrameIdRef.current) {
          cancelAnimationFrame(animFrameIdRef.current);
          animFrameIdRef.current = null;
        }
      } else {
        if (isCameraActiveRef.current && !animFrameIdRef.current) {
          animFrameIdRef.current = requestAnimationFrame(processFrame);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [processFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    isCameraActive,
    isHandDetected,
    handsCount,
    detectedHands,
    handedness,
    landmarks,
    normalizedFeatures,
    twoHandLandmarks,
    cameraStatus,
    cameraStatusMessage,
    cameraError,
    startCamera,
    stopCamera,
    retryCamera,
    toggleCameraFacing,
    facingMode,
    hasMultipleCameras,
    fps
  };
}
