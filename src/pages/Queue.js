
import { audioQueue } from '../utils/audioQueue.js';

const Queue = (parentElement) => {

    // Subscribe to updates
    const unsubscribe = audioQueue.subscribe((queue) => {
        render(queue);
    });

    const render = (queue) => {
        // Group by Story
        const grouped = {};
        queue.forEach(item => {
            if (!grouped[item.storyTitle]) grouped[item.storyTitle] = [];
            grouped[item.storyTitle].push(item);
        });

        // Calculate stats
        const total = queue.length;
        const processing = queue.find(i => i.status === 'processing');
        const nextTime = total * 25; // seconds roughly

        const html = `
      <div class="container animate-fade-in" style="max-width: 800px;">
        <div class="header" style="margin-bottom: 2rem;">
            <h1>Audio Processing Queue 🎧</h1>
            <p style="color: var(--color-text-muted);">
                Generates high-quality audio in the background (~2 requests/minute).
            </p>
             <div style="
                margin-top: 1rem; padding: 1rem; 
                background: var(--color-surface); border-radius: var(--radius-md);
                border: 1px solid var(--color-border);
                display: flex; gap: 2rem;
             ">
                <div>
                    <strong>Queue Length:</strong> ${total} segments
                </div>
                <div>
                    <strong>Est. Time:</strong> ~${Math.ceil(nextTime / 60)} mins
                </div>
                <div>
                    <strong>Status:</strong> ${processing ? 'Processing... 🟢' : (total > 0 ? 'Waiting...' : 'Idle 💤')}
                </div>
             </div>
        </div>

        ${total === 0 ? `
            <div style="text-align: center; padding: 4rem; color: var(--color-text-muted);">
                <p>Queue is empty. Create a story to start generating audio!</p>
                <a href="#/library" class="btn" style="margin-top: 1rem;">Go to Library</a>
            </div>
        ` : ''}

        <div class="queue-list">
            ${Object.keys(grouped).map(title => `
                <div class="card" style="margin-bottom: 2rem;">
                    <h3 style="margin-bottom: 1rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.5rem;">
                        ${title}
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        ${grouped[title].map(item => `
                            <div style="
                                display: flex; justify-content: space-between; align-items: center;
                                padding: 0.5rem; background: rgba(0,0,0,0.02); border-radius: 4px;
                            ">
                                <span style="font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">
                                    Subject ${item.segmentIndex + 1}: ${item.text.substring(0, 30)}...
                                </span>
                                <span class="badge" style="
                                    font-size: 0.75rem; padding: 0.2rem 0.5rem;
                                    ${item.status === 'processing' ? 'background: #dbeafe; color: #1e40af;' : ''}
                                    ${item.status === 'pending' ? 'background: #f3f4f6; color: #374151;' : ''}
                                    ${item.status === 'error' ? 'background: #fee2e2; color: #991b1b;' : ''}
                                ">
                                    ${item.status}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>

        ${total > 0 ? `
            <div style="margin-top: 2rem; text-align: center;">
                <button id="clear-queue-btn" style="
                    background: transparent; border: 1px solid var(--color-border); color: #ef4444;
                    padding: 0.5rem 1rem; border-radius: var(--radius-md); cursor: pointer;
                ">Clear Queue</button>
            </div>
        ` : ''}
      </div>
    `;

        parentElement.innerHTML = html;

        if (total > 0) {
            document.getElementById('clear-queue-btn').addEventListener('click', () => {
                if (confirm('Clear all pending audio generations?')) {
                    audioQueue.clearQueue();
                    render([]);
                }
            });
        }
    };

    render(audioQueue.getQueue());

    // Cleanup logic not strictly available in this simple router, 
    // but we return nothing so it's fine. 
    // Ideally we would return a cleanup function to the router to call...
    // But our basic router doesn't support unmount hooks.
    // The subscription will leak if we navigate away.
    // I should create a cleanup mechanism.

    // Quick fix: MutationObserver to detect removal?
    const observer = new MutationObserver((mutations) => {
        if (!document.body.contains(parentElement)) {
            unsubscribe();
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
};

export default Queue;
