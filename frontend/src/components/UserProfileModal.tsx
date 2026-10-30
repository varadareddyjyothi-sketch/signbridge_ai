import React, { useState } from 'react';
import { X, User, Mail, Globe, Calendar, FileSpreadsheet, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import type { UserProfile } from '../types';

interface UserProfileModalProps {
  isOpen: boolean;
  user: UserProfile;
  onClose: () => void;
  onProfileUpdated: (updatedUser: UserProfile) => void;
  onLogout: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  user,
  onClose,
  onProfileUpdated,
  onLogout
}) => {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [preferredLanguage, setPreferredLanguage] = useState(user.preferred_language || 'en');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      const updated = await api.updateProfile({
        display_name: displayName.trim(),
        preferred_language: preferredLanguage
      });
      onProfileUpdated(updated);
      setStatusMsg({ type: 'success', text: 'Profile preferences updated successfully.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    setStatusMsg(null);
    try {
      await api.downloadExcelExport();
      setStatusMsg({ type: 'success', text: 'Excel workbook downloaded successfully!' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Export failed. Check connection.' });
    } finally {
      setExporting(false);
    }
  };

  const formattedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : 'Recent';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
          padding: '24px',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close profile"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            padding: '6px',
            color: '#64748b',
            background: 'transparent',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.1rem',
            boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
          }}>
            {user.display_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 id="profile-modal-title" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.3 }}>
              {user.display_name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
              <Mail size={13} />
              <span>{user.email}</span>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div
            role={statusMsg.type === 'error' ? 'alert' : 'status'}
            style={{
              marginBottom: '14px',
              padding: '10px 12px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              backgroundColor: statusMsg.type === 'success' ? '#ecfdf5' : '#fff1f2',
              border: `1px solid ${statusMsg.type === 'success' ? '#a7f3d0' : '#fecdd3'}`,
              color: statusMsg.type === 'success' ? '#047857' : '#be123c'
            }}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
            ) : (
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Account Details Box */}
        <div style={{
          padding: '12px 14px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginBottom: '18px',
          fontSize: '0.8rem',
          color: '#64748b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={13} color="#64748b" />
              Member Since
            </span>
            <span style={{ color: '#0f172a', fontWeight: 600 }}>{formattedDate}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Account Security</span>
            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
              PBKDF2 Salted Auth
            </span>
          </div>
        </div>

        {/* Edit Preferences Form */}
        <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '6px' }}>
              Display Name
            </label>
            <div style={{ position: 'relative' }}>
              <User size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{
                  width: '100%',
                  paddingLeft: '36px',
                  paddingRight: '12px',
                  paddingTop: '9px',
                  paddingBottom: '9px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '6px' }}>
              Default Output Language
            </label>
            <div style={{ position: 'relative' }}>
              <Globe size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                style={{
                  width: '100%',
                  paddingLeft: '36px',
                  paddingRight: '12px',
                  paddingTop: '9px',
                  paddingBottom: '9px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.88rem'
                }}
              >
                <option value="en">English</option>
                <option value="te">Telugu Script (తెలుగు)</option>
                <option value="ro">Romanized Telugu</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{ width: '100%', padding: '9px 16px', fontSize: '0.9rem' }}
          >
            {saving ? 'Saving Changes...' : 'Save Preferences'}
          </button>
        </form>

        {/* Action Buttons: Excel Export & Sign Out */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting}
            className="btn btn-secondary"
            style={{
              width: '100%',
              padding: '9px 14px',
              fontSize: '0.86rem',
              background: '#ecfdf5',
              borderColor: '#a7f3d0',
              color: '#047857',
              fontWeight: 600,
              justifyContent: 'center'
            }}
          >
            <FileSpreadsheet size={15} />
            <span>{exporting ? 'Generating Excel Workbook...' : 'Export Sentence History to Excel (.xlsx)'}</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="btn btn-danger"
            style={{ width: '100%', padding: '9px 14px', fontSize: '0.86rem', justifyContent: 'center' }}
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
