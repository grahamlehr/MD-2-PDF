/* --- Main Application Entry point --- */

// Import Signal Design System & Application styles so Vite compiles and includes them
import './styles/signal.css';
import './styles/app.css';
import './styles/editor.css';

// Import UI module and initialize
import { ui } from './modules/ui.js';

// Boot the application once DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
  ui.init();
});
