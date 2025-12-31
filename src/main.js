import './styles/index.css';
import { initRouter } from './utils/router.js';
import Header from './components/Header.js';
import { getTheme, toggleTheme } from './utils/storage.js';

// App initialization
const init = () => {
    const app = document.getElementById('app');

    // Initialize theme
    const savedTheme = getTheme();
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Render layout shell
    app.innerHTML = `
    <header id="main-header"></header>
    <main id="main-content" class="container"></main>
    <footer id="main-footer">
      <p>&copy; ${new Date().getFullYear()} 日本語物語 (Nihongo Monogatari)</p>
    </footer>
  `;

    // Mount Header
    const headerContainer = document.getElementById('main-header');
    Header(headerContainer);

    // Initialize Router
    initRouter(document.getElementById('main-content'));
};

document.addEventListener('DOMContentLoaded', init);
