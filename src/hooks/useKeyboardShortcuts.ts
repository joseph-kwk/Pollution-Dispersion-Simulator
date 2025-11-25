import { useEffect } from 'react';
import { useSimulationStore } from '../stores/simulationStore';

export const useKeyboardShortcuts = () => {
  const { isRunning, actions } = useSimulationStore();

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Prevent default for our shortcuts
      const shortcutKeys = [' ', 'r', 'R', 's', 'S', 'g', 'G', 'v', 'V', 'd', 'D', 'w', 'W'];
      if (shortcutKeys.includes(event.key)) {
        event.preventDefault();
      }

      switch (event.key) {
        case ' ': // Space - Play/Pause
          if (isRunning) {
            actions.pause();
          } else {
            actions.start();
          }
          break;
        
        case 'r':
        case 'R': // R - Reset
          actions.reset();
          break;
        
        case 's':
        case 'S': // S - Save (trigger export modal)
          // We'll dispatch a custom event that ControlPanel can listen to
          window.dispatchEvent(new CustomEvent('keyboard-save'));
          break;
        
        case 'g':
        case 'G': // G - Toggle GPU
          actions.toggleGPU();
          break;
        
        case 'v':
        case 'V': // V - Toggle Scientist Mode (Vector view)
          actions.toggleScientistMode();
          break;
        
        case 'd':
        case 'D': // D - Toggle Drawing Obstacles
          actions.toggleDrawingObstacles();
          break;
        
        case 'w':
        case 'W': // W - Toggle Dynamic Weather
          actions.toggleDynamicWeather();
          break;
        
        case '?': // ? - Show keyboard shortcuts help
          window.dispatchEvent(new CustomEvent('show-shortcuts-help'));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [isRunning, actions]);
};
