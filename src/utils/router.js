
// Simple hash-based router
const routes = {
    '/': () => import('../pages/Home.js'),
    '/library': () => import('../pages/Library.js'),
    '/read': () => import('../pages/Read.js'),
    '/settings': () => import('../pages/Settings.js')
};

let rootElement = null;

export const initRouter = (root) => {
    rootElement = root;
    window.addEventListener('hashchange', handleRoute);

    // Handle initial route
    handleRoute();
};

const handleRoute = async () => {
    const hash = window.location.hash || '#/';
    const path = hash.slice(1).split('?')[0]; // simple path matching

    let pageModule;

    // Basic route matching
    if (routes[path]) {
        pageModule = await routes[path]();
    } else {
        // Default to home or 404
        pageModule = await routes['/']();
    }

    const Page = pageModule.default;

    // Clear root
    rootElement.innerHTML = '';

    // Render page
    Page(rootElement);

    // Update active states in navigation
    updateActiveLinks(hash);
};

export const navigate = (path) => {
    window.location.hash = path;
};

const updateActiveLinks = (hash) => {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        const linkHash = link.getAttribute('href');
        if (linkHash === hash || (hash === '' && linkHash === '#/')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
};
