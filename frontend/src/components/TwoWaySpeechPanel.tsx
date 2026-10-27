import React, { useState } from 'react';
import { Mic, MicOff, MessageSquare, Trash2, AlertCircle } from 'lucide-react';
import { sttService } from '../services/speech';

export const TwoWaySpeechPanel: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSupported = sttService.isSupported();

  const handleToggleListening = () => {
    setErrorMessage(null);
    if (isListening) {
      sttService.stopListening();
    } else {
      sttService.startListening({
        onResult: (text) => {
          setTranscript(text);
        },
        onError: (err) => {
          setErrorMessage(err);
        },
        onStateChange: (state) => {
          setIsListening(state);
        }
      });
    }
  };

  const handleClear = () => {
    setTranscript('');
    setErrorMessage(null);
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', marginTop: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={20} color="#38bdf8" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              Two-Way Communication: Spoken Words to Signer
            </h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Non-signers can speak into the microphone; their voice is transcribed into large readable text for the ISL user.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {transcript && (
            <button className="btn btn-secondary" onClick={handleClear} style={{ padding: '8px 12px', fontSize: '0.82rem' }}>
              <Trash2 size={14} />
              <span>Clear</span>
            </button>
          )}

          <button
            className={`btn ${isListening ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleToggleListening}
            disabled={!isSupported}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            <span>{isListening ? 'Stop Listening' : 'Start Microphone'}</span>
          </button>
        </div>
      </div>

      {!isSupported && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.1)', color: '#fb7185', fontSize: '0.84rem', marginBottom: '14px' }}>
          <AlertCircle size={16} />
          <span>Speech Recognition API is not supported in this browser. Try Chrome or Edge for voice transcription.</span>
        </div>
      )}

      {errorMessage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#fcd34d', fontSize: '0.84rem', marginBottom: '14px' }}>
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* High-Contrast Transcription Board for ISL User */}
      <div
        style={{
          background: '#030712',
          borderRadius: '12px',
          border: isListening ? '2px solid rgba(56, 189, 248, 0.6)' : '1px solid var(--border-subtle)',
          boxShadow: isListening ? '0 0 20px rgba(56, 189, 248, 0.2)' : 'none',
          padding: '24px',
          minHeight: '110px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: transcript ? 'flex-start' : 'center',
          transition: 'border 0.3s ease, box-shadow 0.3s ease'
        }}
      >
        {transcript ? (
          <p style={{ fontSize: '1.4rem', fontWeight: 600, color: '#f8fafc', lineHeight: 1.4 }}>
            "{transcript}"
          </p>
        ) : (
          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {isListening
              ? 'Listening... Speak clearly into the microphone.'
              : 'Click "Start Microphone" and speak; speech will be transcribed here for the signer to read.'}
          </p>
        )}
      </div>
    </div>
  );
};
