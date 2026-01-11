/**
 * Header Component
 * Sticky navigation with logo, nav links, theme toggle, and mobile menu
 */

import { getTheme, toggleTheme } from '../utils/storage.js';
import { jobQueue } from '../utils/jobQueue.js';
import { createEventManager } from '../utils/componentBase.js';

const Header = parentElement => {
  let queueCount = 0;
  let unsubscribe = null;

  // Event manager for all header events
  const events = createEventManager();

  const render = () => {
    const theme = getTheme();
    const isDark = theme === 'dark';

    parentElement.innerHTML = `
      <div class="header-container">
        <a href="#/" class="logo">
          <span class="logo-jp">日本語物語</span>
          <span class="logo-en">Nihongo Monogatari</span>
        </a>

        <nav class="main-nav">
          <a href="#/" class="nav-link">Home</a>
          <a href="#/library" class="nav-link">Library</a>
          <a href="#/queue" class="nav-link nav-link--with-badge">
            Queue
            ${queueCount > 0 ? `<span class="nav-badge">${queueCount}</span>` : ''}
          </a>
          <a href="#/kana" class="nav-link">Kana</a>
          <a href="#/settings" class="nav-link">Settings</a>
          
          <button id="theme-toggle" class="icon-btn" aria-label="Toggle theme" title="Toggle theme">
            <span class="theme-icon">${isDark ? '☀️' : '🌙'}</span>
          </button>
          
          <button id="mobile-menu-btn" class="icon-btn mobile-only" aria-label="Open menu">
            ☰
          </button>
        </nav>
      </div>
      
      <!-- Mobile Menu Overlay -->
      <div id="mobile-menu" class="mobile-menu hidden">
        <nav class="mobile-menu__nav">
          <a href="#/" class="mobile-menu__link">🏠 Home</a>
          <a href="#/library" class="mobile-menu__link">📚 Library</a>
          <a href="#/queue" class="mobile-menu__link">
            🎧 Queue ${queueCount > 0 ? `(${queueCount})` : ''}
          </a>
          <a href="#/kana" class="mobile-menu__link">🔤 Kana Chart</a>
          <a href="#/settings" class="mobile-menu__link">⚙️ Settings</a>
        </nav>
      </div>
    `;

    setupListeners();
  };

  const setupListeners = () => {
    const themeBtn = parentElement.querySelector('#theme-toggle');
    const mobileMenuBtn = parentElement.querySelector('#mobile-menu-btn');
    const mobileMenu = parentElement.querySelector('#mobile-menu');

    // Theme toggle
    events.on(themeBtn, 'click', () => {
      const newTheme = toggleTheme();
      const icon = themeBtn.querySelector('.theme-icon');
      icon.textContent = newTheme === 'dark' ? '☀️' : '🌙';

      // Add a little animation using CSS class
      themeBtn.classList.add('theme-icon--animating');
      setTimeout(() => {
        themeBtn.classList.remove('theme-icon--animating');
      }, 300);
    });

    // Mobile menu toggle
    events.on(mobileMenuBtn, 'click', () => {
      mobileMenu?.classList.toggle('hidden');
      mobileMenu?.classList.toggle('open');
    });

    // Close mobile menu on link click (use delegation for all links)
    events.delegate(mobileMenu, 'click', '.mobile-menu__link', () => {
      mobileMenu.classList.add('hidden');
      mobileMenu.classList.remove('open');
    });

    // Close on outside click (THIS WAS THE MEMORY LEAK!)
    events.on(document, 'click', e => {
      if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
        if (!parentElement.contains(e.target)) {
          mobileMenu.classList.add('hidden');
          mobileMenu.classList.remove('open');
        }
      }
    });
  };

  // Subscribe to job queue updates
  try {
    unsubscribe = jobQueue.subscribe(_jobs => {
      const newCount = jobQueue.getPendingCount();
      if (newCount !== queueCount) {
        queueCount = newCount;
        render();
      }
    });
  } catch {
    // jobQueue might not be initialized
  }

  render();

  // Return cleanup function
  return () => {
    events.cleanup();
    if (unsubscribe) {
      unsubscribe();
    }
  };
};

// Header styles now in external CSS: src/styles/components/headers.css

export default Header;
