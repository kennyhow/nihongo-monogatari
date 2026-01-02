const STORAGE_KEYS = {
    THEME: 'nihongo_theme',
    PROGRESS: 'nihongo_progress', // { [storyId]: { completed: boolean, scrollPos: number } }
    SETTINGS: 'nihongo_settings',  // { fontSize: 'medium', showFurigana: true, viewMode: 'side-by-side' }
    API_KEYS: 'nihongo_api_keys'  // { google: string, pollinations: string }
};

import { supabase, getSession } from './supabase.js';
import { toast } from '../components/Toast.js';

/**
 * @typedef {import('../types.js').UserSettings} UserSettings
 * @typedef {import('../types.js').Story} Story
 * @typedef {import('../types.js').StoryProgress} StoryProgress
 * @typedef {import('../types.js').ApiKeys} ApiKeys
 */

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
/**
 * Get user settings from localStorage
 * @returns {UserSettings} User settings object with defaults applied
 */
export const getSettings = () => {
    const defaults = { fontSize: 'medium', showFurigana: true, viewMode: 'side-by-side' };
    try {
        return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}') };
    } catch {
        return defaults;
    }
};

/**
 * Save user settings to localStorage and sync to cloud
 * @param {Partial<UserSettings>} settings - Settings to merge and save
 * @returns {Promise<void>}
 */
export const saveSettings = async (settings) => {
    const current = getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));

    // Cloud Sync
    const session = await getSession();
    if (session) {
        await supabase
            .from('settings')
            .upsert({
                user_id: session.user.id,
                preferences: updated,
                updated_at: new Date().toISOString()
            });
    }
};

// API Keys
/**
 * Get API keys from localStorage
 * @returns {ApiKeys} API keys object
 */
export const getApiKeys = () => {
    const defaults = { google: '', pollinations: '' };
    try {
        return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.API_KEYS) || '{}') };
    } catch {
        return defaults;
    }
};

/**
 * Save API keys to localStorage
 * @param {ApiKeys} keys - API keys to save
 */
export const saveApiKeys = (keys) => {
    localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(keys));
};

// Stories
/**
 * Get all stored stories from localStorage
 * @returns {Story[]} Array of story objects
 */
export const getStoredStories = () => {
    try {
        return JSON.parse(localStorage.getItem('nihongo_stories') || '[]');
    } catch {
        return [];
    }
};

/**
 * Add a new story to storage and sync to cloud
 * @param {Story} story - Story object to add
 * @returns {Promise<void>}
 */
export const addStory = async (story) => {
    const stories = getStoredStories();
    stories.unshift(story);
    localStorage.setItem('nihongo_stories', JSON.stringify(stories));

    // Cloud Sync
    const session = await getSession();
    if (session) {
        await supabase
            .from('stories')
            .upsert({
                id: story.id,
                user_id: session.user.id,
                content: story,
                created_at: new Date().toISOString()
            });
    }
};

/**
 * Delete a story from storage and cloud
 * @param {string} id - Story ID to delete
 * @returns {Promise<void>}
 */
export const deleteStory = async (id) => {
    const stories = getStoredStories();
    const filtered = stories.filter(s => s.id !== id);
    localStorage.setItem('nihongo_stories', JSON.stringify(filtered));

    // Cloud Sync
    const session = await getSession();
    if (session) {
        await supabase.from('stories').delete().eq('id', id);
        await supabase.from('progress').delete().eq('story_id', id);
    }

    // Cleanup progress
    const allProgress = getAllProgress();
    if (allProgress[id]) {
        delete allProgress[id];
        localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(allProgress));
    }
};

// Progress
/**
 * Save reading progress for a story
 * Automatically updates the lastRead timestamp
 * @param {string} storyId - Story ID to save progress for
 * @param {Partial<StoryProgress>} data - Progress data to update
 * @returns {Promise<void>}
 */
export const saveProgress = async (storyId, data) => {
    const allProgress = getAllProgress();
    const updated = { ...allProgress[storyId], ...data, lastRead: Date.now() };
    allProgress[storyId] = updated;
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(allProgress));

    // Cloud Sync
    const session = await getSession();
    if (session) {
        try {
            await supabase
                .from('progress')
                .upsert({
                    story_id: storyId,
                    user_id: session.user.id,
                    scroll_percent: updated.scrollPercent || 0,
                    completed: updated.completed || false,
                    updated_at: new Date().toISOString()
                });
        } catch (err) {
            // This can happen if the story hasn't finished syncing yet
            console.warn('Progress sync skipped (story may not be in cloud yet)');
        }
    }
};

/**
 * Get reading progress for a specific story
 * @param {string} storyId - Story ID
 * @returns {StoryProgress|null} Progress object or null if not found
 */
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

/**
 * Wipe all non-settings data (local + cloud) for the current user
 * This deletes: stories, progress, cached images, cached audio
 * This preserves: settings, theme, API keys
 */
export const wipeAllData = async () => {
    try {
        const session = await getSession();
        const userId = session?.user.id;

        // === WIPE LOCAL DATA ===

        // 1. Clear stories from localStorage
        localStorage.removeItem('nihongo_stories');

        // 2. Clear progress from localStorage
        localStorage.removeItem(STORAGE_KEYS.PROGRESS);

        // 3. Clear image cache from Cache API
        const imageCacheName = 'nihongo-images-v1';
        await caches.delete(imageCacheName);

        // 4. Clear all audio caches
        const allCacheNames = await caches.keys();
        const audioCacheNames = allCacheNames.filter(name => name.includes('audio'));
        await Promise.all(audioCacheNames.map(name => caches.delete(name)));

        // === WIPE CLOUD DATA (if authenticated) ===

        if (session && supabase) {
            // 5. Delete all stories for this user
            const { error: storiesError } = await supabase
                .from('stories')
                .delete()
                .eq('user_id', userId);

            if (storiesError) console.warn('Failed to delete stories from cloud:', storiesError);

            // 6. Delete all progress for this user
            const { error: progressError } = await supabase
                .from('progress')
                .delete()
                .eq('user_id', userId);

            if (progressError) console.warn('Failed to delete progress from cloud:', progressError);

            // 7. Delete all images from the image-cache bucket for this user
            const { data: files, error: listError } = await supabase.storage
                .from('image-cache')
                .list(userId, { limit: 1000 });

            if (!listError && files && files.length > 0) {
                const filePaths = files.map(file => `${userId}/${file.name}`);
                const { error: deleteError } = await supabase.storage
                    .from('image-cache')
                    .remove(filePaths);

                if (deleteError) console.warn('Failed to delete some images from cloud:', deleteError);
            }
        }

        return { success: true };
    } catch (err) {
        console.error('Wipe failed:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Full Sync from Cloud
 */
export const syncAll = async () => {
    const session = await getSession();
    if (!session) return;

    try {
        // 1. Sync Stories
        const { data: remoteStories } = await supabase
            .from('stories')
            .select('*');

        if (remoteStories) {
            const localStories = getStoredStories();

            // 1a. Merge Remote -> Local (stories not in local)
            const newStories = remoteStories
                .map(s => s.content)
                .filter(rs => !localStories.find(ls => ls.id === rs.id));
            if (newStories.length > 0) {
                localStorage.setItem('nihongo_stories', JSON.stringify([...newStories, ...localStories]));
            }

            // 1b. Merge Local -> Remote (stories not in remote)
            const missingRemote = localStories.filter(ls => !remoteStories.find(rs => rs.id === ls.id));
            if (missingRemote.length > 0) {
                await Promise.all(missingRemote.map(story =>
                    supabase.from('stories').upsert({
                        id: story.id,
                        user_id: session.user.id,
                        content: story,
                        created_at: new Date().toISOString()
                    })
                ));
            }
        }

        // 2. Sync Progress
        const { data: remoteProgress } = await supabase
            .from('progress')
            .select('*');

        if (remoteProgress) {
            const localProgress = getAllProgress();

            // 2a. Remote -> Local
            remoteProgress.forEach(rp => {
                if (!localProgress[rp.story_id] || rp.updated_at > new Date(localProgress[rp.story_id].lastRead).toISOString()) {
                    localProgress[rp.story_id] = {
                        completed: rp.completed,
                        scrollPercent: rp.scroll_percent,
                        lastRead: new Date(rp.updated_at).getTime()
                    };
                }
            });

            // 2b. Local -> Remote (Parallel)
            const pushPromises = Object.entries(localProgress).map(async ([storyId, prog]) => {
                const isRemote = remoteProgress.find(rp => rp.story_id === storyId);
                const storyExistsInCloud = remoteStories.find(rs => rs.id === storyId);

                // If story doesn't exist in cloud, we can't sync progress yet due to FK constraint
                if (!storyExistsInCloud) return;

                // If not in remote OR local is newer (lastRead vs updated_at)
                if (!isRemote || prog.lastRead > new Date(isRemote.updated_at).getTime()) {
                    return supabase.from('progress').upsert({
                        story_id: storyId,
                        user_id: session.user.id,
                        scroll_percent: prog.scrollPercent || 0,
                        completed: prog.completed || false,
                        updated_at: new Date(prog.lastRead || Date.now()).toISOString()
                    });
                }
            });
            await Promise.all(pushPromises.filter(p => p !== undefined));

            localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(localProgress));
        }

        // 3. Sync Settings
        const { data: remoteSettings } = await supabase
            .from('settings')
            .select('preferences')
            .maybeSingle();

        if (remoteSettings) {
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(remoteSettings.preferences));
        } else {
            // No remote settings, push local settings to cloud
            const localSettings = getSettings();
            await supabase.from('settings').upsert({
                user_id: session.user.id,
                preferences: localSettings,
                updated_at: new Date().toISOString()
            });
        }

        return true;
    } catch (err) {
        console.error('Sync failed:', err);
        return false;
    }
};
