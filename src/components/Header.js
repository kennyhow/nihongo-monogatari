import { toggleTheme, getTheme } from '../utils/storage.js';

const Header = (parentElement) => {
  const render = () => {
    const isDark = getTheme() === 'dark';

    // Using a template literal for the HTML
    const html = `
      <div class="container header-container">
        <a href="#/" class="logo">
          <span class="logo-jp">日本語物語</span>
          <span class="logo-en">Monogatari</span>
        </a>
        
        <nav class="main-nav">
          <a href="#/" class="nav-link">Home</a>
          <a href="#/library" class="nav-link">Library</a>
          <a href="#/queue" class="nav-link">Queue</a>
          <a href="#/settings" class="nav-link">Settings</a>
          
          <button id="theme-toggle" class="icon-btn" aria-label="Toggle theme">
            ${isDark ? '☀️' : '🌙'}
          </button>
        </nav>
      </div>
    `;

    parentElement.innerHTML = html;

    // Add styles for header specific stuff here or allow global css to handle it
    // I'll add a style block dynamically or rely on index.css
    // Let's rely on index.css but I need to make sure 'header-container', 'logo', etc exist or use generic classes

    // Attach event listeners
    document.getElementById('theme-toggle').addEventListener('click', () => {
      toggleTheme();
      render(); // Re-render to update icon
    });
  };

  // Initial Render
  render();
};

export default Header;
