/**
 * Generator Modal Component
 * AI-powered story creation with preview and loading states
 */

import { createStoryGenerationJob } from '../services/api.js';
import { toast } from './Toast.js';
import { storyTopics } from '../data/storyTopics.js';
import { createEventManager } from '../utils/componentBase.js';

/**
 * Create and show the story generator modal
 * @param {Object} options
 * @param {Function} options.onClose - Called when modal closes
 * @returns {HTMLElement} Modal overlay element
 */
const GeneratorModal = ({ onClose, onGenerate: _onGenerate }) => {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';
  overlay.innerHTML = `
    <div class="modal generator-modal">
      <div class="modal__header">
        <h2 class="modal__title">✨ Create New Story</h2>
        <button class="icon-btn modal__close" aria-label="Close">✕</button>
      </div>
      
      <form id="generator-form" class="modal__body">
        <div class="form-group">
          <label class="form-label" for="topic">
            Topic / Theme
            <span class="form-label__required">*</span>
          </label>
          <div class="input-with-action">
            <input
              type="text"
              id="topic"
              class="form-input"
              placeholder="e.g. A cat who loves sushi, A samurai's journey..."
              required
              maxlength="100"
            >
            <button type="button" id="random-topic-btn" class="icon-btn random-btn" title="Get random topic">
              🎲
            </button>
          </div>
          <div class="form-hint">What should the story be about?</div>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="instructions">
            Style / Instructions
            <span class="form-label__optional">(optional)</span>
          </label>
          <textarea 
            id="instructions" 
            class="form-textarea" 
            placeholder="e.g. Make it funny and whimsical, use casual speech, include food vocabulary..."
            maxlength="300"
          ></textarea>
          <div class="form-hint">Any specific style, tone, or vocabulary focus?</div>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="level">Difficulty Level (JLPT)</label>
          <div class="level-selector">
            <label class="level-option">
              <input type="radio" name="level" value="N5" checked>
              <span class="level-option__card">
                <span class="level-option__emoji">🌱</span>
                <span class="level-option__name">N5</span>
                <span class="level-option__desc">Basic</span>
              </span>
            </label>
            <label class="level-option">
              <input type="radio" name="level" value="N4">
              <span class="level-option__card">
                <span class="level-option__emoji">🌿</span>
                <span class="level-option__name">N4</span>
                <span class="level-option__desc">Elementary</span>
              </span>
            </label>
            <label class="level-option">
              <input type="radio" name="level" value="N3">
              <span class="level-option__card">
                <span class="level-option__emoji">🌳</span>
                <span class="level-option__name">N3</span>
                <span class="level-option__desc">Intermediate</span>
              </span>
            </label>
            <label class="level-option">
              <input type="radio" name="level" value="N2">
              <span class="level-option__card">
                <span class="level-option__emoji">🏔️</span>
                <span class="level-option__name">N2</span>
                <span class="level-option__desc">Advanced</span>
              </span>
            </label>
            <label class="level-option">
              <input type="radio" name="level" value="N1">
              <span class="level-option__card">
                <span class="level-option__emoji">🔥</span>
                <span class="level-option__name">N1</span>
                <span class="level-option__desc">Fluent</span>
              </span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Story Length</label>
          <div class="length-selector">
            <label class="length-option">
              <input type="radio" name="length" value="short" checked>
              <span class="length-option__btn">Short</span>
            </label>
            <label class="length-option">
              <input type="radio" name="length" value="medium">
              <span class="length-option__btn">Medium</span>
            </label>
            <label class="length-option">
              <input type="radio" name="length" value="long">
              <span class="length-option__btn">Long</span>
            </label>
          </div>
          <div class="form-hint">Short (~5 sentences), Medium (~12), Long (~20)</div>
        </div>
        
        <!-- Loading State -->
        <div id="loading-state" class="generator-loading hidden">
          <div class="generator-loading__spinner"></div>
          <div class="generator-loading__text">
            <strong>Generating your story...</strong>
            <p>This may take 10-30 seconds</p>
          </div>
        </div>
      </form>
      
      <div class="modal__footer">
        <button type="button" id="cancel-btn" class="btn btn--secondary">Cancel</button>
        <button type="submit" form="generator-form" id="generate-btn" class="btn">
          Generate Story ✨
        </button>
      </div>
    </div>
  `;

  // Elements
  const form = overlay.querySelector('#generator-form');
  const cancelBtn = overlay.querySelector('#cancel-btn');
  const closeBtn = overlay.querySelector('.modal__close');
  const submitBtn = overlay.querySelector('#generate-btn');
  const loadingState = overlay.querySelector('#loading-state');
  const randomTopicBtn = overlay.querySelector('#random-topic-btn');
  const topicInput = overlay.querySelector('#topic');

  // Event manager for cleanup
  const events = createEventManager();

  // Close modal
  const close = () => {
    overlay.style.animation = 'fadeOut 0.2s ease-out forwards';
    overlay.querySelector('.modal').style.animation = 'modalSlideDown 0.2s ease-out forwards';
    setTimeout(() => {
      events.cleanup();
      overlay.remove();
      onClose();
    }, 200);
  };

  // Event handlers
  events.on(cancelBtn, 'click', close);
  events.on(closeBtn, 'click', close);

  // Random topic functionality
  events.on(randomTopicBtn, 'click', () => {
    const randomIndex = Math.floor(Math.random() * storyTopics.length);
    const selectedTopic = storyTopics[randomIndex];

    // Animate through a few topics before settling
    let shuffleCount = 0;
    const maxShuffles = 8;
    const shuffleInterval = setInterval(() => {
      topicInput.value = storyTopics[Math.floor(Math.random() * storyTopics.length)];
      shuffleCount++;

      if (shuffleCount >= maxShuffles) {
        clearInterval(shuffleInterval);
        topicInput.value = selectedTopic;
        // Trigger animation
        randomTopicBtn.classList.remove('dice-animate');
        void randomTopicBtn.offsetWidth; // Trigger reflow
        randomTopicBtn.classList.add('dice-animate');
      }
    }, 60);
  });

  // Close on overlay click
  events.on(overlay, 'click', e => {
    if (e.target === overlay) {
      close();
    }
  });

  // Escape key to close
  events.on(document, 'keydown', e => {
    if (e.key === 'Escape') {
      close();
    }
  });

  // Form submission
  events.on(form, 'submit', async e => {
    e.preventDefault();

    const topic = document.getElementById('topic').value.trim();
    const instructions = document.getElementById('instructions').value.trim();
    const level = document.querySelector('input[name="level"]:checked').value;
    const length = document.querySelector('input[name="length"]:checked').value;

    if (!topic) {
      toast.error('Please enter a topic for your story');
      return;
    }

    // Show loading state
    form.querySelectorAll('input, textarea').forEach(el => (el.disabled = true));
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="animate-spin">⏳</span> Queuing...';
    loadingState.classList.remove('hidden');

    try {
      // Create job (returns immediately with job ID)
      await createStoryGenerationJob(topic, level, instructions, length);

      // Show success message
      toast.success('Story queued! You can close this page.');

      // Update UI to show job is queued
      submitBtn.innerHTML = '✓ Queued';
      loadingState.innerHTML = `
        <div class="generator-loading__spinner" style="border-top-color: var(--color-success);"></div>
        <div class="generator-loading__text">
          <strong>Story is being generated!</strong>
          <p>Check the Queue page to track progress</p>
        </div>
      `;

      // Navigate to Queue page after 2 seconds
      setTimeout(() => {
        window.location.hash = '#/queue';
        close();
      }, 2000);
    } catch (error) {
      console.error('Job creation failed:', error);
      toast.error(`Failed to queue story: ${error.message}`);

      // Reset form
      form.querySelectorAll('input, textarea').forEach(el => (el.disabled = false));
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Generate Story ✨';
      loadingState.classList.add('hidden');
    }
  });

  return overlay;
};

// Generator modal styles now in external CSS: src/styles/components/modals.css

export default GeneratorModal;
