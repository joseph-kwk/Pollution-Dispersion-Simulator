import React from 'react';
import { ThreeDSimulationCanvas } from './components/ThreeDSimulationCanvas';
import { ControlPanel } from './components/ControlPanel';
import { Header } from './components/Header';
import { StatusBar } from './components/StatusBar';
import { SimulationCommentary } from './components/SimulationCommentary';

const App: React.FC = () => {
  return (
    <div className="app">
      <Header />
      <aside className="sidebar">
        <ControlPanel />
      </aside>
      <main className="app-main">
        <SimulationCommentary />
        <div className="simulation-container">
          <ThreeDSimulationCanvas />
        </div>
      </main>
      <StatusBar />
    </div>
  );
};

export default App;