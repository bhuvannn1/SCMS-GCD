import React, { useState } from 'react';

const GoogleTranslate = () => {
  const [showTranslate, setShowTranslate] = useState(false);

  const initGoogleTranslate = () => {
    // Only Indian languages + English
    const languages = 'en,hi,ta,te,kn,ml,mr,gu,pa,bn,ur';
    
    // Clear the element to prevent duplicate widgets
    const el = document.getElementById('google_translate_element');
    if (el) el.innerHTML = '';

    new window.google.translate.TranslateElement(
      { 
        pageLanguage: 'en', 
        includedLanguages: languages,
        autoDisplay: false
      },
      'google_translate_element'
    );
  };

  const loadTranslateScript = () => {
    setShowTranslate(true);

    // Give React a tiny moment to render the <div id="google_translate_element">
    setTimeout(() => {
      if (!document.getElementById('google-translate-script')) {
        window.googleTranslateElementInit = initGoogleTranslate;
        
        const script = document.createElement('script');
        script.id = 'google-translate-script';
        script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        script.async = true;
        document.body.appendChild(script);
      } else {
        // If the script is already present on the window, just initialize
        if (window.google && window.google.translate) {
          initGoogleTranslate();
        }
      }
    }, 50);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {!showTranslate ? (
        <button 
          className="translate-init-btn"
          onClick={loadTranslateScript} 
          style={{ 
            backgroundColor: '#fff', 
            color: '#f97316', 
            marginRight: '12px',
            border: '2px solid #f97316',
            boxShadow: '0 4px 6px rgba(249,115,22,0.1)',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.2s ease-in-out'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = '#f97316';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = '#fff';
            e.currentTarget.style.color = '#f97316';
          }}
        >
          <svg style={{ width: '16px', height: '16px', marginRight: '6px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
          Translate
        </button>
      ) : (
        <div id="google_translate_element" style={{ marginRight: '12px' }}></div>
      )}
    </div>
  );
};

export default GoogleTranslate;
