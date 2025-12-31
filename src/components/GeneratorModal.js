
import { generateStory } from '../services/api.js';
import { addStory } from '../utils/storage.js';

const GeneratorModal = ({ onClose, onGenerate }) => {
  const html = `
    <div style="
      position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100;
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
    ">
      <div style="
        background: var(--color-surface); 
        width: 100%; max-width: 500px; 
        padding: 2rem; border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
      ">
        <h2 style="margin-bottom: 1.5rem;">Create New Story</h2>
        
        <form id="generator-form">
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Topic</label>
            <input type="text" id="topic" required placeholder="e.g. A cat who loves sushi" 
              style="width: 100%; padding: 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-md);">
          </div>
          
          <div style="margin-bottom: 2rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Difficulty</label>
            <select id="level" style="width: 100%; padding: 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-md);">
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>
          
          <div style="display: flex; justify-content: flex-end; gap: 1rem;">
            <button type="button" id="cancel-btn" style="
              padding: 0.75rem 1.5rem; border: 1px solid var(--color-border); background: transparent; 
              border-radius: var(--radius-md); cursor: pointer;
            ">Cancel</button>
            
            <button type="submit" id="generate-btn" class="btn" style="
              padding: 0.75rem 1.5rem; min-width: 120px;
            ">Generate ✨</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Create Element
  const overlay = document.createElement('div');
  overlay.innerHTML = html;

  // Logic
  const form = overlay.querySelector('#generator-form');
  const cancelBtn = overlay.querySelector('#cancel-btn');
  const submitBtn = overlay.querySelector('#generate-btn');

  cancelBtn.addEventListener('click', () => {
    onClose();
    overlay.remove();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay.firstElementChild) { // Click on backdrop
      onClose();
      overlay.remove();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const topic = document.getElementById('topic').value;
    const level = document.getElementById('level').value;

    // Set Loading State
    submitBtn.textContent = 'Generating...';
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';

    try {
      const newStory = await generateStory(topic, level);

      // Save to local storage
      addStory(newStory);

      // Callback
      onGenerate(newStory);

      // Close
      onClose();
      overlay.remove();

    } catch (error) {
      console.error(error);
      alert('Failed to generate story. Please try again or check your API Key.');
      submitBtn.textContent = 'Generate ✨';
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
    }
  });

  return overlay;
};

export default GeneratorModal;
