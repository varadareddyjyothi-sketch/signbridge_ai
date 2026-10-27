/**
 * SignBridge AI - Speech Services (TTS & STT)
 * Browser Web SpeechSynthesis and SpeechRecognition APIs.
 */

// ==========================================
// 1. Text-to-Speech (TTS)
// ==========================================

export class TextToSpeechService {
  private synth: SpeechSynthesis | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  isSupported(): boolean {
    return this.synth !== null;
  }

  getVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  hasTeluguVoice(): boolean {
    const voices = this.getVoices();
    return voices.some(v => v.lang.startsWith('te') || v.name.toLowerCase().includes('telugu'));
  }

  speak(
    text: string,
    lang: 'en' | 'te' = 'en',
    romanizedFallback?: string,
    rate = 1.0,
    pitch = 1.0
  ): Promise<{ spoken: boolean; method: 'native_telugu' | 'romanized_fallback' | 'english' }> {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        return resolve({ spoken: false, method: 'english' });
      }

      this.synth.cancel();

      const voices = this.getVoices();
      let textToSpeak = text;
      let targetLang = 'en-US';
      let selectedVoice: SpeechSynthesisVoice | undefined;
      let method: 'native_telugu' | 'romanized_fallback' | 'english' = 'english';

      if (lang === 'te') {
        const teluguVoice = voices.find(v => v.lang.startsWith('te') || v.name.toLowerCase().includes('telugu'));
        if (teluguVoice) {
          selectedVoice = teluguVoice;
          targetLang = 'te-IN';
          method = 'native_telugu';
        } else {
          // Telugu voice not installed on device/browser -> fall back to Romanized pronunciation with Indian English voice
          textToSpeak = romanizedFallback || text;
          selectedVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en_IN')) ||
                          voices.find(v => v.lang.startsWith('en'));
          targetLang = 'en-IN';
          method = 'romanized_fallback';
        }
      } else {
        selectedVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.default));
        targetLang = 'en-US';
        method = 'english';
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.lang = targetLang;
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onend = () => resolve({ spoken: true, method });
      utterance.onerror = (e) => reject(e);

      this.synth.speak(utterance);
    });
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
    }
  }
}

export const ttsService = new TextToSpeechService();

// ==========================================
// 2. Speech-to-Text (STT) for Hearing User -> ISL User
// ==========================================

export interface SpeechRecognitionListener {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onStateChange: (isListening: boolean) => void;
}

export class SpeechToTextService {
  private recognition: any = null;
  private isListening = false;
  private listener: SpeechRecognitionListener | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
          this.isListening = true;
          this.listener?.onStateChange(true);
        };

        this.recognition.onend = () => {
          this.isListening = false;
          this.listener?.onStateChange(false);
        };

        this.recognition.onerror = (event: any) => {
          this.listener?.onError(event.error || 'Speech recognition error');
        };

        this.recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          const combined = (finalTranscript + ' ' + interimTranscript).trim();
          if (combined) {
            this.listener?.onResult(combined, finalTranscript.length > 0);
          }
        };
      }
    }
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }

  startListening(listener: SpeechRecognitionListener) {
    if (!this.recognition) {
      listener.onError('Speech recognition is not supported in this browser.');
      return;
    }
    this.listener = listener;
    try {
      this.recognition.start();
    } catch (e) {
      // Already active
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }
}

export const sttService = new SpeechToTextService();
