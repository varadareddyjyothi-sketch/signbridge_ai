import React, { useState } from 'react';
import { Layers, Sparkles, Wrench } from 'lucide-react';
import { DatasetStudio } from './DatasetStudio';
import { GestureManagement } from './GestureManagement';
import type { ModelStatus } from '../types';

interface AdminToolsPanelProps {
  modelStatus: ModelStatus | null;
  onModelRetrained: () => void;
  selectedClassId?: string;
}

export const AdminToolsPanel: React.FC<AdminToolsPanelProps> = ({
  modelStatus,
  onModelRetrained,
  selectedClassId
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'studio' | 'gestures'>('studio');
  const [studioClassId, setStudioClassId] = useState<string | undefined>(selectedClassId);

  const handleNavigateToCollect = (classId: string) => {
    setStudioClassId(classId);
    setActiveSubTab('studio');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '20px 24px',
          marginBottom: '20px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          background: 'rgba(245, 158, 11, 0.05)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f59e0b'
          }}>
            <Wrench size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Advanced Admin & Developer Studio
              </h2>
              <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fcd34d', border: '1px solid rgba(245, 158, 11, 0.4)', fontSize: '0.68rem' }}>
                Admin / Developer Area
              </span>
              <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
                Model: {modelStatus?.active_version || 'v1.0.0'} ({modelStatus?.classes_count || 10} classes)
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Record genuine webcam samples, manage sign vocabulary definitions, inspect dataset distributions, and retrain the Scikit-Learn Random Forest model.
            </p>
          </div>
        </div>

        {/* Subtab Switcher */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn ${activeSubTab === 'studio' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('studio')}
            style={{ padding: '8px 16px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Layers size={15} />
            <span>Dataset Studio</span>
          </button>

          <button
            className={`btn ${activeSubTab === 'gestures' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('gestures')}
            style={{ padding: '8px 16px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkles size={15} />
            <span>Manage Gestures</span>
          </button>
        </div>
      </div>

      {/* Subtab Contents */}
      {activeSubTab === 'studio' && (
        <DatasetStudio
          initialClassId={studioClassId}
          onModelRetrained={onModelRetrained}
        />
      )}

      {activeSubTab === 'gestures' && (
        <GestureManagement
          onNavigateToCollect={handleNavigateToCollect}
          onModelUpdated={onModelRetrained}
        />
      )}
    </div>
  );
};
