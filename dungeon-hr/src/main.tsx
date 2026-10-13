import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ConfirmHost } from './ui/confirm';
import { InfoHost } from './ui/infotip';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ConfirmHost />
    <InfoHost />
  </StrictMode>,
);
