import React, { useEffect, useState, useRef } from 'react';
import { useSimulationStore } from '../stores/simulationStore';
import { AlertCircle, Wind, Activity, Play, Pause } from 'lucide-react';

type MessageType = 'info' | 'warning' | 'success' | 'danger';

interface Message {
  id: number;
  text: string;
  type: MessageType;
  icon?: React.ReactNode;
}

export const SimulationCommentary: React.FC = () => {
  const { isRunning, sources, parameters, grid } = useSimulationStore();
  const [message, setMessage] = useState<Message | null>(null);
  const prevRunningRef = useRef(isRunning);
  const prevWindRef = useRef(parameters.windDirection);
  const prevSourceCountRef = useRef(sources.length);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to show message
  const showMessage = (text: string, type: MessageType = 'info', icon?: React.ReactNode, duration = 5000) => {
    // Clear existing timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setMessage({ id: Date.now(), text, type, icon });

    // Auto-hide after duration
    timeoutRef.current = setTimeout(() => {
      setMessage(null);
    }, duration);
  };

  // Monitor Running State
  useEffect(() => {
    if (prevRunningRef.current !== isRunning) {
      if (isRunning) {
        showMessage('Simulation started. Monitoring dispersion...', 'success', <Play size={18} />);
      } else {
        showMessage('Simulation paused.', 'info', <Pause size={18} />);
      }
      prevRunningRef.current = isRunning;
    }
  }, [isRunning]);

  // Monitor Wind Changes
  useEffect(() => {
    const diff = Math.abs(prevWindRef.current - parameters.windDirection);
    if (diff > 10) { // Only notify significant changes
      const dirName = getWindDirectionName(parameters.windDirection);
      showMessage(`Wind shifting to ${dirName}. Dispersion path altering.`, 'info', <Wind size={18} />);
      prevWindRef.current = parameters.windDirection;
    }
  }, [parameters.windDirection]);

  // Monitor Sources
  useEffect(() => {
    if (sources.length > prevSourceCountRef.current) {
      showMessage('New pollution source detected. Contaminant levels rising.', 'warning', <AlertCircle size={18} />);
    }
    prevSourceCountRef.current = sources.length;
  }, [sources.length]);

  // Monitor Pollution Levels (Throttled via grid updates from store)
  useEffect(() => {
    if (!isRunning || !grid || grid.length === 0) return;

    // Check max pollution
    let maxVal = 0;
    for (let r = 0; r < grid.length; r += 2) { // sparse sample
      for (let c = 0; c < grid[0].length; c += 2) {
        if (grid[r][c] > maxVal) maxVal = grid[r][c];
      }
    }

    if (maxVal > 200) {
      // Only show if we haven't shown a danger warning recently (could track with ref)
      // For now, let's just randomly show it occasionally if it persists, or rely on state.
      // Better: store "lastHazardTime" ref.
    }
  }, [grid, isRunning]);

  const getWindDirectionName = (dir: number) => {
    if (dir >= 337.5 || dir < 22.5) return 'North';
    if (dir >= 22.5 && dir < 67.5) return 'Northeast';
    if (dir >= 67.5 && dir < 112.5) return 'East';
    if (dir >= 112.5 && dir < 157.5) return 'Southeast';
    if (dir >= 157.5 && dir < 202.5) return 'South';
    if (dir >= 202.5 && dir < 247.5) return 'Southwest';
    if (dir >= 247.5 && dir < 292.5) return 'West';
    return 'Northwest';
  };

  if (!message) return null;

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(12px)',
      borderLeft: `4px solid ${getColorForType(message.type)}`,
      borderRadius: '8px',
      padding: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      transition: 'all 0.3s ease',
      animation: 'slideIn 0.3s ease-out'
    }}>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{ color: getColorForType(message.type) }}>
        {message.icon || <Activity size={18} />}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>
          {message.type.toUpperCase()}
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>
          {message.text}
        </div>
      </div>
    </div>
  );
};

function getColorForType(type: MessageType) {
  switch (type) {
    case 'success': return '#10b981';
    case 'warning': return '#f59e0b';
    case 'danger': return '#ef4444';
    case 'info': default: return '#3b82f6';
  }
}
