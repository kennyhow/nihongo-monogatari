import StoryCard from '../components/StoryCard.js';
import { sampleStories } from '../data/stories.js';

const Home = (parentElement) => {
    // Get recent stories (just the first 2 for now as a mock)
    const recentStories = sampleStories.slice(0, 2);

    const html = `
    <section class="hero" style="text-align: center; padding: 4rem 1rem; margin-bottom: 2rem;">
      <h1 style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--color-primary);">
        Welcome to 日本語物語
      </h1>
      <p style="font-size: 1.25rem; color: var(--color-text-muted); max-width: 600px; margin: 0 auto 2rem;">
        Immerse yourself in Japanese stories. Learn naturally through context, culture, and reading.
      </p>
      <a href="#/library" class="btn" style="padding: 0.75rem 2rem; font-size: 1.125rem;">Start Reading</a>
    </section>
    
    <section class="recent-stories">
      <h2 style="margin-bottom: 1.5rem; border-bottom: 2px solid var(--color-primary-light); padding-bottom: 0.5rem; display: inline-block;">
        Featured Stories
      </h2>
      
      <div class="story-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2rem;">
        ${recentStories.map(story => StoryCard(story)).join('')}
      </div>
    </section>
  `;

    parentElement.innerHTML = html;
};

export default Home;
