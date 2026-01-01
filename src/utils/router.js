/**
 * Enhanced Hash-based Router with Lifecycle Support
 */

import { runCleanups } from './componentBase.js';

// Route definitions with lazy loading
const routes = {
    '/': () => import('../pages/Home.js'),
    '/library': () => import('../pages/Library.js'),
    '/read': () => import('../pages/Read.js'),
    '/queue': () => import('../pages/Queue.js'),
    '/settings': () => import('../pages/Settings.js'),
    '/kana': () => import('../pages/KanaChart.js')
};

let rootElement = null;
let currentCleanup = null;

/**
 * Initialize the router
 * @param {HTMLElement} root - Root element to render pages into
 */
export const initRouter = (root) => {
    rootElement = root;
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
};

/**
 * Navigate to a new route
 * @param {string} path - Path to navigate to (e.g., '/library')
 */
export const navigate = (path) => {
    window.location.hash = path;
};

/**
 * Get current route info
 * @returns {Object} { path, query }
 */
export const getRouteInfo = () => {
    const hash = window.location.hash || '#/';
    const [path, queryString] = hash.slice(1).split('?');
    const query = new URLSearchParams(queryString || '');
    return { path, query };
};

/**
 * Handle route changes
 */
const handleRoute = async () => {
    const { path } = getRouteInfo();

    // Run cleanups from previous page
    if (rootElement) {
        runCleanups(rootElement);
    }
    if (currentCleanup) {
        try {
            currentCleanup();
        } catch (e) {
            console.error('Route cleanup error:', e);
        }
        currentCleanup = null;
    }

    // Show loading state
    rootElement.innerHTML = `
    <div class="empty-state animate-fade-in">
      <div class="skeleton skeleton--card" style="max-width: 600px; margin: 0 auto;"></div>
    </div>
  `;

    // Load page module
    let pageModule;
    try {
        if (routes[path]) {
            pageModule = await routes[path]();
        } else {
            pageModule = await routes['/']();
        }
    } catch (error) {
        console.error('Failed to load page:', error);
        rootElement.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">❌</div>
        <h2 class="empty-state__title">Failed to load page</h2>
        <p class="empty-state__description">${error.message}</p>
        <a href="#/" class="btn">Go Home</a>
      </div>
    `;
        return;
    }

    const Page = pageModule.default;

    // Clear and prepare for new content
    rootElement.innerHTML = '';
    rootElement.classList.remove('animate-fade-in');

    // Force reflow for animation restart
    void rootElement.offsetWidth;
    rootElement.classList.add('animate-fade-in');

    // Render new page - pages can return a cleanup function
    const cleanup = Page(rootElement);
    if (typeof cleanup === 'function') {
        currentCleanup = cleanup;
    }

    // Update active nav links
    updateActiveLinks();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });
};

/**
 * Update active state on navigation links
 */
const updateActiveLinks = () => {
    const { path } = getRouteInfo();
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;

        const linkPath = href.startsWith('#') ? href.slice(1).split('?')[0] : href;
        const isActive = linkPath === path || (path === '' && linkPath === '/');
        link.classList.toggle('active', isActive);
    });
};
