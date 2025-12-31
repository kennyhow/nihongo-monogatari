
import { generateSpeech } from '../services/api.js';

const QUEUE_STORAGE_KEY = 'nihongo_audio_queue';
const CACHE_NAME = 'nihongo-audio-v1';
const PROCESS_INTERVAL = 25000; // 25 seconds to be safe (limit ~3/min)

class AudioQueueManager {
    constructor() {
        this.queue = this.loadQueue();
        this.isProcessing = false;
        this.listeners = [];

        // Start processing loop
        this.processLoop();
    }

    loadQueue() {
        try {
            return JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]');
        } catch {
            return [];
        }
    }

    saveQueue() {
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
        this.notifyListeners();
    }

    // Add a story's segments to queue
    enqueueStory(story) {
        let addedCount = 0;
        story.content.forEach((segment, index) => {
            const id = `${story.id}-${index}`;
            // Check if already in queue or (ideally) checked cache
            // We can't check async cache easily here synchronously, but duplication in queue is handled by processing check
            if (!this.queue.find(item => item.id === id)) {
                this.queue.push({
                    id,
                    storyId: story.id,
                    storyTitle: story.titleEN,
                    segmentIndex: index,
                    text: segment.jp,
                    status: 'pending', // pending, processing, completed, error
                    addedAt: Date.now()
                });
                addedCount++;
            }
        });
        this.saveQueue();
        console.log(`Enqueued ${addedCount} segments for ${story.titleEN}`);
    }

    removeFromQueue(id) {
        this.queue = this.queue.filter(item => item.id !== id);
        this.saveQueue();
    }

    clearQueue() {
        this.queue = [];
        this.saveQueue();
    }

    // Process one item
    async processNext() {
        if (this.queue.length === 0) return;

        // Find first pending
        const item = this.queue.find(i => i.status === 'pending');
        if (!item) return;

        console.log(`Processing queue item: ${item.id}`);
        item.status = 'processing';
        this.saveQueue();

        try {
            // Check cache first to avoid API call if exists
            const cache = await caches.open(CACHE_NAME);
            const cacheKey = new Request(`https://tts-cache/${encodeURIComponent(item.text)}`);
            const cachedResponse = await cache.match(cacheKey);

            if (cachedResponse) {
                console.log('Item already in cache, removing from queue');
                this.removeFromQueue(item.id);
                return;
            }

            // Generate
            let blob;
            try {
                blob = await generateSpeech(item.text);
            } catch (err) {
                const errorMessage = err.toString();
                const retryMatch = errorMessage.match(/Please retry in ([0-9.]+)s/);
                if (retryMatch) {
                    const waitSeconds = parseFloat(retryMatch[1]);
                    console.warn(`TTS Rate Limit hit. Pausing queue for ${waitSeconds}s...`);

                    // Wait for the requested time + small buffer
                    await new Promise(resolve => setTimeout(resolve, (waitSeconds + 1) * 1000));

                    // Reset item status to pending so it gets retried next loop
                    item.status = 'pending';
                    this.saveQueue();
                    return;
                }
                // If not a rate limit error we recognise, throw it to be handled by outer catch
                throw err;
            }

            if (blob) {
                await cache.put(cacheKey, new Response(blob));
                this.removeFromQueue(item.id);
                console.log('Queue item processed and cached');
            } else {
                console.error('Failed to generate audio for queue item (Empty Blob)');
                item.status = 'error';
                item.errorCount = (item.errorCount || 0) + 1;

                if (item.errorCount > 3) {
                    this.removeFromQueue(item.id);
                } else {
                    item.status = 'pending'; // Retry next cycle
                }
                this.saveQueue();
            }

        } catch (error) {
            console.error('Queue processing error', error);
            item.status = 'error';
            this.saveQueue();
        }
    }

    async processLoop() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        // Endless loop with delay
        while (true) {
            await this.processNext();

            // Notify changes (e.g. status updates)
            this.notifyListeners();

            // Wait interval
            await new Promise(resolve => setTimeout(resolve, PROCESS_INTERVAL));
        }
    }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    notifyListeners() {
        this.listeners.forEach(cb => cb(this.queue));
    }

    getQueue() {
        return this.queue;
    }
}

// Singleton
export const audioQueue = new AudioQueueManager();
