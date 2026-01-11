/**
 * Home Page
 * Hero section, featured stories, and quick actions
 */

import StoryCard from '../components/StoryCard.js';
import { sampleStories } from '../data/stories.js';
import { getStoredStories, getStoryProgress } from '../utils/storage.js';

const Home = parentElement => {
  // Get stories data
  const allStories = [...getStoredStories(), ...sampleStories];

  // Find in-progress stories
  const inProgressStories = allStories
    .filter(story => {
      const progress = getStoryProgress(story.id);
      return progress && !progress.completed;
    })
    .slice(0, 2);

  // Featured stories (first 3 sample stories)
  const featuredStories = sampleStories.slice(0, 3);

  // Stats
  const totalRead = allStories.filter(s => getStoryProgress(s.id)?.completed).length;
  const generatedCount = getStoredStories().length;

  const html = `
    <div class="home-page">
      <!-- Hero Section -->
      <section class="hero">
        <div class="hero__content">
          <h1 class="hero__title">
            <span class="hero__title-jp">日本語物語</span>
            <span class="hero__title-en">Learn Japanese Through Stories</span>
          </h1>
          <p class="hero__description">
            Immerse yourself in AI-generated Japanese stories with side-by-side translations, 
            furigana readings, and high-quality audio. Learn naturally through context and culture.
          </p>
          <div class="hero__actions">
            <a href="#/library" class="btn btn--lg">
              📚 Browse Library
            </a>
            <a href="#/kana" class="btn btn--lg btn--secondary">
              🔤 Kana Chart
            </a>
          </div>
        </div>
        
        <div class="hero__decoration">
          <div class="hero__circle hero__circle--1"></div>
          <div class="hero__circle hero__circle--2"></div>
          <div class="hero__kanji">物語</div>
        </div>
      </section>

      <!-- Quick Stats -->
      <section class="stats-bar">
        <div class="stat">
          <span class="stat__value">${totalRead}</span>
          <span class="stat__label">Stories Read</span>
        </div>
        <div class="stat">
          <span class="stat__value">${generatedCount}</span>
          <span class="stat__label">AI Generated</span>
        </div>
        <div class="stat">
          <span class="stat__value">${allStories.length}</span>
          <span class="stat__label">Available</span>
        </div>
      </section>

      ${
        inProgressStories.length > 0
          ? `
        <!-- Continue Reading Section -->
        <section class="section">
          <div class="section__header">
            <h2 class="section__title">📖 Continue Reading</h2>
            <a href="#/library" class="btn btn--ghost btn--sm">View All →</a>
          </div>
          <div class="story-grid">
            ${inProgressStories.map(story => StoryCard(story)).join('')}
          </div>
        </section>
      `
          : ''
      }

      <!-- Featured Stories Section -->
      ${
        featuredStories.length > 0
          ? `
        <section class="section">
          <div class="section__header">
            <h2 class="section__title">⭐ Featured Stories</h2>
            <a href="#/library" class="btn btn--ghost btn--sm">View All →</a>
          </div>
          <div class="story-grid">
            ${featuredStories.map(story => StoryCard(story)).join('')}
          </div>
        </section>
      `
          : ''
      }

      <!-- Call to Action -->
      <section class="cta-section">
        <div class="cta-card card">
          <h2 class="cta-card__title">Create Your Own Story</h2>
          <p class="cta-card__description">
            Use AI to generate a custom story about any topic you're interested in. 
            Perfect for focused vocabulary practice!
          </p>
          <a href="#/library" class="btn">✨ Generate Story</a>
        </div>
      </section>
    </div>
  `;

  parentElement.innerHTML = html;
};

// Styles now in external CSS: src/styles/pages/home.css

export default Home;
