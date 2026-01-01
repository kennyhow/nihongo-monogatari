/**
 * Settings Page
 * User preferences and app configuration
 */

import { getSettings, saveSettings, getTheme, toggleTheme } from '../utils/storage.js';
import { toast } from '../components/Toast.js';

const Settings = (parentElement) => {
  const currentSettings = getSettings();
  const currentTheme = getTheme();

  const render = () => {
    const html = `
      <div class="settings-page">
        <div class="settings-header">
          <h1>Settings</h1>
          <p class="text-muted">Customize your reading experience</p>
        </div>

        <div class="settings-sections">
          <!-- Appearance -->
          <section class="settings-section card">
            <h2 class="settings-section__title">🎨 Appearance</h2>
            
            <div class="setting-item">
              <div class="setting-item__info">
                <h3 class="setting-item__label">Theme</h3>
                <p class="setting-item__desc">Choose between light and dark mode</p>
              </div>
              <div class="theme-toggle-group">
                <button class="theme-btn ${currentTheme === 'light' ? 'active' : ''}" data-theme="light">
                  ☀️ Light
                </button>
                <button class="theme-btn ${currentTheme === 'dark' ? 'active' : ''}" data-theme="dark">
                  🌙 Dark
                </button>
              </div>
            </div>
          </section>

          <!-- Reading Preferences -->
          <section class="settings-section card">
            <h2 class="settings-section__title">📖 Reading</h2>
            
            <div class="setting-item">
              <div class="setting-item__info">
                <h3 class="setting-item__label">View Mode</h3>
                <p class="setting-item__desc">How to display Japanese and English text</p>
              </div>
              <div class="view-mode-selector">
                <label class="view-mode-option">
                  <input type="radio" name="viewMode" value="side-by-side" ${currentSettings.viewMode === 'side-by-side' ? 'checked' : ''}>
                  <span class="view-mode-option__card">
                    <span class="view-mode-option__preview">
                      <span class="preview-box"></span>
                      <span class="preview-box"></span>
                    </span>
                    <span>Side-by-Side</span>
                  </span>
                </label>
                <label class="view-mode-option">
                  <input type="radio" name="viewMode" value="stacked" ${currentSettings.viewMode === 'stacked' ? 'checked' : ''}>
                  <span class="view-mode-option__card">
                    <span class="view-mode-option__preview view-mode-option__preview--stacked">
                      <span class="preview-box"></span>
                      <span class="preview-box"></span>
                    </span>
                    <span>Stacked</span>
                  </span>
                </label>
              </div>
            </div>
            
            <div class="setting-item">
              <div class="setting-item__info">
                <h3 class="setting-item__label">Text Size</h3>
                <p class="setting-item__desc">Size of Japanese text in the reader</p>
              </div>
              <select id="fontSize" class="form-select" style="width: auto; min-width: 150px;">
                <option value="medium" ${currentSettings.fontSize === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="large" ${currentSettings.fontSize === 'large' ? 'selected' : ''}>Large</option>
              </select>
            </div>
            
            <div class="setting-item">
              <div class="setting-item__info">
                <h3 class="setting-item__label">Furigana</h3>
                <p class="setting-item__desc">Show reading aids above kanji</p>
              </div>
              <label class="toggle">
                <input type="checkbox" id="showFurigana" ${currentSettings.showFurigana ? 'checked' : ''}>
                <span class="toggle__slider"></span>
              </label>
            </div>
          </section>

          <!-- Data Management -->
          <section class="settings-section card">
            <h2 class="settings-section__title">💾 Data</h2>
            
            <div class="setting-item">
              <div class="setting-item__info">
                <h3 class="setting-item__label">Export Data</h3>
                <p class="setting-item__desc">Download your stories and progress</p>
              </div>
              <button id="export-btn" class="btn btn--secondary btn--sm">
                📥 Export
              </button>
            </div>
            
            <div class="setting-item">
              <div class="setting-item__info">
                <h3 class="setting-item__label">Import Data</h3>
                <p class="setting-item__desc">Restore from a backup file</p>
              </div>
              <label class="btn btn--secondary btn--sm">
                📤 Import
                <input type="file" id="import-input" accept=".json" style="display: none;">
              </label>
            </div>
            
            <div class="setting-item setting-item--danger">
              <div class="setting-item__info">
                <h3 class="setting-item__label">Clear Audio Cache</h3>
                <p class="setting-item__desc">Remove cached audio files to free up space</p>
              </div>
              <button id="clear-cache-btn" class="btn btn--ghost btn--sm" style="color: var(--color-error);">
                🗑️ Clear
              </button>
            </div>
          </section>

          <!-- About -->
          <section class="settings-section card">
            <h2 class="settings-section__title">ℹ️ About</h2>
            
            <div class="about-info">
              <div class="about-logo">日本語物語</div>
              <p class="about-name">Nihongo Monogatari</p>
              <p class="about-version">Version 2.0.0</p>
              <p class="about-desc">
                Learn Japanese through AI-generated stories with translations, 
                furigana, and high-quality text-to-speech.
              </p>
              <p class="about-credits">
                Powered by Google Gemini AI
              </p>
            </div>
          </section>
        </div>

        <!-- Save Button -->
        <div class="settings-footer">
          <button id="save-btn" class="btn btn--lg">
            Save Preferences
          </button>
        </div>
      </div>
    `;

    parentElement.innerHTML = html;
    setupListeners();
  };

  const setupListeners = () => {
    // Theme buttons
    parentElement.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newTheme = btn.dataset.theme;
        const current = getTheme();
        if (newTheme !== current) {
          toggleTheme();
          // Update button states
          parentElement.querySelectorAll('.theme-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.theme === newTheme);
          });
          toast.success(`Switched to ${newTheme} mode`);
        }
      });
    });

    // Save button
    parentElement.querySelector('#save-btn')?.addEventListener('click', () => {
      const viewMode = document.querySelector('input[name="viewMode"]:checked')?.value || 'side-by-side';
      const fontSize = document.getElementById('fontSize')?.value || 'medium';
      const showFurigana = document.getElementById('showFurigana')?.checked ?? true;

      saveSettings({ viewMode, fontSize, showFurigana });

      toast.success('Preferences saved!');
    });

    // Export
    parentElement.querySelector('#export-btn')?.addEventListener('click', () => {
      const data = {
        stories: JSON.parse(localStorage.getItem('nihongo_stories') || '[]'),
        progress: JSON.parse(localStorage.getItem('nihongo_progress') || '{}'),
        settings: JSON.parse(localStorage.getItem('nihongo_settings') || '{}'),
        theme: localStorage.getItem('nihongo_theme') || 'light',
        exportedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nihongo-monogatari-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Data exported successfully!');
    });

    // Import
    parentElement.querySelector('#import-input')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (data.stories) {
          localStorage.setItem('nihongo_stories', JSON.stringify(data.stories));
        }
        if (data.progress) {
          localStorage.setItem('nihongo_progress', JSON.stringify(data.progress));
        }
        if (data.settings) {
          localStorage.setItem('nihongo_settings', JSON.stringify(data.settings));
        }
        if (data.theme) {
          localStorage.setItem('nihongo_theme', data.theme);
          document.documentElement.setAttribute('data-theme', data.theme);
        }

        toast.success('Data imported! Refreshing...');
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        toast.error('Failed to import data. Invalid file format.');
      }
    });

    // Clear cache
    parentElement.querySelector('#clear-cache-btn')?.addEventListener('click', async () => {
      if (confirm('Clear all cached audio? You will need to regenerate audio for stories.')) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
          toast.success('Audio cache cleared');
        } catch (err) {
          toast.error('Failed to clear cache');
        }
      }
    });
  };

  render();
};

// Add settings-specific styles
const settingsStyles = document.createElement('style');
settingsStyles.textContent = `
  .settings-page {
    max-width: 700px;
    margin: 0 auto;
    padding-bottom: var(--space-16);
  }
  
  .settings-header {
    margin-bottom: var(--space-8);
  }
  
  .settings-sections {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
  
  .settings-section {
    padding: var(--space-6);
  }
  
  .settings-section:hover {
    transform: none;
    box-shadow: var(--shadow-sm);
  }
  
  .settings-section__title {
    font-size: var(--text-lg);
    margin-bottom: var(--space-6);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }

  /* Setting Items */
  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) 0;
    border-bottom: 1px solid var(--color-border);
  }
  
  .setting-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  
  .setting-item__info {
    flex: 1;
  }
  
  .setting-item__label {
    font-size: var(--text-base);
    font-weight: 600;
    margin-bottom: var(--space-1);
  }
  
  .setting-item__desc {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  /* Theme Toggle Group */
  .theme-toggle-group {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-1);
    background: var(--color-bg-subtle);
    border-radius: var(--radius-lg);
  }
  
  .theme-btn {
    padding: var(--space-2) var(--space-4);
    border: none;
    background: transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--text-sm);
    transition: all var(--duration-fast);
  }
  
  .theme-btn.active {
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
  }

  /* View Mode Selector */
  .view-mode-selector {
    display: flex;
    gap: var(--space-3);
  }
  
  .view-mode-option {
    cursor: pointer;
  }
  
  .view-mode-option input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  
  .view-mode-option__card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--color-bg-subtle);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    transition: all var(--duration-fast);
  }
  
  .view-mode-option input:checked + .view-mode-option__card {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }
  
  .view-mode-option__preview {
    display: flex;
    gap: 4px;
    padding: 8px;
    background: var(--color-surface);
    border-radius: var(--radius-sm);
  }
  
  .view-mode-option__preview--stacked {
    flex-direction: column;
  }
  
  .preview-box {
    width: 24px;
    height: 16px;
    background: var(--color-border);
    border-radius: 2px;
  }

  /* Toggle Switch */
  .toggle {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 28px;
  }
  
  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .toggle__slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background: var(--color-border);
    border-radius: var(--radius-full);
    transition: var(--duration-fast);
  }
  
  .toggle__slider::before {
    content: '';
    position: absolute;
    height: 20px;
    width: 20px;
    left: 4px;
    bottom: 4px;
    background: white;
    border-radius: 50%;
    transition: var(--duration-fast);
    box-shadow: var(--shadow-sm);
  }
  
  .toggle input:checked + .toggle__slider {
    background: var(--color-primary);
  }
  
  .toggle input:checked + .toggle__slider::before {
    transform: translateX(20px);
  }

  /* About Section */
  .about-info {
    text-align: center;
    padding: var(--space-4);
  }
  
  .about-logo {
    font-family: var(--font-display);
    font-size: var(--text-3xl);
    color: var(--color-primary);
    margin-bottom: var(--space-2);
  }
  
  .about-name {
    font-weight: 600;
    margin-bottom: var(--space-1);
  }
  
  .about-version {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    margin-bottom: var(--space-4);
  }
  
  .about-desc {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    max-width: 400px;
    margin: 0 auto var(--space-4);
  }
  
  .about-credits {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  /* Footer */
  .settings-footer {
    margin-top: var(--space-8);
    text-align: center;
  }
`;
document.head.appendChild(settingsStyles);

export default Settings;
