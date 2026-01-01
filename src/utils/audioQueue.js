/**
 * Audio Queue Manager - Simplified for Whole-Story TTS
 * 
 * Instead of queuing individual sentences, we now queue entire stories
 * and generate one audio file per story. This reduces API calls from
 * ~10+ per story to just 1, avoiding rate limit issues.
 */

import { generateSpeech } from '../services/api.js';

const CACHE_NAME = 'nihongo-audio-v2';
const STORAGE_KEY = 'nihongo_audio_queue';

class AudioQueueManager {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.subscribers = new Set();

        // Load persisted queue
        this.loadQueue();

        // Start processing if items exist
        if (this.queue.length > 0) {
            this.processQueue();
        }
    }

    /**
     * Load queue from localStorage
     */
    loadQueue() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                this.queue = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Failed to load audio queue:', e);
            this.queue = [];
        }
    }

    /**
     * Save queue to localStorage
     */
    saveQueue() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
        } catch (e) {
            console.warn('Failed to save audio queue:', e);
        }
    }

    /**
     * Notify all subscribers of queue changes
     */
    notify() {
        this.subscribers.forEach(fn => {
            try {
                fn([...this.queue]);
            } catch (e) {
                console.error('Subscriber error:', e);
            }
        });
    }

    /**
     * Subscribe to queue updates
     * @param {Function} callback - Called with queue array on changes
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        this.subscribers.add(callback);
        // Immediately call with current state
        callback([...this.queue]);
        return () => this.subscribers.delete(callback);
    }

    /**
     * Get current queue state
     * @returns {Array} Copy of queue
     */
    getQueue() {
        return [...this.queue];
    }

    /**
     * Enqueue a story for TTS generation
     * Combines all segments into one text for single API call
     * @param {Object} story - Story object with content array
     */
    enqueueStory(story) {
        if (!story?.id || !story?.content?.length) {
            console.warn('Invalid story for audio queue');
            return;
        }

        // Check if already queued
        if (this.queue.some(item => item.storyId === story.id)) {
            console.log('Story already in queue:', story.id);
            return;
        }

        // Combine all Japanese text into one
        const fullText = story.content
            .map(segment => segment.jp)
            .join('\n\n');

        // Add to queue
        this.queue.push({
            storyId: story.id,
            storyTitle: story.titleEN || story.titleJP || 'Untitled',
            text: fullText,
            segmentCount: story.content.length,
            status: 'pending',
            addedAt: Date.now()
        });

        this.saveQueue();
        this.notify();
        this.processQueue();
    }

    /**
     * Process the queue - one story at a time
     */
    async processQueue() {
        if (this.isProcessing) return;

        const pending = this.queue.find(item => item.status === 'pending');
        if (!pending) return;

        this.isProcessing = true;
        pending.status = 'processing';
        this.saveQueue();
        this.notify();

        try {
            console.log(`Generating audio for: ${pending.storyTitle}`);

            // Generate audio for entire story
            const audioBlob = await generateSpeech(pending.text);

            if (audioBlob) {
                // Cache the audio
                const cache = await caches.open(CACHE_NAME);
                const cacheKey = `story-audio-${pending.storyId}`;
                await cache.put(
                    new Request(cacheKey),
                    new Response(audioBlob, {
                        headers: { 'Content-Type': 'audio/wav' }
                    })
                );

                pending.status = 'completed';
                console.log(`Audio cached for: ${pending.storyTitle}`);
            } else {
                pending.status = 'error';
                pending.error = 'No audio data received';
            }
        } catch (error) {
            console.error('Audio generation failed:', error);
            pending.status = 'error';
            pending.error = error.message;
        }

        this.saveQueue();
        this.notify();
        this.isProcessing = false;

        // Process next item after delay (rate limiting)
        const nextPending = this.queue.find(item => item.status === 'pending');
        if (nextPending) {
            // Wait 30 seconds between requests for rate limiting
            setTimeout(() => this.processQueue(), 30000);
        }
    }

    /**
     * Clear all pending items from queue
     */
    clearQueue() {
        this.queue = this.queue.filter(item => item.status === 'completed');
        this.saveQueue();
        this.notify();
    }

    /**
     * Remove a specific story from queue
     * @param {string} storyId - Story ID to remove
     */
    removeStory(storyId) {
        this.queue = this.queue.filter(item => item.storyId !== storyId);
        this.saveQueue();
        this.notify();
    }

    /**
     * Retry failed items
     */
    retryFailed() {
        this.queue.forEach(item => {
            if (item.status === 'error') {
                item.status = 'pending';
                delete item.error;
            }
        });
        this.saveQueue();
        this.notify();
        this.processQueue();
    }
}

// Export singleton instance
export const audioQueue = new AudioQueueManager();
