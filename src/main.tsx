import './polyfills';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 1. Les Polyfills de base (ORDRE IMPORTANT)
import '@formatjs/intl-getcanonicallocales/polyfill';
import '@formatjs/intl-locale/polyfill';

// 2. Celui qu'on a ajouté juste avant (NumberFormat)
import '@formatjs/intl-numberformat/polyfill';
import '@formatjs/intl-numberformat/locale-data/fr';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
