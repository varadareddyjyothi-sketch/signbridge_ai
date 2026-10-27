import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  Sliders,
  AlertTriangle,
  Sparkles,
  HelpCircle,
  BarChart2,
  Layers,
  ChevronDown,
  ChevronUp,
  Cpu,
  Play,
  Square,
  Clock,
  Globe,
  Languages,
  Plus,
  Trash2,
  Search,
  Undo2,
  CheckCircle2,
  Copy,
  Check,
  MessageSquare,
  Pause,
  X,
  HeartPulse,
  BookOpen
} from 'lucide-react';
import { useWebcamHands } from '../hooks/useWebcamHands';
import { api } from '../services/api';
import { ttsService } from '../services/speech';
import { mediapipeGestureService } from '../services/mediapipeGestureService';
import { TemporalPredictionSmoother, type SmoothedPrediction } from '../lib/smoothing';
import type {
  ModelStatus,
  PredictionResult,
  GestureVocabularyEntry,
  SentenceTranslationResult,
  QuickPhraseCategory,
  QuickPhraseItem
} from '../types';

export type RecognitionMode = 'pretrained' | 'custom_isl';

export type RecognitionState =
  | 'waiting_hand'
  | 'recognizing'
  | 'gesture_detected'
  | 'unknown_gesture'
  | 'model_unavailable';

export type DisplayLanguageMode = 'all' | 'en' | 'te' | 'ro';

interface CameraRecognitionPanelProps {
  modelStatus: ModelStatus | null;
  onPredictionSaved?: () => void;
  onNavigateToStudio?: () => void;
  onNavigateToManageGestures?: () => void;
  practiceTargetSign?: { id: string; name: string } | null;
  onClearPracticeTarget?: () => void;
}

export const CameraRecognitionPanel: React.FC<CameraRecognitionPanelProps> = ({
  modelStatus,
  onPredictionSaved,
  onNavigateToStudio,
  onNavigateToManageGestures,
  practiceTargetSign,
  onClearPracticeTarget
}) => {
  const {
    videoRef,
    canvasRef,
    isCameraActive,
    isHandDetected,
    handsCount,
    handedness,
    normalizedFeatures,
    twoHandLandmarks,
    cameraError,
    startCamera,
    stopCamera,
    retryCamera,
    fps
  } = useWebcamHands();

  // Mode Selection: Pretrained General Gestures vs Custom ISL Classifier
  const [recognitionMode, setRecognitionMode] = useState<RecognitionMode>('pretrained');
  const [showTwoHandHelp, setShowTwoHandHelp] = useState<boolean>(false);

  // Recognition Active Flag (user can start/stop recognition independently while camera is on)
  const [isRecognizing, setIsRecognizing] = useState<boolean>(true);

  // Confidence rejection threshold (0.50 to 0.90)
  const [threshold, setThreshold] = useState<number>(0.65);

  // Auto-TTS Speech & preferred auto-speak language
  const [autoSpeak, setAutoSpeak] = useState<boolean>(true);
  const [autoSpeakLang, setAutoSpeakLang] = useState<'en' | 'te'>('en');

  // Display Language Preference ('all', 'en', 'te', 'ro')
  const [displayLanguage, setDisplayLanguage] = useState<DisplayLanguageMode>('all');

  // TTS notice (e.g. fallback notice when Telugu voice is missing)
  const [ttsNotice, setTtsNotice] = useState<string | null>(null);

  // Pretrained model ready state
  const [isPretrainedReady, setIsPretrainedReady] = useState<boolean>(false);
  const [pretrainedError, setPretrainedError] = useState<string | null>(null);

  // Probability breakdown accordion
  const [showProbabilities, setShowProbabilities] = useState<boolean>(false);

  // Dynamic Vocabulary from backend
  const [vocabularyList, setVocabularyList] = useState<GestureVocabularyEntry[]>([]);
  const [vocabSearch, setVocabSearch] = useState<string>('');
  const [vocabTypeFilter, setVocabTypeFilter] = useState<string>('all');

  // Sentence Builder State (Mode 1 & Mode 2)
  const [activeSentenceMode, setActiveSentenceMode] = useState<'camera_recognition' | 'quick_phrase'>('camera_recognition');
  const [sentenceTokens, setSentenceTokens] = useState<string[]>([]);
  const [sentenceDraft, setSentenceDraft] = useState<string>('');
  const [sentenceTranslation, setSentenceTranslation] = useState<SentenceTranslationResult | null>(null);
  const [isSentenceConfirmed, setIsSentenceConfirmed] = useState<boolean>(false);
  const [isSavingSentence, setIsSavingSentence] = useState<boolean>(false);
  const [sentenceSaveMessage, setSentenceSaveMessage] = useState<string | null>(null);
  const [copiedSentence, setCopiedSentence] = useState<boolean>(false);
  const [autoDeduplicateAdd, setAutoDeduplicateAdd] = useState<boolean>(false);
  const [isAutoAddPaused, setIsAutoAddPaused] = useState<boolean>(false);
  const [sentenceOutputLang, setSentenceOutputLang] = useState<'all' | 'en' | 'te' | 'ro'>('all');
  const lastAutoAddedSignRef = useRef<string | null>(null);

  // Quick Phrase Assistance State (Mode 2)
  const [quickPhraseCategories, setQuickPhraseCategories] = useState<QuickPhraseCategory[]>([]);
  const [quickPhrases, setQuickPhrases] = useState<QuickPhraseItem[]>([]);
  const [selectedPhraseCategory, setSelectedPhraseCategory] = useState<string>('all');
  const [phraseSearchQuery, setPhraseSearchQuery] = useState<string>('');
  const [isLoadingPhrases, setIsLoadingPhrases] = useState<boolean>(false);
  const [selectedQuickPhrase, setSelectedQuickPhrase] = useState<QuickPhraseItem | null>(null);
  const [showQuickPhraseLibrary, setShowQuickPhraseLibrary] = useState<boolean>(false);

  // Raw and Smoothed Predictions
  const smoother = useMemo(() => new TemporalPredictionSmoother(5, 0.6), []);
  const [rawPrediction, setRawPrediction] = useState<PredictionResult | null>(null);
  const [smoothed, setSmoothed] = useState<SmoothedPrediction>({
    stableLabel: null,
    stableMeaning: 'Start camera and recognition to analyze hand gestures live',
    stableTelugu: null,
    stableTeluguRomanized: null,
    smoothedConfidence: null,
    status: 'waiting',
    is_verified_isl: false,
    gesture_type: 'static',
    model_version: 'v1.0.0',
    isStable: false,
    agreementRatio: 0,
    allProbabilities: null
  });

  // Last accepted gesture and timestamp
  const [lastAcceptedGesture, setLastAcceptedGesture] = useState<{
    label: string;
    meaning: string;
    telugu?: string | null;
    telugu_romanized?: string | null;
    timestamp: string;
    confidence: number | null;
    model_version?: string;
    gesture_type?: 'static' | 'dynamic' | 'verified_isl' | 'two_hand_isl' | 'general_gesture' | 'two_hand';
  } | null>(null);

  // Recent predictions history trail
  const [historyTrail, setHistoryTrail] = useState<
    {
      label: string;
      meaning: string;
      telugu?: string | null;
      telugu_romanized?: string | null;
      time: string;
      confidence: number | null;
    }[]
  >([]);

  // Throttling & In-flight guards
  const inFlightRef = useRef<boolean>(false);
  const lastCallTimeRef = useRef<number>(0);
  const lastSpokenLabelRef = useRef<string>('');
  const lastSpokenTimeRef = useRef<number>(0);

  // Model availability flags
  const isCustomModelAvailable = modelStatus && modelStatus.status !== 'unavailable';

  // Load Dynamic Vocabulary from API
  const loadVocabulary = useCallback(async () => {
    try {
      const data = await api.getVocabulary();
      if (data && data.gestures) {
        setVocabularyList(data.gestures);
      }
    } catch (err) {
      console.warn('Failed to fetch vocabulary:', err);
    }
  }, []);

  useEffect(() => {
    loadVocabulary();
  }, [loadVocabulary]);

  // Initialize MediaPipe Gesture Recognizer on component mount
  useEffect(() => {
    let mounted = true;
    mediapipeGestureService
      .initialize()
      .then((ready) => {
        if (mounted) {
          setIsPretrainedReady(ready);
          if (!ready) {
            setPretrainedError(mediapipeGestureService.getLoadError());
          }
        }
      })
      .catch((err) => {
        if (mounted) {
          setIsPretrainedReady(false);
          setPretrainedError(err?.message || 'Failed to initialize pretrained recognizer');
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Compute Current Recognition State
  const recognitionState: RecognitionState = useMemo(() => {
    if (!isCameraActive || !isRecognizing) return 'waiting_hand';

    if (recognitionMode === 'custom_isl' && !isCustomModelAvailable) {
      return 'model_unavailable';
    }
    if (recognitionMode === 'pretrained' && !isPretrainedReady && pretrainedError) {
      return 'model_unavailable';
    }

    if (!isHandDetected) return 'waiting_hand';

    if (smoothed.status === 'accepted' && smoothed.stableMeaning) {
      return 'gesture_detected';
    }

    if (smoothed.status === 'uncertain_rejected' || rawPrediction?.status === 'uncertain_rejected') {
      return 'unknown_gesture';
    }

    return 'recognizing';
  }, [
    isCameraActive,
    isRecognizing,
    recognitionMode,
    isCustomModelAvailable,
    isPretrainedReady,
    pretrainedError,
    isHandDetected,
    smoothed,
    rawPrediction
  ]);

  // Stable refs to prevent speech callbacks from triggering re-render loops
  const smoothedRef = useRef(smoothed);
  smoothedRef.current = smoothed;
  const lastAcceptedGestureRef = useRef(lastAcceptedGesture);
  lastAcceptedGestureRef.current = lastAcceptedGesture;

  // Auto-switch recognition mode when a practice target is selected
  useEffect(() => {
    if (practiceTargetSign) {
      if (practiceTargetSign.id.startsWith('ISL_')) {
        setRecognitionMode('custom_isl');
      } else {
        setRecognitionMode('pretrained');
      }
    }
  }, [practiceTargetSign]);

  // Speech Helper: English (stable callback, uses refs to avoid render cascades)
  const handleSpeakEnglish = useCallback((customText?: string) => {
    const textToSpeak = customText || smoothedRef.current.stableMeaning || lastAcceptedGestureRef.current?.meaning;
    if (textToSpeak) {
      ttsService.speak(textToSpeak, 'en').catch((err) => console.warn('TTS speak error:', err));
    }
  }, []);

  // Speech Helper: Telugu (stable callback, uses refs to avoid render cascades)
  const handleSpeakTelugu = useCallback((customTelugu?: string, customRomanized?: string) => {
    const teText = customTelugu || smoothedRef.current.stableTelugu || lastAcceptedGestureRef.current?.telugu;
    const roText = customRomanized || smoothedRef.current.stableTeluguRomanized || lastAcceptedGestureRef.current?.telugu_romanized;
    if (!teText && !roText) return;

    const hasTeluguVoice = ttsService.hasTeluguVoice();
    if (!hasTeluguVoice) {
      setTtsNotice('Notice: Local browser lacks native Telugu voice pack. Pronouncing Romanized Telugu via phonetic fallback.');
      setTimeout(() => setTtsNotice(null), 5000);
    }

    ttsService.speak(teText || roText || '', 'te', roText || undefined).catch((err) =>
      console.warn('TTS speak error:', err)
    );
  }, []);

  // Stop Speech Handler
  const handleStopSpeech = useCallback(() => {
    ttsService.stop();
  }, []);

  // Stop camera and reset smoothing
  const handleStopCamera = useCallback(() => {
    stopCamera();
    smoother.reset();
    setRawPrediction(null);
    setSmoothed({
      stableLabel: null,
      stableMeaning: 'Recognition stopped',
      stableTelugu: null,
      stableTeluguRomanized: null,
      smoothedConfidence: null,
      status: 'waiting',
      is_verified_isl: false,
      gesture_type: 'static',
      model_version: 'v1.0.0',
      isStable: false,
      agreementRatio: 0,
      allProbabilities: null
    });
  }, [stopCamera, smoother]);

  // Load Quick Phrase Assistance Library (Mode 2)
  const loadQuickPhrases = useCallback(async (cat?: string, search?: string) => {
    setIsLoadingPhrases(true);
    try {
      const res = await api.getQuickPhrases(cat, search);
      if (res) {
        setQuickPhraseCategories(res.categories || []);
        setQuickPhrases(res.phrases || []);
      }
    } catch (err) {
      console.warn('Failed to load quick phrases:', err);
    } finally {
      setIsLoadingPhrases(false);
    }
  }, []);

  useEffect(() => {
    loadQuickPhrases(selectedPhraseCategory, phraseSearchQuery);
  }, [selectedPhraseCategory, phraseSearchQuery, loadQuickPhrases]);

  // Sentence Builder Handlers (Mode 1 & Mode 2)
  const handleAddTokenToSentence = useCallback((tokenToAdd?: string) => {
    const token = tokenToAdd || smoothedRef.current?.stableLabel || lastAcceptedGestureRef.current?.label;
    if (!token) return;
    setActiveSentenceMode('camera_recognition');
    setSelectedQuickPhrase(null);
    setSentenceTokens((prev) => {
      const next = [...prev, token];
      api.translateSentence(next)
        .then((res) => {
          setSentenceTranslation(res);
          setSentenceDraft(res.english);
        })
        .catch(() => {
          setSentenceDraft(next.join(' '));
        });
      return next;
    });
    setIsSentenceConfirmed(false);
    setSentenceSaveMessage(null);
  }, []);

  const handleRemoveToken = useCallback((indexToRemove: number) => {
    setSentenceTokens((prev) => {
      const next = prev.filter((_, idx) => idx !== indexToRemove);
      if (next.length > 0) {
        api.translateSentence(next)
          .then((res) => {
            setSentenceTranslation(res);
            setSentenceDraft(res.english);
          })
          .catch(() => {
            setSentenceDraft(next.join(' '));
          });
      } else {
        setSentenceTranslation(null);
        setSentenceDraft('');
      }
      return next;
    });
    setActiveSentenceMode('camera_recognition');
    setIsSentenceConfirmed(false);
    setSentenceSaveMessage(null);
  }, []);

  const handleSelectQuickPhrase = useCallback((phrase: QuickPhraseItem) => {
    setSelectedQuickPhrase(phrase);
    setActiveSentenceMode('quick_phrase');
    setSentenceDraft(phrase.english);
    setSentenceTokens([phrase.id]);
    setSentenceTranslation({
      tokens: [phrase.id],
      english: phrase.english,
      telugu: phrase.telugu,
      telugu_romanized: phrase.telugu_romanized,
      sentence_intent: phrase.category,
      punctuation: phrase.english.endsWith('?') ? '?' : phrase.english.endsWith('!') ? '!' : '.',
      is_idiomatic_match: true,
      source_mode: 'quick_phrase'
    });
    setIsSentenceConfirmed(false);
    setSentenceSaveMessage(null);
  }, []);

  const handleUndoLastWord = useCallback(() => {
    setSentenceTokens((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      if (next.length > 0) {
        api.translateSentence(next)
          .then((res) => {
            setSentenceTranslation(res);
            setSentenceDraft(res.english);
          })
          .catch(() => {
            setSentenceDraft(next.join(' '));
          });
      } else {
        setSentenceTranslation(null);
        setSentenceDraft('');
      }
      return next;
    });
    setActiveSentenceMode('camera_recognition');
    setIsSentenceConfirmed(false);
    setSentenceSaveMessage(null);
  }, []);

  const handleClearSentence = useCallback(() => {
    setSentenceTokens([]);
    setSentenceDraft('');
    setSentenceTranslation(null);
    setSelectedQuickPhrase(null);
    setActiveSentenceMode('camera_recognition');
    setIsSentenceConfirmed(false);
    setSentenceSaveMessage(null);
    lastAutoAddedSignRef.current = null;
  }, []);

  const handleConfirmSentence = useCallback(async () => {
    const textToSave = sentenceDraft.trim() || sentenceTokens.join(' ');
    if (!textToSave && sentenceTokens.length === 0) return;
    if (isSavingSentence || isSentenceConfirmed) return;
    setIsSavingSentence(true);
    setSentenceSaveMessage(null);
    try {
      await api.saveConfirmedSentence({
        original_signs: sentenceTokens,
        confirmed_sentence: textToSave,
        english_output: sentenceTranslation?.english || textToSave,
        telugu_output: sentenceTranslation?.telugu || undefined,
        romanized_output: sentenceTranslation?.telugu_romanized || undefined,
        selected_language: sentenceOutputLang === 'all' ? 'en' : sentenceOutputLang,
        recognition_mode: recognitionMode,
        source_mode: activeSentenceMode
      });
      setIsSentenceConfirmed(true);
      setSentenceSaveMessage(
        activeSentenceMode === 'quick_phrase'
          ? 'Quick phrase confirmed and saved to history!'
          : 'Camera sentence confirmed and saved to history!'
      );
      onPredictionSaved?.();
      setTimeout(() => setSentenceSaveMessage(null), 4000);
    } catch (err: any) {
      setSentenceSaveMessage(`Failed to save: ${err.message || 'Network error'}`);
    } finally {
      setIsSavingSentence(false);
    }
  }, [sentenceDraft, sentenceTokens, sentenceTranslation, sentenceOutputLang, recognitionMode, activeSentenceMode, isSavingSentence, isSentenceConfirmed, onPredictionSaved]);

  const handleCopySentence = useCallback(() => {
    const textToCopy = sentenceDraft.trim() || sentenceTokens.join(' ');
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedSentence(true);
    setTimeout(() => setCopiedSentence(false), 2000);
  }, [sentenceDraft, sentenceTokens]);

  // Main Recognition Loop
  useEffect(() => {
    if (!isCameraActive || !isRecognizing) {
      return;
    }

    // 1. If hand is not detected in camera view
    if (!isHandDetected) {
      const emptyResult: PredictionResult = {
        detected: false,
        label: null,
        english_meaning: 'Waiting for hand in frame...',
        telugu: null,
        telugu_romanized: null,
        confidence: null,
        status: 'no_hand',
        is_verified_isl: false,
        gesture_type: 'static',
        model_version: modelStatus?.active_version || 'v1.0.0',
        all_probabilities: null,
        rejection_threshold_used: threshold,
        timestamp: new Date().toISOString()
      };
      setRawPrediction(emptyResult);
      setSmoothed(smoother.push(emptyResult));
      return;
    }

    // 2. Mode A: Pretrained General Gestures (Client-Side MediaPipe GestureRecognizer)
    if (recognitionMode === 'pretrained') {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      const now = performance.now();
      // Throttle client-side inference to ~15-20 FPS for optimal battery and UI responsiveness
      if (now - lastCallTimeRef.current < 65) return;
      lastCallTimeRef.current = now;

      const { prediction } = mediapipeGestureService.recognizeFrame(
        videoRef.current,
        Math.round(now),
        threshold
      );

      setRawPrediction(prediction);
      const smoothRes = smoother.push(prediction);
      setSmoothed(smoothRes);

      // Handle accepted stable prediction
      if (smoothRes.status === 'accepted' && smoothRes.isStable && smoothRes.stableLabel && smoothRes.stableMeaning) {
        const currentTime = Date.now();
        const isNewLabel = smoothRes.stableLabel !== lastSpokenLabelRef.current;
        const isCooldownElapsed = currentTime - lastSpokenTimeRef.current > 2500;

        // Auto-TTS speech policy
        if (autoSpeak && (isNewLabel || isCooldownElapsed)) {
          lastSpokenLabelRef.current = smoothRes.stableLabel;
          lastSpokenTimeRef.current = currentTime;
          if (autoSpeakLang === 'te') {
            handleSpeakTelugu(smoothRes.stableTelugu || undefined, smoothRes.stableTeluguRomanized || undefined);
          } else {
            handleSpeakEnglish(smoothRes.stableMeaning);
          }
        }

        // Update last accepted gesture
        const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastAcceptedGesture({
          label: smoothRes.stableLabel,
          meaning: smoothRes.stableMeaning,
          telugu: smoothRes.stableTelugu,
          telugu_romanized: smoothRes.stableTeluguRomanized,
          timestamp: timeFormatted,
          confidence: smoothRes.smoothedConfidence,
          model_version: smoothRes.model_version || 'Pretrained v0.10',
          gesture_type: smoothRes.gesture_type || 'static'
        });

        // Deduplicated history trail
        if (isNewLabel) {
          setHistoryTrail((prev) => [
            {
              label: smoothRes.stableLabel!,
              meaning: smoothRes.stableMeaning!,
              telugu: smoothRes.stableTelugu,
              telugu_romanized: smoothRes.stableTeluguRomanized,
              time: timeFormatted,
              confidence: smoothRes.smoothedConfidence
            },
            ...prev.slice(0, 5)
          ]);

          api
            .saveHistory({
              predicted_label: smoothRes.stableLabel,
              english_meaning: smoothRes.stableMeaning,
              confidence: smoothRes.smoothedConfidence ?? undefined,
              recognition_mode: 'pretrained_mediapipe'
            })
            .then(() => onPredictionSaved?.())
            .catch(() => {});

          if (autoDeduplicateAdd && smoothRes.stableLabel && smoothRes.stableLabel !== lastAutoAddedSignRef.current) {
            lastAutoAddedSignRef.current = smoothRes.stableLabel;
            handleAddTokenToSentence(smoothRes.stableLabel);
          }
        }
      }
      return;
    }

    // 3. Mode B: Custom ISL Classifier (Backend Trained Random Forest)
    if (recognitionMode === 'custom_isl') {
      if (!isCustomModelAvailable) {
        const unavailResult: PredictionResult = {
          detected: true,
          label: null,
          english_meaning: 'Custom ISL model unavailable',
          telugu: null,
          telugu_romanized: null,
          confidence: null,
          status: 'model_unavailable',
          is_verified_isl: false,
          gesture_type: 'static',
          model_version: 'unavailable',
          all_probabilities: null,
          rejection_threshold_used: threshold,
          timestamp: new Date().toISOString()
        };
        setRawPrediction(unavailResult);
        setSmoothed(smoother.push(unavailResult));
        return;
      }

      const now = performance.now();
      // Throttle backend inference to ~3.8 FPS (every 260ms) with in-flight guard
      if (now - lastCallTimeRef.current < 260 || inFlightRef.current) return;
      lastCallTimeRef.current = now;
      inFlightRef.current = true;

      let isCancelled = false;
      const inferencePromise =
        handsCount === 2 && twoHandLandmarks.left && twoHandLandmarks.right
          ? api.predictTwoHand(twoHandLandmarks.left, twoHandLandmarks.right, threshold)
          : normalizedFeatures
          ? api.predict(null, handedness, normalizedFeatures, threshold)
          : null;

      if (!inferencePromise) {
        inFlightRef.current = false;
        return;
      }

      inferencePromise
        .then((res) => {
          if (isCancelled) return;
          setRawPrediction(res);
          const smoothRes = smoother.push(res);
          setSmoothed(smoothRes);

          if (smoothRes.status === 'accepted' && smoothRes.isStable && smoothRes.stableLabel && smoothRes.stableMeaning) {
            const currentTime = Date.now();
            const isNewLabel = smoothRes.stableLabel !== lastSpokenLabelRef.current;
            const isCooldownElapsed = currentTime - lastSpokenTimeRef.current > 2500;

            if (autoSpeak && (isNewLabel || isCooldownElapsed)) {
              lastSpokenLabelRef.current = smoothRes.stableLabel;
              lastSpokenTimeRef.current = currentTime;
              if (autoSpeakLang === 'te') {
                handleSpeakTelugu(smoothRes.stableTelugu || undefined, smoothRes.stableTeluguRomanized || undefined);
              } else {
                handleSpeakEnglish(smoothRes.stableMeaning);
              }
            }

            const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setLastAcceptedGesture({
              label: smoothRes.stableLabel,
              meaning: smoothRes.stableMeaning,
              telugu: smoothRes.stableTelugu,
              telugu_romanized: smoothRes.stableTeluguRomanized,
              timestamp: timeFormatted,
              confidence: smoothRes.smoothedConfidence,
              model_version: smoothRes.model_version || modelStatus?.active_version || 'v1.0.0',
              gesture_type: smoothRes.gesture_type || 'verified_isl'
            });

            if (isNewLabel) {
              setHistoryTrail((prev) => [
                {
                  label: smoothRes.stableLabel!,
                  meaning: smoothRes.stableMeaning!,
                  telugu: smoothRes.stableTelugu,
                  telugu_romanized: smoothRes.stableTeluguRomanized,
                  time: timeFormatted,
                  confidence: smoothRes.smoothedConfidence
                },
                ...prev.slice(0, 5)
              ]);

              api
                .saveHistory({
                  predicted_label: smoothRes.stableLabel,
                  english_meaning: smoothRes.stableMeaning,
                  confidence: smoothRes.smoothedConfidence ?? undefined,
                  recognition_mode: 'custom_isl_rf'
                })
                .then(() => onPredictionSaved?.())
                .catch(() => {});

              if (autoDeduplicateAdd && smoothRes.stableLabel && smoothRes.stableLabel !== lastAutoAddedSignRef.current) {
                lastAutoAddedSignRef.current = smoothRes.stableLabel;
                handleAddTokenToSentence(smoothRes.stableLabel);
              }
            }
          }
        })
        .catch((err) => {
          if (!isCancelled) console.warn('Inference request failed:', err);
        })
        .finally(() => {
          inFlightRef.current = false;
        });

      return () => {
        isCancelled = true;
      };
    }
  }, [
    isCameraActive,
    isRecognizing,
    isHandDetected,
    recognitionMode,
    normalizedFeatures,
    handedness,
    threshold,
    autoSpeak,
    autoSpeakLang,
    isCustomModelAvailable,
    isPretrainedReady,
    pretrainedError,
    smoother,
    videoRef,
    modelStatus,
    handleSpeakEnglish,
    handleSpeakTelugu,
    onPredictionSaved,
    handleAddTokenToSentence,
    autoDeduplicateAdd
  ]);

  // Filtered vocabulary for Cheat Sheet
  const filteredVocabulary = useMemo(() => {
    return vocabularyList.filter((item) => {
      if (vocabTypeFilter === 'verified_isl' && item.gesture_type !== 'verified_isl') return false;
      if (vocabTypeFilter === 'static' && item.gesture_type !== 'static') return false;
      if (vocabTypeFilter === 'dynamic' && item.gesture_type !== 'dynamic') return false;

      if (vocabSearch) {
        const q = vocabSearch.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchTe = (item.telugu || '').toLowerCase().includes(q);
        const matchRo = (item.telugu_romanized || '').toLowerCase().includes(q);
        const matchId = item.id.toLowerCase().includes(q);
        if (!matchName && !matchTe && !matchRo && !matchId) return false;
      }
      return true;
    });
  }, [vocabularyList, vocabTypeFilter, vocabSearch]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.22fr) minmax(320px, 1fr)', gap: '24px', alignItems: 'start' }}>
      {/* =========================================================================
          LEFT PANEL: Live Webcam Preview & Controls
          ========================================================================= */}
      <div className="glass-panel" style={{ padding: '20px', overflow: 'hidden' }}>
        {/* Panel Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={18} color="#818cf8" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Live Camera & Hand Tracking</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isCameraActive && (
              <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                {fps} FPS
              </span>
            )}
            <span
              className={`badge ${
                isCameraActive
                  ? isHandDetected
                    ? handsCount === 2
                      ? 'badge-success'
                      : 'badge-primary'
                    : 'badge-warning'
                  : 'badge-neutral'
              }`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: handsCount === 2 ? '0 0 10px rgba(16, 185, 129, 0.4)' : undefined
              }}
            >
              {isCameraActive
                ? isHandDetected
                  ? handsCount === 2
                    ? '🙌 Two Hands Detected (Left & Right)'
                    : `✋ One Hand Detected (${handedness} Hand)`
                  : '⚪ No Hands Detected'
                : 'Camera Off'}
            </span>
          </div>
        </div>

        {/* Practice Mode Banner */}
        {practiceTargetSign && (
          <div
            style={{
              background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.2), rgba(16, 185, 129, 0.2))',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={18} color="#818cf8" />
              <div>
                <span style={{ fontSize: '0.72rem', color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                  Practice Target
                </span>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
                  {practiceTargetSign.name}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {smoothed.stableLabel === practiceTargetSign.id && (
                <span className="badge badge-success" style={{ fontWeight: 700, animation: 'pulse 1.5s infinite' }}>
                  ✓ Target Recognized!
                </span>
              )}
              {onClearPracticeTarget && (
                <button
                  className="btn btn-secondary"
                  onClick={onClearPracticeTarget}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  Exit Practice
                </button>
              )}
            </div>
          </div>
        )}

        {/* Video & Canvas Stage */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '4 / 3',
            background: '#030712',
            borderRadius: '12px',
            overflow: 'hidden',
            border: isHandDetected
              ? smoothed.status === 'accepted'
                ? '2px solid rgba(16, 185, 129, 0.7)'
                : '2px solid rgba(56, 189, 248, 0.5)'
              : '1px solid var(--border-subtle)',
            boxShadow: isHandDetected
              ? smoothed.status === 'accepted'
                ? '0 0 25px rgba(16, 185, 129, 0.25)'
                : '0 0 20px rgba(56, 189, 248, 0.15)'
              : 'none',
            transition: 'border 0.3s ease, box-shadow 0.3s ease'
          }}
        >
          {/* Webcam Video Mirror */}
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
              opacity: isCameraActive ? 1 : 0
            }}
          />

          {/* Skeleton Canvas Overlay */}
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}
          />

          {/* Inactive Standby Overlay */}
          {!isCameraActive && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                textAlign: 'center',
                background: 'rgba(7, 11, 20, 0.90)'
              }}
            >
              <div
                style={{
                  width: '58px',
                  height: '58px',
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '14px',
                  boxShadow: '0 0 20px rgba(99, 102, 241, 0.25)'
                }}
              >
                <Camera size={28} color="#818cf8" />
              </div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '6px', fontWeight: 700 }}>
                Webcam is Standby
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '340px', marginBottom: '20px', lineHeight: 1.5 }}>
                Click below to start your camera. Supported gestures will be recognized live without pressing any buttons.
              </p>
              <button className="btn btn-primary" onClick={startCamera} style={{ padding: '12px 24px' }}>
                <Camera size={18} />
                <span>Start Camera</span>
              </button>
            </div>
          )}

          {/* Camera Error Alert */}
          {cameraError && (
            <div
              style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                right: '12px',
                background: 'rgba(244, 63, 94, 0.94)',
                backdropFilter: 'blur(8px)',
                padding: '12px 16px',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>{cameraError}</span>
              </div>
              <button
                className="btn btn-secondary"
                onClick={retryCamera}
                style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.2)', border: 'none', color: '#ffffff' }}
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Toolbar Controls */}
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Mode Switcher Tabs */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <button
              onClick={() => {
                setRecognitionMode('pretrained');
                smoother.reset();
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: recognitionMode === 'pretrained' ? 'linear-gradient(135deg, #4f46e5, #06b6d4)' : 'transparent',
                color: recognitionMode === 'pretrained' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: recognitionMode === 'pretrained' ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <Globe size={14} />
              <span>Pretrained General Gestures</span>
            </button>

            <button
              onClick={() => {
                setRecognitionMode('custom_isl');
                smoother.reset();
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: recognitionMode === 'custom_isl' ? 'linear-gradient(135deg, #4f46e5, #06b6d4)' : 'transparent',
                color: recognitionMode === 'custom_isl' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: recognitionMode === 'custom_isl' ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <Cpu size={14} />
              <span>Custom ISL Classifier</span>
            </button>
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {isCameraActive ? (
                <button className="btn btn-danger" onClick={handleStopCamera}>
                  <CameraOff size={15} />
                  <span>Stop Camera</span>
                </button>
              ) : (
                <button className="btn btn-primary" onClick={startCamera}>
                  <Camera size={15} />
                  <span>Start Camera</span>
                </button>
              )}

              {isCameraActive && (
                <button
                  className={`btn ${isRecognizing ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={() => setIsRecognizing(!isRecognizing)}
                >
                  {isRecognizing ? <Square size={14} /> : <Play size={14} />}
                  <span>{isRecognizing ? 'Stop Recognition' : 'Start Recognition'}</span>
                </button>
              )}
            </div>

            {/* Confidence Threshold Slider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <Sliders size={14} color="#94a3b8" />
              <label htmlFor="conf-slider" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Threshold:
              </label>
              <input
                id="conf-slider"
                type="range"
                min="0.50"
                max="0.90"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                style={{ cursor: 'pointer', width: '75px' }}
              />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c7d2fe', minWidth: '32px' }}>
                {Math.round(threshold * 100)}%
              </span>
            </div>
          </div>

          {/* Two-Hand ISL Positioning Guidance Accordion */}
          <div
            style={{
              marginTop: '4px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden'
            }}
          >
            <button
              onClick={() => setShowTwoHandHelp(!showTwoHandHelp)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                color: '#93c5fd',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={15} color="#38bdf8" />
                <span>How to Position Both Hands for ISL Signs</span>
              </div>
              {showTwoHandHelp ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {showTwoHandHelp && (
              <div style={{ padding: '0 14px 14px 14px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>
                    <strong style={{ color: '#06b6d4' }}>Left Hand</strong> is tracked in Cyan; <strong style={{ color: '#a855f7' }}>Right Hand</strong> in Purple.
                  </li>
                  <li>
                    <strong style={{ color: '#ffffff' }}>Namaste (ISL_NAMASTE):</strong> Bring both open palms flat together vertically at chest level with fingertips touching.
                  </li>
                  <li>
                    <strong style={{ color: '#ffffff' }}>Book (ISL_BOOK):</strong> Place pinky edges adjacent with palms open and facing upward like an open book.
                  </li>
                  <li>
                    <strong style={{ color: '#ffffff' }}>House (ISL_HOUSE):</strong> Form an inverted 'V' roof by touching index/middle fingertips with wrists spaced apart.
                  </li>
                  <li>
                    <strong style={{ color: '#ffffff' }}>Clap (ISL_CLAP):</strong> Bring both open palms together in clapping contact.
                  </li>
                  <li>
                    <strong style={{ color: '#ffffff' }}>Help (ISL_HELP_2HAND):</strong> Place a closed fist (with thumb up) resting on top of a flat open palm.
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          RIGHT PANEL: AI Live Multilingual Recognition Results
          ========================================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Main AI Results Card */}
        <div className="glass-panel-glow" style={{ padding: '24px', position: 'relative' }}>
          {/* Card Header & Auto Speak Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} color="#38bdf8" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>AI Live Recognition</h2>
            </div>

            {/* Auto Speak Options */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className={`btn ${autoSpeak ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAutoSpeak(!autoSpeak)}
                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                title="Automatically vocalize accepted gestures"
              >
                {autoSpeak ? <Volume2 size={13} /> : <VolumeX size={13} />}
                <span>Auto-Speak: {autoSpeak ? 'ON' : 'OFF'}</span>
              </button>

              {autoSpeak && (
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '2px' }}>
                  <button
                    onClick={() => setAutoSpeakLang('en')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.7rem',
                      border: 'none',
                      borderRadius: '4px',
                      background: autoSpeakLang === 'en' ? '#6366f1' : 'transparent',
                      color: autoSpeakLang === 'en' ? '#ffffff' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => setAutoSpeakLang('te')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.7rem',
                      border: 'none',
                      borderRadius: '4px',
                      background: autoSpeakLang === 'te' ? '#06b6d4' : 'transparent',
                      color: autoSpeakLang === 'te' ? '#ffffff' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    తెలుగు
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Language Selector in Results Panel */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              marginBottom: '14px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '0.74rem', marginRight: '4px' }}>
              <Languages size={14} color="#38bdf8" />
              <span>Language View:</span>
            </div>

            {(['all', 'en', 'te', 'ro'] as DisplayLanguageMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setDisplayLanguage(mode)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.74rem',
                  fontWeight: displayLanguage === mode ? 700 : 500,
                  background: displayLanguage === mode ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                  color: displayLanguage === mode ? '#ffffff' : 'var(--text-secondary)',
                  borderBottom: displayLanguage === mode ? '2px solid #6366f1' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {mode === 'all' && 'All Modes'}
                {mode === 'en' && 'English'}
                {mode === 'te' && 'తెలుగు (Telugu)'}
                {mode === 'ro' && 'Romanized'}
              </button>
            ))}
          </div>

          {/* TTS Notice Alert */}
          {ttsNotice && (
            <div
              style={{
                marginBottom: '14px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(6, 182, 212, 0.12)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                fontSize: '0.75rem',
                color: '#67e8f9',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span>{ttsNotice}</span>
            </div>
          )}

          {/* Model Identification & Status Strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '8px'
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                Active Model
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>
                  {recognitionMode === 'pretrained'
                    ? 'MediaPipe GestureRecognizer'
                    : modelStatus?.model_name || 'Random Forest Classifier'}
                </span>
                <span className="badge badge-neutral" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                  {recognitionMode === 'pretrained' ? 'v0.10' : modelStatus?.active_version || 'v1.0.0'}
                </span>
              </div>
            </div>

            {/* Mode Category Tag */}
            <span
              className={`badge ${recognitionMode === 'pretrained' ? 'badge-primary' : 'badge-success'}`}
              style={{ fontSize: '0.72rem' }}
            >
              {recognitionMode === 'pretrained' ? 'General Gestures (Pretrained)' : 'Verified ISL Vocabulary'}
            </span>
          </div>

          {/* Recognition State Banner */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                Recognition State
              </span>
              <span
                className={`badge ${
                  recognitionState === 'gesture_detected'
                    ? 'badge-success'
                    : recognitionState === 'recognizing'
                    ? 'badge-primary'
                    : recognitionState === 'unknown_gesture'
                    ? 'badge-warning'
                    : recognitionState === 'model_unavailable'
                    ? 'badge-danger'
                    : 'badge-neutral'
                }`}
                style={{ fontSize: '0.72rem' }}
              >
                {recognitionState === 'gesture_detected' && 'Gesture Detected'}
                {recognitionState === 'recognizing' && 'Recognizing...'}
                {recognitionState === 'unknown_gesture' && 'Unknown Gesture'}
                {recognitionState === 'model_unavailable' && 'Model Unavailable'}
                {recognitionState === 'waiting_hand' && 'Waiting for Hand'}
              </span>
            </div>
          </div>

          {/* Large Current Gesture Display */}
          {recognitionState === 'gesture_detected' ? (
            <div style={{ marginBottom: '20px' }}>
              {/* Telugu Script Translation (Prominent Display) */}
              {(displayLanguage === 'all' || displayLanguage === 'te') && smoothed.stableTelugu && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.74rem', color: '#67e8f9', fontWeight: 600, textTransform: 'uppercase' }}>
                    తెలుగు (Telugu Script)
                  </div>
                  <div
                    style={{
                      fontSize: '2.4rem',
                      fontWeight: 800,
                      lineHeight: 1.2,
                      background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      fontFamily: '"Anek Telugu", "Noto Sans Telugu", sans-serif'
                    }}
                  >
                    {smoothed.stableTelugu}
                  </div>
                </div>
              )}

              {/* English Meaning */}
              {(displayLanguage === 'all' || displayLanguage === 'en') && (
                <div style={{ marginBottom: '6px' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    English Output
                  </div>
                  <h1 style={{ fontSize: displayLanguage === 'en' ? '2.2rem' : '1.45rem', color: '#ffffff', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                    {smoothed.stableMeaning}
                  </h1>
                </div>
              )}

              {/* Romanized Telugu */}
              {(displayLanguage === 'all' || displayLanguage === 'ro') && smoothed.stableTeluguRomanized && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Romanized Telugu
                  </div>
                  <div style={{ fontSize: displayLanguage === 'ro' ? '1.8rem' : '1.05rem', color: '#c7d2fe', fontStyle: 'italic', fontWeight: 600 }}>
                    "{smoothed.stableTeluguRomanized}"
                  </div>
                </div>
              )}

              {/* Meta Tags: Raw Label, Verification, Consensus */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                <span className="badge badge-primary" style={{ fontSize: '0.76rem' }}>
                  Label: {smoothed.stableLabel}
                </span>

                {/* Clear distinction: Verified ISL Sign vs General Gesture */}
                {smoothed.is_verified_isl ? (
                  <span
                    className="badge badge-success"
                    style={{
                      fontSize: '0.74rem',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(99, 102, 241, 0.25))',
                      border: '1px solid #10b981',
                      color: '#a7f3d0',
                      fontWeight: 700
                    }}
                  >
                    ✓ Verified ISL Sign
                  </span>
                ) : (
                  <span className="badge badge-neutral" style={{ fontSize: '0.72rem', color: '#38bdf8' }}>
                    ✋ General Gesture
                  </span>
                )}

                {/* Two-Hand Sign Badge */}
                {(smoothed.gesture_type === 'two_hand_isl' || rawPrediction?.hands_detected === 2 || smoothed.stableLabel?.includes('2HAND') || smoothed.stableLabel?.includes('BOOK') || smoothed.stableLabel?.includes('HOUSE') || smoothed.stableLabel?.includes('CLAP')) && (
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.72rem',
                      background: 'rgba(6, 182, 212, 0.2)',
                      border: '1px solid #06b6d4',
                      color: '#67e8f9',
                      fontWeight: 600
                    }}
                  >
                    🙌 Two-Hand Sign
                  </span>
                )}

                <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                  Consensus: {Math.round(smoothed.agreementRatio * 100)}%
                </span>
              </div>
            </div>
          ) : recognitionState === 'unknown_gesture' ? (
            <div style={{ marginBottom: '20px', padding: '16px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fcd34d', marginBottom: '4px' }}>
                <AlertTriangle size={18} />
                <strong style={{ fontSize: '1.05rem' }}>Unknown / Unsupported Gesture</strong>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Hand shape is ambiguous or confidence {rawPrediction?.confidence ? `(${Math.round(rawPrediction.confidence * 100)}%)` : ''} is below the {Math.round(threshold * 100)}% threshold gate. The system will not guess or invent labels for unknown gestures.
              </p>
            </div>
          ) : recognitionState === 'model_unavailable' ? (
            <div style={{ marginBottom: '20px', padding: '16px', borderRadius: '10px', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fca5a5', marginBottom: '4px' }}>
                <AlertTriangle size={18} />
                <strong style={{ fontSize: '1.05rem' }}>Model Unavailable</strong>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '8px' }}>
                {recognitionMode === 'custom_isl'
                  ? 'No trained custom model file was found on the backend. You can switch to Pretrained General Gestures, manage vocabulary, or collect samples in Dataset Studio.'
                  : pretrainedError || 'Pretrained model file failed to load.'}
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {onNavigateToManageGestures && (
                  <button className="btn btn-secondary" onClick={onNavigateToManageGestures} style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                    <Sparkles size={14} />
                    <span>Manage Gestures</span>
                  </button>
                )}
                {onNavigateToStudio && (
                  <button className="btn btn-secondary" onClick={onNavigateToStudio} style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                    <Layers size={14} />
                    <span>Dataset Studio</span>
                  </button>
                )}
              </div>
            </div>
          ) : isHandDetected ? (
            <div style={{ textAlign: 'center', padding: '24px 10px', marginBottom: '20px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                <Sparkles size={24} color="#38bdf8" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
                <span className="badge badge-neutral" style={{ color: '#38bdf8', fontSize: '0.74rem' }}>
                  State: Hand Detected
                </span>
                <span className="badge badge-neutral" style={{ fontSize: '0.74rem' }}>
                  {handsCount === 2 ? '2 Hands Active' : `1 Hand (${handedness})`}
                </span>
              </div>
              <h4 style={{ fontSize: '1.05rem', color: '#ffffff', marginBottom: '6px', fontWeight: 600 }}>
                {handsCount === 2 ? 'Both Hands Tracked in Frame' : 'Hand Visible in Camera'}
              </h4>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: '300px', margin: '0 auto' }}>
                {handsCount === 2
                  ? 'Perform a supported two-hand sign (Namaste, Book, House, Clap, or Help) to classify.'
                  : 'Hold a supported sign steady in the frame to classify.'}
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 10px', marginBottom: '20px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                <HelpCircle size={24} color="#94a3b8" />
              </div>
              <h4 style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                {isCameraActive ? 'Waiting for Hand in Camera' : 'Recognition Inactive'}
              </h4>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: '280px', margin: '0 auto' }}>
                {isCameraActive
                  ? 'Hold up your hand facing the camera to automatically identify gestures in English and Telugu.'
                  : 'Click Start Camera above to begin real-time recognition.'}
              </p>
            </div>
          )}

          {/* Confidence Score Bar */}
          {smoothed.smoothedConfidence !== null && (
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Confidence Score</span>
                <span style={{ fontWeight: 700, color: smoothed.smoothedConfidence >= threshold ? '#34d399' : '#f59e0b' }}>
                  {Math.round(smoothed.smoothedConfidence * 100)}%
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.round(smoothed.smoothedConfidence * 100)}%`,
                    height: '100%',
                    background: smoothed.smoothedConfidence >= threshold
                      ? 'linear-gradient(90deg, #10b981, #06b6d4)'
                      : 'linear-gradient(90deg, #f59e0b, #ef4444)',
                    borderRadius: '4px',
                    transition: 'width 0.2s ease'
                  }}
                />
              </div>
            </div>
          )}

          {/* Audio Speech Controls Group */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', marginBottom: '16px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => handleSpeakEnglish()}
              disabled={!smoothed.stableMeaning && !lastAcceptedGesture}
              style={{ padding: '9px 12px', fontSize: '0.8rem', justifyContent: 'center' }}
            >
              <Volume2 size={15} color="#818cf8" />
              <span>Speak English</span>
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => handleSpeakTelugu()}
              disabled={(!smoothed.stableTelugu && !lastAcceptedGesture?.telugu) && (!smoothed.stableTeluguRomanized && !lastAcceptedGesture?.telugu_romanized)}
              style={{ padding: '9px 12px', fontSize: '0.8rem', justifyContent: 'center' }}
            >
              <Volume2 size={15} color="#06b6d4" />
              <span>Speak తెలుగు</span>
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleStopSpeech}
              title="Stop current speech synthesis"
              style={{ padding: '9px 12px', fontSize: '0.8rem' }}
            >
              <Square size={14} color="#f43f5e" />
            </button>
          </div>

          {/* Last Recognized Gesture Strip */}
          {lastAcceptedGesture && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.06)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                fontSize: '0.82rem',
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={15} color="#34d399" />
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Last Recognized: </span>
                  <strong style={{ color: '#ffffff' }}>{lastAcceptedGesture.meaning}</strong>
                  {lastAcceptedGesture.telugu && (
                    <span style={{ color: '#38bdf8', marginLeft: '6px' }}>
                      ({lastAcceptedGesture.telugu})
                    </span>
                  )}
                </div>
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                {lastAcceptedGesture.timestamp}
              </span>
            </div>
          )}

          {/* Probabilities Breakdown Accordion */}
          {rawPrediction?.all_probabilities && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowProbabilities(!showProbabilities)}
                style={{ width: '100%', justifyContent: 'space-between', padding: '8px 12px', fontSize: '0.78rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BarChart2 size={14} color="#38bdf8" />
                  <span>Model Class Probabilities Breakdown</span>
                </div>
                {showProbabilities ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showProbabilities && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                  {Object.entries(rawPrediction.all_probabilities)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cls, prob]) => (
                      <div key={cls} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                        <span style={{ color: cls === rawPrediction.label ? '#ffffff' : 'var(--text-secondary)', fontWeight: cls === rawPrediction.label ? 700 : 400 }}>
                          {cls}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '60px', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.round(prob * 100)}%`, height: '100%', background: prob >= threshold ? '#10b981' : '#6366f1' }} />
                          </div>
                          <span style={{ color: prob >= threshold ? '#34d399' : 'var(--text-muted)', minWidth: '32px', textAlign: 'right' }}>
                            {Math.round(prob * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* =========================================================================
            SECTION: Smart Sentence Formation & Conversation Mode (Mode 1 & Mode 2)
            ========================================================================= */}
        <div className="glass-panel" style={{ padding: '22px' }}>
          {/* Header & Mode Indicators */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Languages size={20} color="#06b6d4" />
              <div>
                <h3 style={{ fontSize: '1.08rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  Smart Sentence Formation & Conversation
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Grammar-aware bridge for English, reviewed Telugu script, and Romanized Telugu
                </span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Active Mode Visual Badge */}
              {activeSentenceMode === 'camera_recognition' ? (
                <span
                  className="badge badge-primary"
                  style={{
                    fontSize: '0.72rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: 'rgba(99, 102, 241, 0.2)',
                    border: '1px solid #6366f1',
                    color: '#a5b4fc',
                    fontWeight: 600
                  }}
                  title="Sentences generated from active camera sign recognition"
                >
                  <Camera size={12} />
                  <span>Mode 1: Live Sign Recognition</span>
                </span>
              ) : (
                <span
                  className="badge"
                  style={{
                    fontSize: '0.72rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: 'rgba(245, 158, 11, 0.2)',
                    border: '1px solid #f59e0b',
                    color: '#fcd34d',
                    fontWeight: 600
                  }}
                  title="Sentence selected manually from verified quick phrase library"
                >
                  <MessageSquare size={12} />
                  <span>Mode 2: Quick Phrase Selection</span>
                </span>
              )}

              {/* Confirmation Status Badge */}
              <span className={`badge ${isSentenceConfirmed ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {isSentenceConfirmed ? <CheckCircle2 size={12} /> : null}
                <span>{isSentenceConfirmed ? 'Confirmed Sentence' : 'Editable Draft'}</span>
              </span>
            </div>
          </div>

          {/* Emergency / Health Distinction Alert */}
          {activeSentenceMode === 'quick_phrase' && selectedQuickPhrase?.is_emergency && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              fontSize: '0.78rem',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <HeartPulse size={16} color="#f87171" />
              <span>
                <strong>Emergency / Medical Statement:</strong> Confirmed manually selected phrase. SignBridge AI never infers medical emergencies from uncertain camera gestures.
              </span>
            </div>
          )}

          {/* Mode 1: Real-Time Recognized Sign Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '10px',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#a5b4fc', fontWeight: 600 }}>
                Live Stabilized Sign:
              </span>
              {lastAcceptedGesture?.label ? (
                <span className="badge badge-primary" style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  {lastAcceptedGesture.label} ({lastAcceptedGesture.meaning})
                </span>
              ) : (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No sign confirmed yet — present a hand gesture to camera
                </span>
              )}
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => handleAddTokenToSentence()}
              disabled={!lastAcceptedGesture?.label && !smoothed.stableLabel}
              style={{ padding: '5px 12px', fontSize: '0.74rem' }}
              title="Append currently recognized sign to draft"
            >
              <Plus size={13} />
              <span>+ Add Sign to Sentence</span>
            </button>
          </div>

          {/* Original Recognized Signs Sequence Chips */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Recognized Sign Sequence ({sentenceTokens.length} tokens)
                </span>
                {sentenceTranslation?.sentence_intent && (
                  <span
                    className="badge badge-neutral"
                    style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#67e8f9', border: '1px solid rgba(6, 182, 212, 0.4)' }}
                  >
                    Intent: {sentenceTranslation.sentence_intent} {sentenceTranslation.punctuation}
                  </span>
                )}
              </div>

              {/* Auto-Add with Repetition & Repositioning Pause */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoDeduplicateAdd}
                    onChange={(e) => setAutoDeduplicateAdd(e.target.checked)}
                    style={{ accentColor: '#6366f1' }}
                  />
                  <span>Auto-add newly held signs</span>
                </label>

                {autoDeduplicateAdd && (
                  <button
                    onClick={() => setIsAutoAddPaused(!isAutoAddPaused)}
                    className="btn btn-secondary"
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.68rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: isAutoAddPaused ? '#fbbf24' : '#34d399'
                    }}
                    title="Pause auto-adding while repositioning hands"
                  >
                    {isAutoAddPaused ? <Play size={10} /> : <Pause size={10} />}
                    <span>{isAutoAddPaused ? 'Resume Auto-Add' : 'Pause for Hands'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Chips Container with Clickable Remove Buttons */}
            <div style={{
              minHeight: '44px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '6px'
            }}>
              {sentenceTokens.length === 0 ? (
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Sequence is empty. Hold signs steady in front of camera or select a Quick Phrase below.
                </span>
              ) : (
                sentenceTokens.map((token, idx) => (
                  <span
                    key={idx}
                    className="badge badge-primary"
                    style={{
                      fontSize: '0.74rem',
                      padding: '4px 8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(99, 102, 241, 0.25)',
                      border: '1px solid rgba(99, 102, 241, 0.6)'
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{token}</span>
                    <span style={{ opacity: 0.6, fontSize: '0.62rem' }}>#{idx + 1}</span>
                    <button
                      onClick={() => handleRemoveToken(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f87171',
                        cursor: 'pointer',
                        padding: '0 2px',
                        display: 'flex',
                        alignItems: 'center',
                        lineHeight: 1
                      }}
                      title={`Remove ${token} from draft`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Disambiguation Alternative Chips */}
            {sentenceTranslation?.disambiguation_options && sentenceTranslation.disambiguation_options.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: '#fcd34d', fontWeight: 600 }}>Did you mean:</span>
                {sentenceTranslation.disambiguation_options.map((opt, optIdx) => (
                  <button
                    key={optIdx}
                    className="btn btn-secondary"
                    onClick={() => {
                      setSentenceDraft(opt.english);
                      setSentenceTranslation((prev) => prev ? {
                        ...prev,
                        english: opt.english,
                        telugu: opt.telugu,
                        telugu_romanized: opt.telugu_romanized
                      } : null);
                    }}
                    style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                  >
                    <strong>{opt.label}:</strong> {opt.english}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Editable Sentence Draft Textarea */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label htmlFor="sentence-draft-input" style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                Sentence Draft (Review and edit before confirming)
              </label>
              <span style={{ fontSize: '0.7rem', color: isSentenceConfirmed ? '#34d399' : '#fbbf24' }}>
                {isSentenceConfirmed ? '✓ Confirmed and Ready' : '✎ Direct editing enabled'}
              </span>
            </div>
            
            <textarea
              id="sentence-draft-input"
              value={sentenceDraft}
              onChange={(e) => {
                setSentenceDraft(e.target.value);
                setIsSentenceConfirmed(false);
              }}
              placeholder="Your sentence draft will appear here. You can also edit words or add punctuation directly..."
              rows={2}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: isSentenceConfirmed ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
                boxShadow: isSentenceConfirmed ? '0 0 12px rgba(16, 185, 129, 0.15)' : 'none'
              }}
            />
          </div>

          {/* Output Language Selector Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Globe size={14} color="#a5b4fc" />
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Output Language:</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['all', 'en', 'te', 'ro'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setSentenceOutputLang(lang)}
                    className={`btn ${sentenceOutputLang === lang ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '3px 8px', fontSize: '0.7rem', textTransform: 'uppercase' }}
                  >
                    {lang === 'all' ? 'All Languages' : lang === 'te' ? 'తెలుగు' : lang}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons: Undo, Clear, Confirm, Speak, Copy */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {/* Undo Last Word */}
            <button
              className="btn btn-secondary"
              onClick={handleUndoLastWord}
              disabled={sentenceTokens.length === 0}
              style={{ padding: '7px 12px', fontSize: '0.78rem' }}
              title="Undo the last sign added to the draft"
            >
              <Undo2 size={14} />
              <span>Undo Last Sign</span>
            </button>

            {/* Clear Draft */}
            <button
              className="btn btn-secondary"
              onClick={handleClearSentence}
              disabled={sentenceTokens.length === 0 && !sentenceDraft}
              style={{ padding: '7px 12px', fontSize: '0.78rem', color: '#f87171' }}
              title="Clear current draft"
            >
              <Trash2 size={14} />
              <span>Clear Draft</span>
            </button>

            {/* Confirm Sentence */}
            <button
              className={`btn ${isSentenceConfirmed ? 'btn-secondary' : 'btn-primary'}`}
              onClick={handleConfirmSentence}
              disabled={(!sentenceDraft.trim() && sentenceTokens.length === 0) || isSavingSentence || isSentenceConfirmed}
              style={{
                padding: '7px 16px',
                fontSize: '0.78rem',
                background: isSentenceConfirmed ? 'rgba(16, 185, 129, 0.2)' : undefined,
                border: isSentenceConfirmed ? '1px solid rgba(16, 185, 129, 0.6)' : undefined,
                color: isSentenceConfirmed ? '#34d399' : undefined,
                cursor: isSentenceConfirmed ? 'default' : 'pointer'
              }}
              title={isSentenceConfirmed ? "Sentence confirmed and saved to history" : "Confirm and persist sentence to database"}
            >
              <CheckCircle2 size={14} />
              <span>{isSavingSentence ? 'Saving...' : isSentenceConfirmed ? 'Confirmed ✓' : 'Confirm Sentence'}</span>
            </button>

            {/* Speak */}
            <button
              className="btn btn-secondary"
              onClick={() => {
                const textToSpeak = sentenceOutputLang === 'te' && sentenceTranslation?.telugu
                  ? sentenceTranslation.telugu
                  : (sentenceDraft || sentenceTokens.join(' '));
                ttsService.speak(textToSpeak, sentenceOutputLang === 'te' ? 'te' : 'en');
              }}
              disabled={!sentenceDraft && sentenceTokens.length === 0}
              style={{ padding: '7px 12px', fontSize: '0.78rem' }}
              title="Read sentence aloud using Text-to-Speech"
            >
              <Volume2 size={14} color="#06b6d4" />
              <span>Speak</span>
            </button>

            {/* Copy */}
            <button
              className="btn btn-secondary"
              onClick={handleCopySentence}
              disabled={!sentenceDraft && sentenceTokens.length === 0}
              style={{ padding: '7px 12px', fontSize: '0.78rem' }}
              title="Copy sentence to clipboard"
            >
              {copiedSentence ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              <span>{copiedSentence ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          {/* Feedback Banner */}
          {sentenceSaveMessage && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: isSentenceConfirmed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: isSentenceConfirmed ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
              color: isSentenceConfirmed ? '#34d399' : '#f87171',
              fontSize: '0.78rem',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <CheckCircle2 size={14} />
              <span>{sentenceSaveMessage}</span>
            </div>
          )}

          {/* Multilingual Translation Outputs Display */}
          {sentenceTranslation && (
            <div style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'rgba(6, 182, 212, 0.05)',
              border: '1px solid rgba(6, 182, 212, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '16px'
            }}>
              {(sentenceOutputLang === 'all' || sentenceOutputLang === 'te') && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#67e8f9', fontWeight: 600, marginBottom: '2px' }}>
                    తెలుగు (Reviewed Telugu Script)
                  </div>
                  <div style={{
                    fontSize: '1.35rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    fontFamily: '"Anek Telugu", "Noto Sans Telugu", sans-serif',
                    lineHeight: 1.4
                  }}>
                    {sentenceTranslation.telugu || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.95rem' }}>Translation unavailable</span>}
                  </div>
                </div>
              )}

              {(sentenceOutputLang === 'all' || sentenceOutputLang === 'en') && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#a5b4fc', fontWeight: 600, marginBottom: '2px' }}>
                    English Translation
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#e0e7ff', lineHeight: 1.4 }}>
                    {sentenceTranslation.english || '—'}
                  </div>
                </div>
              )}

              {(sentenceOutputLang === 'all' || sentenceOutputLang === 'ro') && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '2px' }}>
                    Romanized Telugu (Phonetic)
                  </div>
                  <div style={{ fontSize: '0.88rem', color: '#c7d2fe', fontStyle: 'italic' }}>
                    {sentenceTranslation.telugu_romanized ? `"${sentenceTranslation.telugu_romanized}"` : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </div>
                </div>
              )}

              {/* Lexical Meaning Breakdown (when composite tokens exist) */}
              {sentenceTranslation.meaning_breakdown && sentenceTranslation.meaning_breakdown.length > 1 && (
                <div style={{ borderTop: '1px dashed rgba(6, 182, 212, 0.2)', paddingTop: '10px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Sign-by-Sign Meaning Breakdown:
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {sentenceTranslation.meaning_breakdown.map((item, bIdx) => (
                      <span
                        key={bIdx}
                        className="badge badge-neutral"
                        style={{ fontSize: '0.68rem', padding: '3px 8px' }}
                      >
                        <strong>{item.token}:</strong> {item.english} ({item.telugu})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              MODE 2: Searchable Quick Phrase Assistance Library (Categories A-H)
              ========================================================================= */}
          <div id="quick-phrase-library-section" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={16} color="#f59e0b" />
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  Mode 2 — Quick Phrase Assistance Library
                </h4>
              </div>

              <button
                className="btn btn-secondary"
                onClick={() => setShowQuickPhraseLibrary(!showQuickPhraseLibrary)}
                style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <BookOpen size={13} color="#f59e0b" />
                <span>{showQuickPhraseLibrary ? 'Hide Library' : 'Browse 63 Common Phrases (A-H)'}</span>
                {showQuickPhraseLibrary ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.4 }}>
              Instantly pick from reviewed phrases for greetings, questions, basic needs, directions, education, and emergencies when you need to communicate quickly.
            </p>

            {showQuickPhraseLibrary && (
              <div style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '14px',
                marginTop: '10px'
              }}>
                {/* Search & Category Filter Pills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      value={phraseSearchQuery}
                      onChange={(e) => setPhraseSearchQuery(e.target.value)}
                      placeholder="Search phrases in English or Telugu (e.g. water, help, bus stop, ఎలా ఉన్నారు)..."
                      style={{
                        width: '100%',
                        padding: '8px 12px 8px 32px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-subtle)',
                        color: '#ffffff',
                        fontSize: '0.8rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Category Pills */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setSelectedPhraseCategory('all')}
                      className={`btn ${selectedPhraseCategory === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '4px 9px', fontSize: '0.7rem' }}
                    >
                      All (63)
                    </button>
                    {quickPhraseCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedPhraseCategory(cat.id)}
                        className={`btn ${selectedPhraseCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '4px 9px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.name} ({cat.count})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Phrase Cards Grid */}
                {isLoadingPhrases ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    Loading reviewed phrases...
                  </div>
                ) : quickPhrases.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    No phrases found matching "{phraseSearchQuery}".
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '10px',
                    maxHeight: '340px',
                    overflowY: 'auto',
                    paddingRight: '4px'
                  }}>
                    {quickPhrases.map((phrase) => (
                      <div
                        key={phrase.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: phrase.is_emergency ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                          border: phrase.is_emergency ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '6px'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: phrase.is_emergency ? '#f87171' : '#38bdf8', fontWeight: 600 }}>
                              {phrase.is_emergency ? '🚨 Emergency' : phrase.category}
                            </span>
                            <span className="badge badge-neutral" style={{ fontSize: '0.62rem' }}>Verified</span>
                          </div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff', marginBottom: '2px' }}>
                            {phrase.english}
                          </div>
                          <div style={{ fontSize: '0.84rem', color: '#67e8f9', fontFamily: '"Anek Telugu", "Noto Sans Telugu", sans-serif' }}>
                            {phrase.telugu}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#c7d2fe', fontStyle: 'italic' }}>
                            "{phrase.telugu_romanized}"
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleSelectQuickPhrase(phrase)}
                            style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Select phrase to communicate immediately"
                          >
                            <MessageSquare size={12} color="#f59e0b" />
                            <span>Select Phrase</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Technical Transparency Notice */}
          <div style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            lineHeight: 1.4,
            padding: '8px 12px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '6px',
            borderLeft: '3px solid #6366f1',
            marginTop: '16px'
          }}>
            <strong>Notice on ISL Sentence Recognition:</strong> SignBridge AI generates sentences either from genuinely recognized signs (Mode 1) or confirmed manual phrase selection (Mode 2). Unsupported signs are presented with transparent uncertainty rather than fabricated translations.
          </div>
        </div>

        {/* Recent Predictions List */}
        {historyTrail.length > 0 && (
          <div className="glass-panel" style={{ padding: '18px' }}>
            <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '10px' }}>
              Recent Predictions Trail
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {historyTrail.map((item, idx) => (
                <span
                  key={idx}
                  className="badge badge-neutral"
                  style={{
                    fontSize: '0.78rem',
                    padding: '6px 12px',
                    background: idx === 0 ? 'rgba(99, 102, 241, 0.2)' : undefined,
                    border: idx === 0 ? '1px solid rgba(99, 102, 241, 0.5)' : undefined
                  }}
                >
                  <strong style={{ color: '#ffffff' }}>{item.meaning}</strong>
                  {item.telugu && (
                    <span style={{ color: '#38bdf8', marginLeft: '5px' }}>({item.telugu})</span>
                  )}
                  {item.confidence && (
                    <span style={{ color: '#34d399', marginLeft: '6px', fontSize: '0.7rem' }}>
                      {Math.round(item.confidence * 100)}%
                    </span>
                  )}
                  <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '0.7rem' }}>
                    {item.time}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Vocabulary Cheat Sheet & Translation Guide */}
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Languages size={16} color="#818cf8" />
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                Configured Multilingual Vocabulary
              </span>
            </div>
            <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
              {filteredVocabulary.length} Gestures
            </span>
          </div>

          {/* Search & Filter Toolbar */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={vocabSearch}
                onChange={(e) => setVocabSearch(e.target.value)}
                placeholder="Search English or Telugu..."
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border-subtle)',
                  color: '#ffffff',
                  fontSize: '0.76rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              {(['all', 'verified_isl', 'static', 'dynamic'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setVocabTypeFilter(filter)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.7rem',
                    borderRadius: '5px',
                    border: 'none',
                    background: vocabTypeFilter === filter ? '#6366f1' : 'rgba(255,255,255,0.04)',
                    color: vocabTypeFilter === filter ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {filter === 'all' && 'All'}
                  {filter === 'verified_isl' && 'ISL Only'}
                  {filter === 'static' && 'Static'}
                  {filter === 'dynamic' && 'Dynamic'}
                </button>
              ))}
            </div>
          </div>

          {/* Vocabulary Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
            {filteredVocabulary.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.75rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ color: '#ffffff' }}>{entry.name}</strong>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>{entry.telugu}</span>
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.7rem' }}>
                      ({entry.telugu_romanized})
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginTop: '2px' }}>
                    ID: {entry.id} • {entry.gesture_type} • {entry.sample_count || 0} samples
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    className={`badge ${
                      entry.readiness === 'active_trained'
                        ? 'badge-success'
                        : entry.readiness === 'pretrained_supported'
                        ? 'badge-primary'
                        : entry.readiness === 'ready_to_train'
                        ? 'badge-warning'
                        : 'badge-neutral'
                    }`}
                    style={{ fontSize: '0.65rem' }}
                  >
                    {entry.readiness === 'active_trained' && 'Active Trained'}
                    {entry.readiness === 'pretrained_supported' && 'Pretrained'}
                    {entry.readiness === 'ready_to_train' && 'Ready to Train'}
                    {entry.readiness === 'needs_data' && 'Needs Data'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
