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
    content: 'This is where the magic happens. Watch particles react to wind, gravity, and obstacles in real-time. You can rotate and zoom using your mouse.',
    position: 'center'
  },
  {
    target: '.tour-playback-controls',
    title: 'Playback Controls',
    content: 'Start, pause, or reset the simulation at any time. Use the camera icon to take screenshots of your experiments.',
    position: 'bottom'
  },
  {
    target: '[data-tour="env-controls"]',
    title: 'Environment Controls',
    content: 'Adjust wind speed, direction, and diffusion rates. Save your configurations or export data as CSV.',
    position: 'right'
  },
  {
    target: '[data-tour="pollution-sources"]',
    title: 'Pollution Sources',
    content: 'Add different pollutants like CO2, PM2.5, or SO2. Each behaves differently based on real-world physics (e.g., heavy gases sink).',
    position: 'right'
  },
  {
    target: '[data-tour="settings-section"]',
    title: 'Scientific Tools',
    content: 'Enable "Scientist Mode" to visualize wind vectors, or use "Build Walls" to draw obstacles and test dispersion around buildings.',
    position: 'right'
  },
  {
    target: '.simulation-commentary',
    title: 'Intelligent Guide',
    content: 'Keep an eye on this smart assistant! It analyzes your simulation in real-time and provides physics-based insights and warnings.',
    position: 'top'
  },
  {
    target: '[data-tour="pollution-insights"]',
    title: 'Real-Time Data',
    content: 'Monitor the live Air Quality Index (AQI) and see how pollutant concentrations change over time.',
    position: 'right'
  },
  {
    target: '[data-tour="case-studies-nav"]',
    title: 'Case Studies',
    content: 'Explore pre-made scenarios like "Urban Rush Hour" or "Industrial Leak" to see pollution dynamics in specific situations.',
    position: 'bottom'
  }
];

export const TourGuide: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState<any>({ top: 0, left: 0, transform: 'translate(0, 0)' });

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
        left: window.innerWidth / 2,
        transform: 'translate(-50%, -50%)'
      });
      return;
    }

    const element = document.querySelector(step.target);
    if (element) {
      const rect = element.getBoundingClientRect();
      let top = 0;
      let left = 0;
      let transform = 'translate(0, 0)';

      switch (step.position) {
        case 'right':
          top = rect.top + rect.height / 2;
          left = rect.right + 20;
          transform = 'translate(0, -50%)';
          break;
        case 'left':
          top = rect.top + rect.height / 2;
          left = rect.left - 20;
          transform = 'translate(-100%, -50%)';
          break;
        case 'bottom':
          top = rect.bottom + 20;
          left = rect.left + rect.width / 2;
          transform = 'translate(-50%, 0)';
          break;
        case 'top':
          top = rect.top - 20;
          left = rect.left + rect.width / 2;
          transform = 'translate(-50%, -100%)';
          break;
      }

      // Smart bounds checking
      const CARD_WIDTH = 320;
      const MARGIN = 20;

      // Ensure horizontal visibility based on transform origin
      if (step.position === 'right') {
        if (left + CARD_WIDTH + MARGIN > window.innerWidth) {
          left = window.innerWidth - CARD_WIDTH - MARGIN;
        }
        if (left < MARGIN) left = MARGIN;
      } else if (step.position === 'left') {
        if (left - CARD_WIDTH - MARGIN < 0) {
          left = CARD_WIDTH + MARGIN;
        }
        if (left > window.innerWidth - MARGIN) left = window.innerWidth - MARGIN;
      } else {
        if (left + CARD_WIDTH / 2 + MARGIN > window.innerWidth) {
          left = window.innerWidth - CARD_WIDTH / 2 - MARGIN;
        }
        if (left - CARD_WIDTH / 2 - MARGIN < 0) {
          left = CARD_WIDTH / 2 + MARGIN;
        }
      }

      // Vertical bounds - Avoid Header (approx 80px) and Bottom
      const HEADER_HEIGHT = 80;
      const CARD_HALF_HEIGHT = 125; // Estimate half card height

      // If the calculated top position puts the top of the card under the header
      if (top - CARD_HALF_HEIGHT < HEADER_HEIGHT) {
        top = HEADER_HEIGHT + CARD_HALF_HEIGHT + MARGIN;
      }

      // If the calculated top position puts the bottom of the card off screen
      if (top + CARD_HALF_HEIGHT > window.innerHeight - MARGIN) {
        top = window.innerHeight - CARD_HALF_HEIGHT - MARGIN;
      }

      setPosition({ top, left, transform } as any);

      // Scroll to element if needed
      // Use 'auto' instead of 'smooth' to ensure getBoundingClientRect is accurate immediately
      element.scrollIntoView({ behavior: 'auto', block: 'center' });
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
          top: position.top,
          left: position.left,
          transform: (position as any).transform || 'translate(0, 0)',
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
