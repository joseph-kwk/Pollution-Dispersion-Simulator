import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThreeDSimulationCanvas } from './components/ThreeDSimulationCanvas';
import { ControlPanel } from './components/ControlPanel';
import { Header } from './components/Header';
import { StatusBar } from './components/StatusBar';

import { PollutionInsights } from './components/PollutionInsights';
import { CaseStudies } from './components/CaseStudies';
import { TourGuide } from './components/TourGuide';
import { SimulationCommentary } from './components/SimulationCommentary';
import { MobileNotice } from './components/MobileNotice';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const SimulatorPage: React.FC = () => {
  useKeyboardShortcuts();

  return (
    <>
      <TourGuide />
      <MobileNotice />
      <aside className="sidebar">
        <ControlPanel />
        <PollutionInsights />
      </aside>
      <main className="app-main">

        <div className="simulation-container">
          <ThreeDSimulationCanvas />
          <SimulationCommentary />
        </div>
      </main>
    </>
  );
};

const CaseStudiesPage: React.FC = () => (
  <main className="app-main case-studies-page">
    <CaseStudies />
  </main>
);

import { About } from './components/About';

const AboutPage: React.FC = () => (
  <main className="app-main about-page-container" style={{ overflow: 'auto' }}>
    <About />
  </main>
);

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <Routes>
          <Route path="/" element={<SimulatorPage />} />
          <Route path="/case-studies" element={<CaseStudiesPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
        <StatusBar />
      </div>
    </BrowserRouter>
  );
};

export default App;