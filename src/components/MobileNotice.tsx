import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor, X } from 'lucide-react';

export const MobileNotice: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth <= 768 && !localStorage.getItem('mobile-notice-dismissed')) {
        setIsVisible(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const dismiss = () => {
    setIsVisible(false);
    localStorage.setItem('mobile-notice-dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '90%',
      maxWidth: '400px',
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(139, 92, 246, 0.3)',
      borderRadius: '12px',
      padding: '16px',
      zIndex: 9999,
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      animation: 'slideUp 0.5s ease-out'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8b5cf6', fontWeight: 600 }}>
          <Monitor size={18} />
          <span>Desktop Recommended</span>
        </div>
        <button 
          onClick={dismiss}
          style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>
      
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
        This simulation is computationally intensive. For the best experience and performance, we recommend using a desktop computer.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#10b981' }}>
        <Smartphone size={14} />
        <span>Mobile version is fully functional</span>
      </div>
      
      <style>{`
        @keyframes slideUp {
          from { transform: translate(-50%, 100%); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
