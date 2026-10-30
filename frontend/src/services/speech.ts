/**
 * SignBridge AI - Advanced Multilingual Speech Services (TTS & STT)
 * Browser Web SpeechSynthesis and SpeechRecognition APIs with language awareness,
 * permission auditing, clean lifecycle management, and phonetic fallbacks.
 */

export type SupportedLanguageCode = 'en' | 'te' | 'hi' | 'te-ro';

export type MicrophonePermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported';

export interface SpeechRecognitionListener {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string, code?: string) => void;
  onStateChange: (isListening: boolean) => void;
}

export interface StartListeningOptions {
  lang?: SupportedLanguageCode | string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string, code?: string) => void;
  onStateChange: (isListening: boolean) => void;
}

// =========================================================================
// 1. Text-to-Speech (TTS)
// =========================================================================

export class TextToSpeechService {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  isSupported(): boolean {
    return this.synth !== null;
  }

  isSpeaking(): boolean {
    return this.currentUtterance !== null || (this.synth?.speaking ?? false);
  }

  getVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  hasTeluguVoice(): boolean {
    const voices = this.getVoices();
    return voices.some(v => v.lang.startsWith('te') || v.name.toLowerCase().includes('telugu'));
  }

  hasHindiVoice(): boolean {
    const voices = this.getVoices();
    return voices.some(v => v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi'));
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.currentUtterance = null;
    }
  }

  speak(
    text: string,
    lang: SupportedLanguageCode = 'en',
    romanizedFallback?: string,
    rate = 1.0,
    pitch = 1.0
  ): Promise<{ spoken: boolean; method: 'native_telugu' | 'romanized_fallback' | 'native_hindi' | 'english' }> {
    return new Promise((resolve, reject) => {
      if (!this.synth || !text.trim()) {
        return resolve({ spoken: false, method: 'english' });
      }

      // Stop any existing speech output to prevent overlapping audio
      this.stop();

      const voices = this.getVoices();
      let textToSpeak = text;
      let targetLang = 'en-US';
      let selectedVoice: SpeechSynthesisVoice | undefined;
      let method: 'native_telugu' | 'romanized_fallback' | 'native_hindi' | 'english' = 'english';

      if (lang === 'te') {
        const teluguVoice = voices.find(v => v.lang.startsWith('te') || v.name.toLowerCase().includes('telugu'));
        if (teluguVoice) {
          selectedVoice = teluguVoice;
          targetLang = 'te-IN';
          method = 'native_telugu';
        } else {
          // Native Telugu voice not installed on client browser -> use phonetic Romanized fallback with Indian English voice
          textToSpeak = romanizedFallback || text;
          selectedVoice =
            voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en_IN')) ||
            voices.find(v => v.lang.startsWith('en'));
          targetLang = 'en-IN';
          method = 'romanized_fallback';
        }
      } else if (lang === 'hi') {
        const hindiVoice = voices.find(v => v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi'));
        if (hindiVoice) {
          selectedVoice = hindiVoice;
          targetLang = 'hi-IN';
          method = 'native_hindi';
        } else {
          selectedVoice =
            voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en_IN')) ||
            voices.find(v => v.lang.startsWith('en'));
          targetLang = 'en-IN';
          method = 'english';
        }
      } else if (lang === 'te-ro') {
        textToSpeak = romanizedFallback || text;
        selectedVoice =
          voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en_IN')) ||
          voices.find(v => v.lang.startsWith('en'));
        targetLang = 'en-IN';
        method = 'romanized_fallback';
      } else {
        selectedVoice =
          voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en_IN')) ||
          voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.default));
        targetLang = 'en-IN';
        method = 'english';
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.lang = targetLang;
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      this.currentUtterance = utterance;

      utterance.onend = () => {
        this.currentUtterance = null;
        resolve({ spoken: true, method });
      };

      utterance.onerror = (e) => {
        this.currentUtterance = null;
        if (e.error === 'canceled' || e.error === 'interrupted') {
          resolve({ spoken: false, method });
        } else {
          reject(e);
        }
      };

      this.synth.speak(utterance);
    });
  }
}

export const ttsService = new TextToSpeechService();

// =========================================================================
// 2. Click-to-Activate Speech-to-Text (STT)
// =========================================================================

export class SpeechToTextService {
  private recognition: any = null;
  private isListening = false;
  private currentListener: SpeechRecognitionListener | null = null;
  private activeLanguageCode = 'en-IN';
  private permissionState: MicrophonePermissionState = 'prompt';

  constructor() {
    this.initRecognition();
    this.checkInitialPermission();
  }

  private initRecognition() {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionConstructor =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognitionConstructor) {
        this.recognition = new SpeechRecognitionConstructor();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
        this.recognition.lang = this.activeLanguageCode;

        this.recognition.onstart = () => {
          this.isListening = true;
          this.permissionState = 'granted';
          this.currentListener?.onStateChange(true);
        };

        this.recognition.onend = () => {
          this.isListening = false;
          this.currentListener?.onStateChange(false);
        };

        this.recognition.onerror = (event: any) => {
          const errCode = event.error || 'unknown';
          let humanMessage = 'Speech recognition encountered an issue.';

          if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
            this.permissionState = 'denied';
            humanMessage = 'Microphone permission was denied. Please click the lock or camera icon in your address bar to allow microphone access.';
          } else if (errCode === 'no-speech') {
            humanMessage = 'No speech detected. Please speak clearly into your microphone.';
          } else if (errCode === 'audio-capture') {
            humanMessage = 'No microphone device was detected. Please check your audio hardware.';
          } else if (errCode === 'network') {
            humanMessage = 'Network connection interrupted speech recognition. Please verify your connection.';
          } else if (errCode === 'aborted') {
            humanMessage = 'Voice recognition was stopped.';
          }

          this.currentListener?.onError(humanMessage, errCode);
        };

        this.recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          const combined = (finalTranscript + ' ' + interimTranscript).trim();
          if (combined && this.currentListener) {
            this.currentListener.onResult(combined, finalTranscript.trim().length > 0);
          }
        };
      }
    }
  }

  private async checkInitialPermission() {
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' as any });
        this.permissionState = status.state as MicrophonePermissionState;
        status.onchange = () => {
          this.permissionState = status.state as MicrophonePermissionState;
        };
      } catch {
        this.permissionState = 'prompt';
      }
    } else {
      this.permissionState = 'prompt';
    }
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }

  getPermissionState(): MicrophonePermissionState {
    return this.permissionState;
  }

  mapLanguageToLocale(lang: SupportedLanguageCode | string): string {
    const l = (lang || '').toLowerCase();
    if (l === 'te' || l === 'telugu' || l === 'te-in') return 'te-IN';
    if (l === 'hi' || l === 'hindi' || l === 'hi-in') return 'hi-IN';
    if (l === 'en-us') return 'en-US';
    return 'en-IN'; // Indian English default for SignBridge ISL
  }

  startListening(options: StartListeningOptions | SpeechRecognitionListener, lang?: string) {
    if (!this.recognition) {
      const listener = 'onResult' in options ? options : null;
      listener?.onError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    // Stop any existing active listening session cleanly
    this.stopListening();

    let listener: SpeechRecognitionListener;
    let targetLang = this.activeLanguageCode;

    if ('continuous' in options || 'onResult' in options) {
      const opts = options as StartListeningOptions;
      listener = {
        onResult: opts.onResult,
        onError: opts.onError,
        onStateChange: opts.onStateChange
      };
      if (opts.lang) {
        targetLang = this.mapLanguageToLocale(opts.lang);
      }
    } else {
      listener = options as SpeechRecognitionListener;
      if (lang) {
        targetLang = this.mapLanguageToLocale(lang);
      }
    }

    this.currentListener = listener;
    this.activeLanguageCode = targetLang;
    this.recognition.lang = targetLang;

    try {
      this.recognition.start();
    } catch (err: any) {
      if (err.name !== 'InvalidStateError') {
        listener.onError(`Could not start microphone: ${err.message || 'Unknown error'}`);
      }
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignored
      }
      this.isListening = false;
    }
  }

  abortListening() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Ignored
      }
      this.isListening = false;
    }
  }
}

export const sttService = new SpeechToTextService();
