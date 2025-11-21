import React, { useState, useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';

interface TourStep {
  target: string; // CSS selector
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const TOUR_STEPS: TourStep[] = [
  {
    target: 'body',
    title: 'Welcome to the Simulator',
    content: 'This advanced tool simulates how pollution disperses in the environment using fluid dynamics. Let\'s take a quick tour!',
    position: 'center'
  },
  {
    target: '[data-tour="simulation-canvas"]',
    title: '3D Simulation View',
    content: 'This is where the magic happens. Watch particles react to wind, gravity, and obstacles in real-time. You can rotate and zoom the camera.',
    position: 'right'
  },
  {
    target: '[data-tour="controls-panel"]',
    title: 'Control Center',
    content: 'Adjust environmental parameters like wind speed and direction. You can also add different types of pollution sources here.',
    position: 'right'
  },
  {
    target: '[data-tour="settings-section"]',
    title: 'Advanced Tools',
    content: 'Enable "Scientist Mode" to see vector fields, or "Draw Obstacles" to place walls and buildings in the simulation.',
    position: 'right'
  },
  {
    target: '[data-tour="pollution-insights"]',
    title: 'Real-Time Insights',
    content: 'Monitor the Air Quality Index (AQI) and see live graphs of pollution levels. Download reports for your analysis.',
    position: 'left'
  },
  {
    target: '[data-tour="case-studies-nav"]',
    title: 'Case Studies',
    content: 'Explore pre-configured scenarios based on real-world pollution events like oil spills or industrial accidents.',
    position: 'bottom'
  }
];

export const TourGuide: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    // Check if first time user
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    if (!hasSeenTour) {
      setIsOpen(true);
    }

    // Listen for manual tour start
    const handleStartTour = () => {
      setIsOpen(true);
      setCurrentStep(0);
    };
    window.addEventListener('start-tour', handleStartTour);
    return () => window.removeEventListener('start-tour', handleStartTour);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const step = TOUR_STEPS[currentStep];
    
    if (step.position === 'center') {
      setPosition({ 
        top: window.innerHeight / 2, 
        left: window.innerWidth / 2 
      });
      return;
    }

    const element = document.querySelector(step.target);
    if (element) {
      const rect = element.getBoundingClientRect();
      let top = 0;
      let left = 0;

      switch (step.position) {
        case 'right':
          top = rect.top + rect.height / 2;
          left = rect.right + 20;
          break;
        case 'left':
          top = rect.top + rect.height / 2;
          left = rect.left - 320; // Approximate width of card
          break;
        case 'bottom':
          top = rect.bottom + 20;
          left = rect.left + rect.width / 2;
          break;
        case 'top':
          top = rect.top - 200;
          left = rect.left + rect.width / 2;
          break;
      }

      // Keep within bounds
      if (left < 20) left = 20;
      if (left > window.innerWidth - 340) left = window.innerWidth - 340;
      if (top < 20) top = 20;
      if (top > window.innerHeight - 200) top = window.innerHeight - 200;

      setPosition({ top, left });
      
      // Scroll to element if needed
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStep, isOpen]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('hasSeenTour', 'true');
  };

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];

  return (
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          zIndex: 9998,
          pointerEvents: 'none' // Allow clicking through if needed, but usually we block
        }} 
      />
      
      {/* Highlight Box (Optional - for now just the card) */}
      
      {/* Tour Card */}
      <div 
        className="tour-card"
        style={{
          position: 'fixed',
          top: step.position === 'center' ? '50%' : position.top,
          left: step.position === 'center' ? '50%' : position.left,
          transform: step.position === 'center' ? 'translate(-50%, -50%)' : 'translate(0, -50%)',
          width: '320px',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '16px',
          padding: '24px',
          zIndex: 9999,
          boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
          color: 'white',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <button 
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer'
          }}
        >
          <X size={16} />
        </button>

        <div style={{ 
          fontSize: '12px', 
          textTransform: 'uppercase', 
          letterSpacing: '1px',
          color: '#8b5cf6',
          marginBottom: '8px',
          fontWeight: 700
        }}>
          Step {currentStep + 1} of {TOUR_STEPS.length}
        </div>

        <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>{step.title}</h3>
        <p style={{ margin: '0 0 24px 0', fontSize: '14px', lineHeight: '1.6', color: 'rgba(255,255,255,0.8)' }}>
          {step.content}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {TOUR_STEPS.map((_, idx) => (
              <div 
                key={idx}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: idx === currentStep ? '#8b5cf6' : 'rgba(255,255,255,0.2)'
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {currentStep > 0 && (
              <button 
                onClick={handlePrev}
                className="btn btn-secondary"
                style={{ padding: '8px 12px', fontSize: '12px' }}
              >
                Back
              </button>
            )}
            <button 
              onClick={handleNext}
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {currentStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
              {currentStep < TOUR_STEPS.length - 1 && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
