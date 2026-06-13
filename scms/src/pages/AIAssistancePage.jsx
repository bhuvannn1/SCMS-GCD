import React from 'react';
import AIAssistant from '../components/AIAssistant';

const AIAssistancePage = () => {
    return (
        <div className="ai-page-container" style={{
            padding: '24px 20px',
            boxSizing: 'border-box',
            minHeight: 'calc(100vh - 70px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'stretch',
            backgroundColor: 'transparent',
            maxWidth: '1000px',
            margin: '0 auto'
        }}>
            {/* Center: AI Chat */}
            <div className="ai-chat-container" style={{
                flex: 1,
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-lg)',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--bg-card)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)'
            }}>
                <AIAssistant />
            </div>
        </div>
    );
};

export default AIAssistancePage;
