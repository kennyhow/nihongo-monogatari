/**
 * Image Storage Utility
 * Uses the Cache API to store and retrieve generated images.
 */

const IMAGE_CACHE_NAME = 'nihongo-images-v1';

/**
 * Get a cached image for a story segment
 * @param {string} storyId 
 * @param {number} segmentIndex 
 * @returns {Promise<string|null>} Object URL of the cached image or null
 */
export const getCachedImage = async (storyId, segmentIndex) => {
    try {
        const cache = await caches.open(IMAGE_CACHE_NAME);
        const cacheKey = `/images/${storyId}/segment-${segmentIndex}`;
        const response = await cache.match(cacheKey);

        if (response) {
            const blob = await response.blob();
            return URL.createObjectURL(blob);
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
        const cache = await caches.open(IMAGE_CACHE_NAME);
        const cacheKey = `/images/${storyId}/segment-${segmentIndex}`;
        const response = new Response(blob, {
            headers: { 'Content-Type': blob.type }
        });
        await cache.put(cacheKey, response);
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
