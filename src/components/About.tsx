import React from 'react';
import { Github, Code, Info, Heart, AlertTriangle } from 'lucide-react';

export const About: React.FC = () => {
    return (
        <div className="about-page" style={{
            maxWidth: '800px',
            margin: '0 auto',
            padding: '2rem 1rem',
            color: 'var(--text-primary)'
        }}>
            {/* Hero Section */}
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <h1 style={{
                    fontSize: '2.5rem',
                    marginBottom: '1rem',
                    background: 'linear-gradient(to right, #60a5fa, #a78bfa)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 800
                }}>
                    About Pollution Dispersion Simulator
                </h1>
                <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
                    An interactive educational tool designed to visualize how pollutants spread in the environment using real-time fluid dynamics.
                </p>
            </div>

            {/* Development Status Alert */}
            <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '3rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'start'
            }}>
                <AlertTriangle color="#f59e0b" size={24} style={{ flexShrink: 0, marginTop: '4px' }} />
                <div>
                    <h3 style={{ color: '#f59e0b', margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>Active Development</h3>
                    <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        This application is currently in <strong>Beta</strong>. You may encounter occasional bugs or performance issues as we continue to refine the physics engine and add new features. Feedback is highly appreciated!
                    </p>
                </div>
            </div>

            {/* Mission & Features Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '2rem',
                marginBottom: '4rem'
            }}>
                <div className="feature-card" style={{
                    background: 'var(--bg-secondary)',
                    padding: '2rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)'
                }}>
                    <div style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1rem'
                    }}>
                        <Info color="#60a5fa" />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Our Mission</h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        To make complex environmental science concepts accessible through interactive visualization. We believe that seeing how pollution behaves is the first step towards understanding and mitigation.
                    </p>
                </div>

                <div className="feature-card" style={{
                    background: 'var(--bg-secondary)',
                    padding: '2rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)'
                }}>
                    <div style={{
                        background: 'rgba(168, 85, 247, 0.1)',
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1rem'
                    }}>
                        <Code color="#a855f7" />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Open Source</h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        Built with modern web technologies including React, Three.js for 3D rendering, and custom fluid dynamics algorithms. We believe in open science and transparent code.
                    </p>
                </div>
            </div>

            {/* Developer Note */}
            <div style={{ textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    Developed with <Heart size={14} color="#ef4444" style={{ display: 'inline', verticalAlign: 'middle' }} /> for the Environment
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                    <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Github size={18} />
                        <span>GitHub Repository</span>
                    </a>
                </div>
            </div>
        </div>
    );
};
