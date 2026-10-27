import React, { useState } from 'react';
import { Mic, MicOff, MessageSquare, Trash2, AlertCircle, Send, Volume2, UserCheck } from 'lucide-react';
import { sttService, ttsService } from '../services/speech';

export const TwoWaySpeechPanel: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [typedMessage, setTypedMessage] = useState('');
  const [activePartnerMessage, setActivePartnerMessage] = useState<{
    text: string;
    source: 'typed' | 'spoken';
    timestamp: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSupported = sttService.isSupported();

  const handleToggleListening = () => {
    setErrorMessage(null);
    if (isListening) {
      sttService.stopListening();
    } else {
      sttService.startListening({
        onResult: (text) => {
          setActivePartnerMessage({
            text,
            source: 'spoken',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          });
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

  const handleSendTypedMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = typedMessage.trim();
    if (!clean) return;
    setActivePartnerMessage({
      text: clean,
      source: 'typed',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
    setTypedMessage('');
  };

  const handleClear = () => {
    setActivePartnerMessage(null);
    setTypedMessage('');
    setErrorMessage(null);
    if (isListening) {
      sttService.stopListening();
    }
  };

  const handleSpeakMessage = () => {
    if (!activePartnerMessage) return;
    ttsService.speak(activePartnerMessage.text, 'en');
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', marginTop: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={20} color="#38bdf8" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              Two-Way Communication Bridge: Partner to Signer
            </h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>
            Hearing/speaking partners can type or speak their reply so the sign-language user can read it clearly.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activePartnerMessage && (
            <>
              <button
                className="btn btn-secondary"
                onClick={handleSpeakMessage}
                style={{ padding: '7px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Speak message aloud"
              >
                <Volume2 size={14} color="#818cf8" />
                <span>Speak</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleClear}
                style={{ padding: '7px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Trash2 size={14} />
                <span>Clear</span>
              </button>
            </>
          )}

          <button
            className={`btn ${isListening ? 'btn-danger' : 'btn-secondary'}`}
            onClick={handleToggleListening}
            disabled={!isSupported}
            style={{ padding: '7px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            title={isSupported ? 'Speak using microphone' : 'Microphone speech recognition not supported in this browser'}
          >
            {isListening ? <MicOff size={15} /> : <Mic size={15} />}
            <span>{isListening ? 'Stop Mic' : 'Voice Input'}</span>
          </button>
        </div>
      </div>

      {!isSupported && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.1)', color: '#fb7185', fontSize: '0.8rem', marginBottom: '14px' }}>
          <AlertCircle size={15} />
          <span>Microphone speech recognition is not supported in this browser. You can type your reply below.</span>
        </div>
      )}

      {errorMessage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#fcd34d', fontSize: '0.8rem', marginBottom: '14px' }}>
          <AlertCircle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Partner Typing Form */}
      <form onSubmit={handleSendTypedMessage} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text"
          value={typedMessage}
          onChange={(e) => setTypedMessage(e.target.value)}
          placeholder="Type a message or response for the signer (e.g. 'Yes, I understand' or 'The bus arrives at 4 PM')..."
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid var(--border-subtle)',
            color: '#ffffff',
            fontSize: '0.88rem',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!typedMessage.trim()}
          style={{ padding: '10px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Send size={15} />
          <span>Display Reply</span>
        </button>
      </form>

      {/* High-Contrast Reader Board for the Deaf / Hard-of-Hearing User */}
      <div
        style={{
          background: '#030712',
          borderRadius: '12px',
          border: isListening
            ? '2px solid rgba(56, 189, 248, 0.8)'
            : activePartnerMessage
            ? '1px solid rgba(56, 189, 248, 0.4)'
            : '1px solid var(--border-subtle)',
          boxShadow: isListening ? '0 0 24px rgba(56, 189, 248, 0.25)' : 'none',
          padding: '20px 24px',
          minHeight: '100px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          transition: 'all 0.3s ease'
        }}
      >
        {activePartnerMessage ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span
                className="badge"
                style={{
                  background: activePartnerMessage.source === 'typed' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                  color: activePartnerMessage.source === 'typed' ? '#38bdf8' : '#c084fc',
                  border: `1px solid ${activePartnerMessage.source === 'typed' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <UserCheck size={11} />
                <span>Partner Reply ({activePartnerMessage.source === 'typed' ? 'Typed Text' : 'Voice Input'})</span>
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {activePartnerMessage.timestamp}
              </span>
            </div>
            <p style={{ fontSize: '1.35rem', fontWeight: 600, color: '#f8fafc', lineHeight: 1.45, margin: 0 }}>
              "{activePartnerMessage.text}"
            </p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem', fontStyle: 'italic' }}>
            {isListening ? (
              <span style={{ color: '#38bdf8' }}>Listening... Speak clearly into the microphone.</span>
            ) : (
              'Replies from your conversation partner will appear here in large, high-contrast text.'
            )}
          </div>
        )}
      </div>
    </div>
  );
};
