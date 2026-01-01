/**
 * Header Component
 * Sticky navigation with logo, nav links, theme toggle, and mobile menu
 */

import { getTheme, toggleTheme } from '../utils/storage.js';
import { audioQueue } from '../utils/audioQueue.js';

const Header = (parentElement) => {
  let queueCount = 0;
  let unsubscribe = null;

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
          <a href="#/settings" class="mobile-menu__link">⚙️ Settings</a>
        </nav>
      </div>
    `;

    setupListeners();
  };

  const setupListeners = () => {
    // Theme toggle
    const themeBtn = parentElement.querySelector('#theme-toggle');
    themeBtn?.addEventListener('click', () => {
      const newTheme = toggleTheme();
      const icon = themeBtn.querySelector('.theme-icon');
      icon.textContent = newTheme === 'dark' ? '☀️' : '🌙';

      // Add a little animation
      themeBtn.style.transform = 'scale(1.2) rotate(180deg)';
      setTimeout(() => {
        themeBtn.style.transform = '';
      }, 300);
    });

    // Mobile menu toggle
    const mobileMenuBtn = parentElement.querySelector('#mobile-menu-btn');
    const mobileMenu = parentElement.querySelector('#mobile-menu');

    mobileMenuBtn?.addEventListener('click', () => {
      mobileMenu?.classList.toggle('hidden');
      mobileMenu?.classList.toggle('open');
    });

    // Close mobile menu on link click
    mobileMenu?.querySelectorAll('.mobile-menu__link').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
        mobileMenu.classList.remove('open');
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
        if (!parentElement.contains(e.target)) {
          mobileMenu.classList.add('hidden');
          mobileMenu.classList.remove('open');
        }
      }
    });
  };

  // Subscribe to queue updates
  try {
    unsubscribe = audioQueue.subscribe((queue) => {
      const newCount = queue.filter(item => item.status === 'pending' || item.status === 'processing').length;
      if (newCount !== queueCount) {
        queueCount = newCount;
        render();
      }
    });
  } catch (e) {
    // audioQueue might not be initialized
  }

  render();

  // Return cleanup function
  return () => {
    if (unsubscribe) unsubscribe();
  };
};

// Add header-specific styles
const headerStyles = document.createElement('style');
headerStyles.textContent = `
  .nav-link--with-badge {
    position: relative;
  }
  
  .nav-badge {
    position: absolute;
    top: -8px;
    right: -12px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    font-size: 0.65rem;
    font-weight: 700;
    background: var(--color-accent);
    color: white;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulse 2s infinite;
  }
  
  .mobile-only {
    display: none;
  }
  
  @media (max-width: 639px) {
    .mobile-only {
      display: flex;
    }
    
    .main-nav .nav-link {
      display: none;
    }
    
    .main-nav #theme-toggle {
      display: flex;
    }
  }
  
  .mobile-menu {
    position: absolute;
    top: var(--header-height);
    left: 0;
    right: 0;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    box-shadow: var(--shadow-lg);
    animation: menuSlideDown 0.3s var(--ease-out);
  }
  
  .mobile-menu.hidden {
    display: none;
  }
  
  .mobile-menu__nav {
    display: flex;
    flex-direction: column;
    padding: var(--space-4);
    gap: var(--space-2);
  }
  
  .mobile-menu__link {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    color: var(--color-text);
    text-decoration: none;
    border-radius: var(--radius-md);
    transition: background var(--duration-fast);
  }
  
  .mobile-menu__link:hover {
    background: var(--color-bg-subtle);
  }
  
  @keyframes menuSlideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  #theme-toggle {
    transition: transform 0.3s var(--ease-spring);
  }
`;
document.head.appendChild(headerStyles);

export default Header;
