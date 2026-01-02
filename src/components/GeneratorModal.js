/**
 * Generator Modal Component
 * AI-powered story creation with preview and loading states
 */

import { generateStory } from '../services/api.js';
import { addStory } from '../utils/storage.js';
import { audioQueue } from '../utils/audioQueue.js';
import { toast } from './Toast.js';
import { storyTopics } from '../data/storyTopics.js';

/**
 * Create and show the story generator modal
 * @param {Object} options
 * @param {Function} options.onClose - Called when modal closes
 * @param {Function} options.onGenerate - Called with new story after generation
 * @returns {HTMLElement} Modal overlay element
 */
const GeneratorModal = ({ onClose, onGenerate }) => {
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

  // Close modal
  const close = () => {
    overlay.style.animation = 'fadeOut 0.2s ease-out forwards';
    overlay.querySelector('.modal').style.animation = 'modalSlideDown 0.2s ease-out forwards';
    setTimeout(() => {
      overlay.remove();
      onClose();
    }, 200);
  };

  // Event handlers
  cancelBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  // Random topic functionality
  const randomTopicBtn = overlay.querySelector('#random-topic-btn');
  const topicInput = overlay.querySelector('#topic');

  randomTopicBtn.addEventListener('click', () => {
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
        randomTopicBtn.style.animation = 'none';
        randomTopicBtn.offsetHeight; // Trigger reflow
        randomTopicBtn.style.animation = 'diceRoll 0.5s ease-out';
      }
    }, 60);
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Escape key to close
  const handleEscape = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', handleEscape);

  // Form submission
  form.addEventListener('submit', async (e) => {
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
    form.querySelectorAll('input, textarea').forEach(el => el.disabled = true);
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="animate-spin">⏳</span> Generating...';
    loadingState.classList.remove('hidden');

    try {
      const newStory = await generateStory(topic, level, instructions, length);

      // Save to storage
      await addStory(newStory);

      // Queue for TTS generation
      try {
        audioQueue.enqueueStory(newStory);
      } catch (err) {
        console.warn('Failed to enqueue for TTS:', err);
      }

      // Success!
      onGenerate(newStory);

      // Cleanup and close
      document.removeEventListener('keydown', handleEscape);
      close();

    } catch (error) {
      console.error('Generation failed:', error);
      toast.error('Failed to generate story. Please check your API key and try again.');

      // Reset form
      form.querySelectorAll('input, textarea').forEach(el => el.disabled = false);
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Generate Story ✨';
      loadingState.classList.add('hidden');
    }
  });

  return overlay;
};

// Add modal-specific styles
const modalStyles = document.createElement('style');
modalStyles.textContent = `
  @keyframes fadeOut {
    to { opacity: 0; }
  }
  
  @keyframes modalSlideDown {
    to {
      opacity: 0;
      transform: translateY(24px) scale(0.96);
    }
  }
  
  .generator-modal {
    max-width: 550px;
  }
  
  .form-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .form-label__required {
    color: var(--color-error);
  }
  
  .form-label__optional {
    font-weight: 400;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
  
  .form-hint {
    margin-top: var(--space-2);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
  
  /* Level Selector */
  .level-selector {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--space-2);
  }
  
  @media (max-width: 600px) {
    .level-selector {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 400px) {
    .level-selector {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  .level-option {
    cursor: pointer;
  }
  
  .level-option input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  
  .level-option__card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--space-4);
    background: var(--color-bg-subtle);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    transition: all var(--duration-fast);
  }
  
  .level-option input:checked + .level-option__card {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
  }
  
  .level-option:hover .level-option__card {
    border-color: var(--color-border-hover);
  }
  
  .level-option__emoji {
    font-size: 1.5rem;
    margin-bottom: var(--space-2);
  }
  
  .level-option__name {
    font-weight: 600;
    font-size: var(--text-sm);
  }
  
  .level-option__desc {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    margin-top: var(--space-1);
    display: block;
  }

  /* Length Selector */
  .length-selector {
    display: flex;
    gap: var(--space-2);
    background: var(--color-bg-subtle);
    padding: var(--space-1);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }

  .length-option {
    flex: 1;
    cursor: pointer;
  }

  .length-option input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .length-option__btn {
    display: block;
    text-align: center;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-weight: 500;
    transition: all var(--duration-fast);
  }

  .length-option input:checked + .length-option__btn {
    background: var(--color-surface);
    color: var(--color-primary);
    box-shadow: var(--shadow-sm);
  }
  
  /* Loading State */
  .generator-loading {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--color-primary-light);
    border-radius: var(--radius-lg);
    margin-top: var(--space-4);
  }
  
  .generator-loading.hidden {
    display: none;
  }
  
  .generator-loading__spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  .generator-loading__text p {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    margin-top: var(--space-1);
  }

  /* Random Topic Button */
  .input-with-action {
    display: flex;
    gap: var(--space-2);
    align-items: stretch;
  }

  .input-with-action .form-input {
    flex: 1;
  }

  .random-btn {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--duration-fast);
    user-select: none;
  }

  .random-btn:hover {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    transform: scale(1.05);
  }

  .random-btn:active {
    transform: scale(0.95);
  }

  @keyframes diceRoll {
    0% {
      transform: rotate(0deg);
    }
    25% {
      transform: rotate(15deg) scale(1.1);
    }
    50% {
      transform: rotate(-15deg) scale(1.1);
    }
    75% {
      transform: rotate(5deg) scale(1.05);
    }
    100% {
      transform: rotate(0deg) scale(1);
    }
  }
`;
document.head.appendChild(modalStyles);

export default GeneratorModal;
