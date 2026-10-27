/**
 * SignBridge AI - Temporal Prediction Smoothing
 * Implements a sliding window consensus filter to eliminate per-frame flickering
 * and ensure stable, readable real-time hand gesture recognition.
 */

import type { PredictionResult } from '../types';

export interface SmoothedPrediction {
  stableLabel: string | null;
  stableMeaning: string | null;
  stableTelugu?: string | null;
  stableTeluguRomanized?: string | null;
  smoothedConfidence: number | null;
  status: 'accepted' | 'uncertain_rejected' | 'no_hand' | 'model_unavailable' | 'waiting';
  is_verified_isl: boolean;
  gesture_type?: 'static' | 'dynamic' | 'verified_isl' | 'two_hand_isl' | 'general_gesture';
  hands_detected?: number;
  model_version?: string;
  isStable: boolean;
  agreementRatio: number;
  allProbabilities: Record<string, number> | null;
}

export class TemporalPredictionSmoother {
  private windowSize: number;
  private minAgreementRatio: number;
  private buffer: PredictionResult[] = [];
  private lastStableLabel: string | null = null;
  private lastStableMeaning: string | null = null;
  private lastStableTelugu: string | null = null;
  private lastStableTeluguRomanized: string | null = null;
  private lastStableConfidence: number | null = null;
  private lastStableVerified: boolean = false;
  private lastStableGestureType: 'static' | 'dynamic' | 'verified_isl' | 'two_hand_isl' | 'general_gesture' = 'static';
  private lastStableVersion: string = 'v1.0.0';

  constructor(windowSize = 5, minAgreementRatio = 0.6) {
    this.windowSize = windowSize;
    this.minAgreementRatio = minAgreementRatio;
  }

  /**
   * Resets all sliding window state and stable labels.
   */
  reset() {
    this.buffer = [];
    this.lastStableLabel = null;
    this.lastStableMeaning = null;
    this.lastStableTelugu = null;
    this.lastStableTeluguRomanized = null;
    this.lastStableConfidence = null;
    this.lastStableVerified = false;
    this.lastStableGestureType = 'static';
  }

  /**
   * Pushes a new raw per-frame prediction into the temporal buffer
   * and computes the consensus smoothed prediction.
   */
  push(raw: PredictionResult): SmoothedPrediction {
    // If no hand detected, immediately clear buffer or mark waiting
    if (raw.status === 'no_hand') {
      this.buffer = [];
      return {
        stableLabel: null,
        stableMeaning: 'Waiting for hand in frame...',
        smoothedConfidence: null,
        status: 'no_hand',
        is_verified_isl: false,
        isStable: false,
        agreementRatio: 0,
        allProbabilities: null
      };
    }

    if (raw.status === 'model_unavailable') {
      this.buffer = [];
      return {
        stableLabel: null,
        stableMeaning: 'Recognition model unavailable',
        smoothedConfidence: null,
        status: 'model_unavailable',
        is_verified_isl: false,
        isStable: false,
        agreementRatio: 0,
        allProbabilities: null
      };
    }

    // Add to sliding window
    this.buffer.push(raw);
    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }

    // Tally accepted labels in current window
    const labelCounts: Record<string, {
      count: number;
      meaning: string;
      telugu?: string | null;
      telugu_romanized?: string | null;
      gesture_type?: 'static' | 'dynamic' | 'verified_isl' | 'two_hand_isl' | 'general_gesture';
      model_version?: string;
      totalConf: number;
      isVerified: boolean;
    }> = {};
    let acceptedSamples = 0;
    let uncertainSamples = 0;

    for (const sample of this.buffer) {
      if (sample.status === 'accepted' && sample.label && sample.english_meaning) {
        acceptedSamples++;
        const key = sample.label;
        if (!labelCounts[key]) {
          labelCounts[key] = {
            count: 0,
            meaning: sample.english_meaning,
            telugu: sample.telugu,
            telugu_romanized: sample.telugu_romanized,
            gesture_type: sample.gesture_type || 'static',
            model_version: sample.model_version || 'v1.0.0',
            totalConf: 0,
            isVerified: sample.is_verified_isl
          };
        }
        labelCounts[key].count++;
        labelCounts[key].totalConf += sample.confidence ?? 0;
      } else if (sample.status === 'uncertain_rejected') {
        uncertainSamples++;
      }
    }

    // Find majority candidate
    let bestLabel: string | null = null;
    let bestCount = 0;
    let bestMeaning: string | null = null;
    let bestTelugu: string | null = null;
    let bestTeluguRomanized: string | null = null;
    let bestGestureType: 'static' | 'dynamic' | 'verified_isl' | 'two_hand_isl' | 'general_gesture' = 'static';
    let bestVersion: string = 'v1.0.0';
    let bestAvgConf = 0;
    let bestVerified = false;

    for (const [lbl, info] of Object.entries(labelCounts)) {
      if (info.count > bestCount) {
        bestCount = info.count;
        bestLabel = lbl;
        bestMeaning = info.meaning;
        bestTelugu = info.telugu ?? null;
        bestTeluguRomanized = info.telugu_romanized ?? null;
        bestGestureType = info.gesture_type || 'static';
        bestVersion = info.model_version || 'v1.0.0';
        bestAvgConf = info.totalConf / info.count;
        bestVerified = info.isVerified;
      }
    }

    const agreementRatio = this.buffer.length > 0 ? bestCount / this.buffer.length : 0;

    // Check consensus criteria
    if (bestLabel && agreementRatio >= this.minAgreementRatio) {
      this.lastStableLabel = bestLabel;
      this.lastStableMeaning = bestMeaning;
      this.lastStableTelugu = bestTelugu;
      this.lastStableTeluguRomanized = bestTeluguRomanized;
      this.lastStableGestureType = bestGestureType;
      this.lastStableVersion = bestVersion;
      this.lastStableConfidence = Number(bestAvgConf.toFixed(3));
      this.lastStableVerified = bestVerified;

      return {
        stableLabel: this.lastStableLabel,
        stableMeaning: this.lastStableMeaning,
        stableTelugu: this.lastStableTelugu,
        stableTeluguRomanized: this.lastStableTeluguRomanized,
        smoothedConfidence: this.lastStableConfidence,
        status: 'accepted',
        is_verified_isl: this.lastStableVerified,
        gesture_type: this.lastStableGestureType,
        model_version: this.lastStableVersion,
        isStable: true,
        agreementRatio: Number(agreementRatio.toFixed(2)),
        allProbabilities: raw.all_probabilities
      };
    }

    // If most samples in window were uncertain_rejected
    if (uncertainSamples >= Math.ceil(this.buffer.length / 2)) {
      return {
        stableLabel: null,
        stableMeaning: 'Uncertain gesture / transitioning',
        stableTelugu: 'అనిశ్చిత సంజ్ఞ',
        stableTeluguRomanized: 'Anischitha samjna',
        smoothedConfidence: raw.confidence,
        status: 'uncertain_rejected',
        is_verified_isl: false,
        gesture_type: raw.gesture_type || 'static',
        model_version: raw.model_version || 'v1.0.0',
        isStable: false,
        agreementRatio: 0,
        allProbabilities: raw.all_probabilities
      };
    }

    // Retain previous stable sign if recent, otherwise indicate analyzing
    if (this.lastStableLabel && this.buffer.length < this.windowSize) {
      return {
        stableLabel: this.lastStableLabel,
        stableMeaning: this.lastStableMeaning,
        stableTelugu: this.lastStableTelugu,
        stableTeluguRomanized: this.lastStableTeluguRomanized,
        smoothedConfidence: this.lastStableConfidence,
        status: 'accepted',
        is_verified_isl: this.lastStableVerified,
        gesture_type: this.lastStableGestureType,
        model_version: this.lastStableVersion,
        isStable: false,
        agreementRatio: Number(agreementRatio.toFixed(2)),
        allProbabilities: raw.all_probabilities
      };
    }

    return {
      stableLabel: null,
      stableMeaning: 'Analyzing hand shape...',
      stableTelugu: 'చేతి ఆకారాన్ని విశ్లేషిస్తోంది...',
      stableTeluguRomanized: 'Chethi aakaaraanni vishleshisthondi...',
      smoothedConfidence: null,
      status: 'waiting',
      is_verified_isl: false,
      isStable: false,
      agreementRatio: Number(agreementRatio.toFixed(2)),
      allProbabilities: raw.all_probabilities
    };
  }
}
