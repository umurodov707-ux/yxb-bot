import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { tg } from './api/client';

tg?.ready();
tg?.expand();
try { tg?.setHeaderColor?.('#0b0f19'); tg?.setBackgroundColor?.('#0b0f19'); } catch { /* old clients */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
