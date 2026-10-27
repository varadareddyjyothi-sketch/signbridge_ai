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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close profile"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-500/20">
            {user.display_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 id="profile-modal-title" className="text-xl font-bold text-white leading-tight">
              {user.display_name}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              <span>{user.email}</span>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div
            role={statusMsg.type === 'error' ? 'alert' : 'status'}
            className={`mb-4 p-3 rounded-xl text-sm flex items-start gap-2.5 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Account Details Box */}
        <div className="p-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl space-y-2 mb-5 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Member Since
            </span>
            <span className="text-slate-200 font-medium">{formattedDate}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Account Security</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              PBKDF2 Salted Auth
            </span>
          </div>
        </div>

        {/* Edit Preferences Form */}
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Display Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Default Output Language
            </label>
            <div className="relative">
              <Globe className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {saving ? 'Saving Changes...' : 'Save Preferences'}
          </button>
        </form>

        {/* Action Buttons: Excel Export & Sign Out */}
        <div className="mt-6 pt-5 border-t border-slate-800 space-y-2.5">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting}
            className="w-full py-2.5 px-4 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{exporting ? 'Generating Excel Workbook...' : 'Export Sentence History to Excel (.xlsx)'}</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2.5 px-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
