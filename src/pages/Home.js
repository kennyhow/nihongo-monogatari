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

// Add home-specific styles
const homeStyles = document.createElement('style');
homeStyles.textContent = `
  .home-page {
    padding-bottom: var(--space-16);
  }

  /* Hero Section */
  .hero {
    position: relative;
    text-align: center;
    padding: var(--space-12) var(--space-4);
    margin-bottom: var(--space-8);
    overflow: hidden;
  }
  
  .hero__content {
    position: relative;
    z-index: 1;
    max-width: 700px;
    margin: 0 auto;
  }
  
  .hero__title {
    margin-bottom: var(--space-6);
  }
  
  .hero__title-jp {
    display: block;
    font-family: var(--font-display);
    font-size: var(--text-4xl);
    color: var(--color-primary);
    margin-bottom: var(--space-2);
    letter-spacing: 0.05em;
  }
  
  @media (min-width: 768px) {
    .hero__title-jp {
      font-size: 3.5rem;
    }
  }
  
  .hero__title-en {
    display: block;
    font-family: var(--font-en);
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--color-text-muted);
  }
  
  .hero__description {
    font-size: var(--text-lg);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-8);
    line-height: var(--leading-relaxed);
  }
  
  .hero__actions {
    display: flex;
    gap: var(--space-4);
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .hero__decoration {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  
  .hero__circle {
    position: absolute;
    border-radius: 50%;
    opacity: 0.1;
  }
  
  .hero__circle--1 {
    width: 400px;
    height: 400px;
    background: var(--color-primary);
    top: -100px;
    right: -100px;
  }
  
  .hero__circle--2 {
    width: 300px;
    height: 300px;
    background: var(--color-secondary);
    bottom: -50px;
    left: -50px;
  }
  
  .hero__kanji {
    position: absolute;
    font-family: var(--font-display);
    font-size: 12rem;
    color: var(--color-primary);
    opacity: 0.03;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    white-space: nowrap;
  }

  /* Stats Bar */
  .stats-bar {
    display: flex;
    justify-content: center;
    gap: var(--space-8);
    padding: var(--space-6) var(--space-4);
    margin-bottom: var(--space-10);
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-border);
  }
  
  .stat {
    text-align: center;
  }
  
  .stat__value {
    display: block;
    font-size: var(--text-3xl);
    font-weight: 700;
    color: var(--color-primary);
  }
  
  .stat__label {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  /* Sections */
  .section {
    margin-bottom: var(--space-12);
  }
  
  .section__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-6);
  }
  
  .section__title {
    font-size: var(--text-2xl);
    font-family: var(--font-display);
  }

  /* CTA Section */
  .cta-section {
    max-width: 600px;
    margin: 0 auto;
  }
  
  .cta-card {
    text-align: center;
    background: linear-gradient(135deg, var(--color-primary-light), var(--color-secondary-light));
    border: none;
  }
  
  .cta-card__title {
    font-size: var(--text-2xl);
    margin-bottom: var(--space-3);
  }
  
  .cta-card__description {
    color: var(--color-text-secondary);
    margin-bottom: var(--space-6);
  }
`;
document.head.appendChild(homeStyles);

export default Home;
