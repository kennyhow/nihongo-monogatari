/**
 * Generator Modal Component
 * AI-powered story creation with preview and loading states
 */

import { generateStory } from '../services/api.js';
import { addStory } from '../utils/storage.js';
import { audioQueue } from '../utils/audioQueue.js';
import { toast } from './Toast.js';

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
          <input 
            type="text" 
            id="topic" 
            class="form-input" 
            placeholder="e.g. A cat who loves sushi, A samurai's journey..."
            required
            maxlength="100"
          >
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
          <label class="form-label" for="level">Difficulty Level</label>
          <div class="level-selector">
            <label class="level-option">
              <input type="radio" name="level" value="Beginner" checked>
              <span class="level-option__card">
                <span class="level-option__emoji">🌱</span>
                <span class="level-option__name">Beginner</span>
                <span class="level-option__desc">Simple vocab & grammar</span>
              </span>
            </label>
            <label class="level-option">
              <input type="radio" name="level" value="Intermediate">
              <span class="level-option__card">
                <span class="level-option__emoji">🌿</span>
                <span class="level-option__name">Intermediate</span>
                <span class="level-option__desc">More complex sentences</span>
              </span>
            </label>
            <label class="level-option">
              <input type="radio" name="level" value="Advanced">
              <span class="level-option__card">
                <span class="level-option__emoji">🌳</span>
                <span class="level-option__name">Advanced</span>
                <span class="level-option__desc">Natural expressions</span>
              </span>
            </label>
          </div>
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
      const newStory = await generateStory(topic, level, instructions);

      // Save to storage
      addStory(newStory);

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
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
  }
  
  @media (max-width: 500px) {
    .level-selector {
      grid-template-columns: 1fr;
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
`;
document.head.appendChild(modalStyles);

export default GeneratorModal;
