const STORAGE_KEYS = {
    THEME: 'nihongo_theme',
    PROGRESS: 'nihongo_progress', // { [storyId]: { completed: boolean, scrollPos: number } }
    SETTINGS: 'nihongo_settings',  // { fontSize: 'medium', showFurigana: true, viewMode: 'side-by-side' }
    API_KEYS: 'nihongo_api_keys'  // { google: string, pollinations: string }
};

// Theme
export const getTheme = () => {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
};

export const toggleTheme = () => {
    const current = getTheme();
    const next = current === 'light' ? 'dark' : 'light';
    localStorage.setItem(STORAGE_KEYS.THEME, next);
    document.documentElement.setAttribute('data-theme', next);
    return next;
};

// Settings
export const getSettings = () => {
    const defaults = { fontSize: 'medium', showFurigana: true, viewMode: 'side-by-side' };
    try {
        return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}') };
    } catch {
        return defaults;
    }
};

export const saveSettings = (settings) => {
    const current = getSettings();
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ ...current, ...settings }));
};

// API Keys
export const getApiKeys = () => {
    const defaults = { google: '', pollinations: '' };
    try {
        return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.API_KEYS) || '{}') };
    } catch {
        return defaults;
    }
};

export const saveApiKeys = (keys) => {
    localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(keys));
};

// Stories
export const getStoredStories = () => {
    try {
        return JSON.parse(localStorage.getItem('nihongo_stories') || '[]');
    } catch {
        return [];
    }
};

export const addStory = (story) => {
    const stories = getStoredStories();
    stories.unshift(story);
    localStorage.setItem('nihongo_stories', JSON.stringify(stories));
};

export const deleteStory = (id) => {
    const stories = getStoredStories();
    const filtered = stories.filter(s => s.id !== id);
    localStorage.setItem('nihongo_stories', JSON.stringify(filtered));

    // Cleanup progress
    const allProgress = getAllProgress();
    if (allProgress[id]) {
        delete allProgress[id];
        localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(allProgress));
    }
};

// Progress
export const saveProgress = (storyId, data) => {
    const allProgress = getAllProgress();
    allProgress[storyId] = { ...allProgress[storyId], ...data, lastRead: Date.now() };
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(allProgress));
};

export const getStoryProgress = (storyId) => {
    const all = getAllProgress();
    return all[storyId] || null;
};

const getAllProgress = () => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESS) || '{}');
    } catch {
        return {};
    }
};
