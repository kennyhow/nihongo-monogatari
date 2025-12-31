import { sampleStories } from '../data/stories.js';
import Reader from '../components/Reader.js';
import { getStoryProgress, getStoredStories } from '../utils/storage.js';

const Read = (parentElement) => {
    // Parse Query Params to get Story ID
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const storyId = urlParams.get('id');

    const allStories = [...getStoredStories(), ...sampleStories];
    const story = allStories.find(s => s.id === storyId);

    if (!story) {
        parentElement.innerHTML = `
      <div style="text-align: center; padding: 4rem;">
        <h2>Story not found</h2>
        <a href="#/library" class="btn" style="margin-top: 1rem;">Back to Library</a>
      </div>
    `;
        return;
    }

    const handleComplete = () => {
        // Show completion modal or navigate
        alert('Story Completed! おめでとう!');
        window.location.hash = '#/library';
    };

    const progress = getStoryProgress(storyId);

    // Clear container
    parentElement.innerHTML = '';

    // Mount Reader
    const readerElement = Reader({
        story,
        initialProgress: progress,
        onComplete: handleComplete
    });

    parentElement.appendChild(readerElement);
};

export default Read;
