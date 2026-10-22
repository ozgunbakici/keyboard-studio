import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import {initApp} from './state/actions';
import './index.css';

document.documentElement.dataset.theme = 'dark';
void initApp();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
