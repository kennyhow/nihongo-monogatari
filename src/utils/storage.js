const STORAGE_KEYS = {
    THEME: 'nihongo_theme',
    PROGRESS: 'nihongo_progress', // { [storyId]: { completed: boolean, scrollPos: number } }
    SETTINGS: 'nihongo_settings'  // { fontSize: 'medium', showFurigana: true, viewMode: 'side-by-side' }
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
