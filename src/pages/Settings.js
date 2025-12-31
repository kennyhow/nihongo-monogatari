import { getSettings, saveSettings } from '../utils/storage.js';

const Settings = (parentElement) => {
    const currentSettings = getSettings();

    const render = () => {
        const html = `
      <div style="max-width: 600px; margin: 0 auto;">
        <h1 style="margin-bottom: 2rem;">Settings</h1>
        
        <div class="card">
          <div class="setting-group" style="padding-bottom: 1.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--color-border);">
            <h3 style="margin-bottom: 0.5rem;">Reading View</h3>
            <p style="color: var(--color-text-muted); font-size: 0.875rem; margin-bottom: 1rem;">Choose how you want to see the translations.</p>
            
            <div style="display: flex; gap: 1rem;">
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="radio" name="viewMode" value="side-by-side" ${currentSettings.viewMode === 'side-by-side' ? 'checked' : ''}>
                Side-by-Side
              </label>
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="radio" name="viewMode" value="stacked" ${currentSettings.viewMode === 'stacked' ? 'checked' : ''}>
                Stacked
              </label>
            </div>
          </div>
          
          <div class="setting-group" style="padding-bottom: 1.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--color-border);">
            <h3 style="margin-bottom: 0.5rem;">Text Size</h3>
            
            <select id="fontSize" style="padding: 0.5rem; border-radius: 0.25rem; border: 1px solid var(--color-border); width: 100%;">
              <option value="medium" ${currentSettings.fontSize === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="large" ${currentSettings.fontSize === 'large' ? 'selected' : ''}>Large</option>
            </select>
          </div>
          
          <div class="setting-group">
            <h3 style="margin-bottom: 0.5rem;">Furigana</h3>
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="checkbox" id="showFurigana" ${currentSettings.showFurigana ? 'checked' : ''}>
              Show Furigana (Reading aids)
            </label>
            <p style="margin-top: 0.5rem; color: var(--color-text-muted); font-size: 0.875rem;">
              Note: This feature depends on available story data.
            </p>
          </div>
        </div>
        
        <div style="margin-top: 2rem; text-align: right;">
          <button id="save-btn" class="btn">Save Preferences</button>
        </div>
      </div>
    `;

        parentElement.innerHTML = html;

        // Event Listeners
        document.getElementById('save-btn').addEventListener('click', () => {
            const viewMode = document.querySelector('input[name="viewMode"]:checked').value;
            const fontSize = document.getElementById('fontSize').value;
            const showFurigana = document.getElementById('showFurigana').checked;

            saveSettings({ viewMode, fontSize, showFurigana });

            // Feedback
            const btn = document.getElementById('save-btn');
            const originalText = btn.textContent;
            btn.textContent = 'Saved!';
            btn.style.backgroundColor = '#10b981'; // Green

            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.backgroundColor = '';
            }, 2000);
        });
    };

    render();
};

export default Settings;
