import React from 'react';
import { SimulationCanvas } from './components/SimulationCanvas';
import { ControlPanel } from './components/ControlPanel';
import { Header } from './components/Header';
import { StatusBar } from './components/StatusBar';

const App: React.FC = () => {
  return (
    <div className="app">
      <Header />
      <aside className="sidebar">
        <ControlPanel />
      </aside>
      <main className="app-main">
        <div className="simulation-container">
          <SimulationCanvas />
        </div>
      </main>
      <StatusBar />
    </div>
  );
};

export default App;