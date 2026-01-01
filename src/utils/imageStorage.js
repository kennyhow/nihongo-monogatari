/**
 * Image Storage Utility
 * Uses the Cache API to store and retrieve generated images.
 */

const IMAGE_CACHE_NAME = 'nihongo-images-v1';

import { supabase, getSession } from './supabase.js';

/**
 * Get a cached image for a story segment
 * @param {string} storyId 
 * @param {number} segmentIndex 
 * @returns {Promise<string|null>} Object URL of the cached image or null
 */
export const getCachedImage = async (storyId, segmentIndex) => {
    try {
        // 1. Check Browser Cache
        const cache = await caches.open(IMAGE_CACHE_NAME);
        const cacheKey = `/images/${storyId}/segment-${segmentIndex}`;
        let response = await cache.match(cacheKey);

        if (response) {
            const blob = await response.blob();
            return URL.createObjectURL(blob);
        }

        // 2. Check Supabase Storage
        const session = await getSession();
        if (session) {
            const filePath = `${session.user.id}/${storyId}/segment-${segmentIndex}.png`;
            const { data, error } = await supabase.storage
                .from('image-cache')
                .download(filePath);

            if (data && !error) {
                // Save to local cache for next time
                await cacheImage(storyId, segmentIndex, data);
                return URL.createObjectURL(data);
            }
        }
    } catch (error) {
        console.warn('Image cache lookup failed:', error);
    }
    return null;
};

/**
 * Save an image to the cache
 * @param {string} storyId 
 * @param {number} segmentIndex 
 * @param {Blob} blob 
 * @returns {Promise<void>}
 */
export const cacheImage = async (storyId, segmentIndex, blob) => {
    try {
        // 1. Save to local browser cache
        const cache = await caches.open(IMAGE_CACHE_NAME);
        const cacheKey = `/images/${storyId}/segment-${segmentIndex}`;
        const response = new Response(blob, {
            headers: { 'Content-Type': blob.type || 'image/png' }
        });
        await cache.put(cacheKey, response);

        // 2. Upload to Supabase Storage
        const session = await getSession();
        if (session) {
            const filePath = `${session.user.id}/${storyId}/segment-${segmentIndex}.png`;
            await supabase.storage
                .from('image-cache')
                .upload(filePath, blob, { upsert: true });
        }
    } catch (error) {
        console.warn('Failed to cache image:', error);
    }
};

/**
 * Clear all cached images
 * @returns {Promise<boolean>}
 */
export const clearImageCache = async () => {
    try {
        return await caches.delete(IMAGE_CACHE_NAME);
    } catch (error) {
        console.error('Failed to clear image cache:', error);
        return false;
    }
};

/**
 * Get count of cached images
 * @returns {Promise<number>}
 */
export const getCachedImageCount = async () => {
    try {
        const cache = await caches.open(IMAGE_CACHE_NAME);
        const keys = await cache.keys();
        return keys.length;
    } catch {
        return 0;
    }
};
