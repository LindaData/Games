import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initAnalytics } from './analytics';
import { registerServiceWorker } from './pwa/register';
import './index.css';

// Both only on the built web version over http(s) (never in dev or the desktop app).
initAnalytics();
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
