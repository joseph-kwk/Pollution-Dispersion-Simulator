import React, { useEffect, useState, useRef } from 'react';
import { useSimulationStore } from '../stores/simulationStore';
import { POLLUTANT_TYPES } from '../types';
import { Info, AlertTriangle, Wind, Zap } from 'lucide-react';

export const SimulationCommentary: React.FC = () => {
  const { grid, parameters, sources, obstacles, isRunning } = useSimulationStore();
  const [message, setMessage] = useState<{ text: string; type: 'info' | 'warning' | 'tip' | 'success'; icon: React.ReactNode } | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const cycleRef = useRef<number>(0);

  // Poll state every few seconds to generate meaningful commentary
  useEffect(() => {
    if (!isRunning) {
      setMessage({
        text: "Simulation is paused. Adjust sources or obstacles, then press Play.",
        type: 'info',
        icon: <Info size={16} />
      });
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastUpdateRef.current < 4000) return; // Update every 4s minimum

      // Analyze State
      let newMessage = null;
      let totalConcentration = 0;
      let maxConcentration = 0;

      // Sample grid (simple valid cells)
      let samples = 0;
      for (let i = 0; i < grid.length; i += 5) {
        for (let j = 0; j < grid[0].length; j += 5) {
          const val = grid[i][j];
          if (val > 0) {
            totalConcentration += val;
            if (val > maxConcentration) maxConcentration = val;
            samples++;
          }
        }
      }
      const avgConcentration = samples > 0 ? totalConcentration / samples : 0;

      // Logic Rule Engine
      const activeType = sources.length > 0 ? sources[0].type : 'CO2';
      const pollutantName = POLLUTANT_TYPES[activeType].name;

      if (sources.length === 0) {
        newMessage = {
          text: "The environment is pristine. Add a pollution source to begin observing dispersion.",
          type: 'success' as const,
          icon: <Zap size={16} />
        };
      }
      else if (maxConcentration > 200) {
        // High Pollution
        if (parameters.windSpeed < 0.5) {
          newMessage = {
            text: "⚠️ Critical pollution buildup! Low wind speed is preventing dispersion, trapping pollutants locally.",
            type: 'warning' as const,
            icon: <AlertTriangle size={16} />
          };
        } else if (parameters.diffusionRate < 0.1) {
          newMessage = {
            text: "Using low diffusion? Notice how the plume stays narrow and concentrated.",
            type: 'info' as const,
            icon: <Info size={16} />
          };
        } else {
          newMessage = {
            text: `High concentrations of ${pollutantName} detected. Exposure at this level is hazardous.`,
            type: 'warning' as const,
            icon: <AlertTriangle size={16} />
          };
        }
      }
      else if (avgConcentration > 50 && maxConcentration < 150) {
        newMessage = {
          text: "Pollution is spreading widely but diluting. This is typical of good dispersion conditions.",
          type: 'info' as const,
          icon: <Wind size={16} />
        };
      }
      else if (activeType === 'PM25' && parameters.windSpeed > 2.0) {
        newMessage = {
          text: "Strong winds are carrying Particulate Matter far downwind. Regions distant from the source are now at risk.",
          type: 'info' as const,
          icon: <Wind size={16} />
        };
      }
      else if (activeType === 'CO2' && parameters.viscosity > 1.2) {
        newMessage = {
          text: "High viscosity makes the air 'thick', slowing down the mixing process of heavy CO2 gas.",
          type: 'info' as const,
          icon: <Info size={16} />
        };
      }
      else if (obstacles.some(row => row.some(cell => cell))) {
        // Obstacles exist
        newMessage = {
          text: "Observe how pollutants flow around walls. Eddies can form behind obstacles, trapping pollution.",
          type: 'tip' as const,
          icon: <Info size={16} />
        };
      }
      else {
        // General Tips cycling
        const tips = [
          { text: "Dynamic Tip: Try increasing Wind Speed to flush pollutants out of the area.", icon: <Wind size={16} />, type: 'tip' as const },
          { text: "Dynamic Tip: Reducing Emission Rate is the most effective way to improve long-term air quality.", icon: <Zap size={16} />, type: 'tip' as const },
          { text: "Dynamic Tip: 'Scientist Mode' (Spacebar) reveals the wind vector field driving the simulation.", icon: <Info size={16} />, type: 'tip' as const },
          { text: `Did you know? ${POLLUTANT_TYPES[activeType].description.split('.')[0]}.`, icon: <Info size={16} />, type: 'tip' as const }
        ];
        const tip = tips[cycleRef.current % tips.length];
        newMessage = tip;
        cycleRef.current++;
      }

      setMessage(newMessage);
      lastUpdateRef.current = now;

    }, 3000);

    return () => clearInterval(interval);
  }, [grid, parameters, sources, obstacles, isRunning]);

  if (!message) return null;

  return (
    <div className={`simulation-commentary ${message.type}`}>
      <div className="commentary-icon">
        {message.icon}
      </div>
      <div className="commentary-text">
        {message.text}
      </div>
    </div>
  );
};
