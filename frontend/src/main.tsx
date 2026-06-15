import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Global CSS injected as string (no CSS modules needed)
const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --color-sand:       #FAF3DC;
    --color-sun:        #FFB950;
    --color-water:      #1FD0EF;
    --color-sea:        #1158E5;
    --color-night:      #2D3852;
    --color-cloud:      #B9C1D4;
    --color-sky:        #F2F8FA;
    --font-title:       'Taviraj', serif;
    --font-body:        'Fustat', sans-serif;
    --radius-bubble:    18px;
    --radius-button:    999px;
    --radius-input:     14px;
    --radius-container: 20px;
  }

  html, body { height: 100%; overflow: hidden; }
  body { font-family: var(--font-body); background: #F8F8F8; }
  #root { height: 100%; }

  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); }
    30%            { transform: translateY(-5px); }
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--color-cloud); border-radius: 2px; }

  button:disabled { opacity: 0.45; cursor: not-allowed !important; }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
