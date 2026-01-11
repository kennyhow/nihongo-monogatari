/**
 * Settings Page
 * User preferences and app configuration
 * Refactored for modularity and better organization.
 */

import {
  getSettings,
  saveSettings,
  getTheme,
  toggleTheme,
  getApiKeys,
  saveApiKeys,
  syncAll,
  wipeAllData,
} from '../utils/storage.js';
import { toast } from '../components/Toast.js';
import { clearImageCache, getCachedImageCount } from '../utils/imageStorage.js';
import { supabase, signIn, signUp, signOut, getSession } from '../utils/supabase.js';
import { createEventManager } from '../utils/componentBase.js';

const Settings = parentElement => {
  // Event manager
  const events = createEventManager();

  // Local state for rendering
  const currentSettings = getSettings();
  let currentTheme = getTheme();
  const apiKeys = getApiKeys();
  let imageCount = 0;
  let session = null;

  /**
   * Main render function
   */
  const render = async () => {
    imageCount = await getCachedImageCount();

    parentElement.innerHTML = `
      <div class="settings-page">
        <div class="settings-header">
          <h1>Settings</h1>
          <p class="text-muted">Customize your reading experience</p>
        </div>

        <div class="settings-sections">
          <div id="sync-section-root"></div>
          <div id="appearance-section-root"></div>
          <div id="reading-section-root"></div>
          <div id="data-section-root"></div>
          <div id="api-section-root"></div>
          <div id="about-section-root"></div>
        </div>

        <div class="settings-footer">
          <button id="save-btn" class="btn btn--lg">Save Preferences</button>
        </div>
      </div>
    `;

    // Auth check FIRST (before rendering data section)
    session = await getSession();
    renderSync();

    renderAppearance();
    renderReading();
    renderData();
    renderApi();
    renderAbout();

    events.on(parentElement.querySelector('#save-btn'), 'click', handleSave);
  };

  /**
   * Section: Cloud Sync
   */
  const renderSync = () => {
    const root = parentElement.querySelector('#sync-section-root');
    if (!root) {
      return;
    }

    if (!supabase) {
      root.innerHTML = `
        <section class="settings-section card">
          <h2 class="settings-section__title">☁️ Cloud Sync</h2>
          <div class="setting-item">
            <p class="text-error">Supabase credentials not found in .env. Please check the setup instructions.</p>
          </div>
        </section>
      `;
      return;
    }

    if (session) {
      root.innerHTML = `
        <section class="settings-section card">
          <h2 class="settings-section__title">☁️ Cloud Sync</h2>
          <div class="auth-status">
            <div class="auth-status__info">
              <span class="auth-status__badge">LOGGED IN</span>
              <span class="auth-status__email">${session.user.email}</span>
            </div>
            <div class="auth-status__actions">
              <button id="sync-now-btn" class="btn btn--secondary btn--sm">🔄 Sync Now</button>
              <button id="logout-btn" class="btn btn--ghost btn--sm">Sign Out</button>
            </div>
          </div>
        </section>
      `;
      events.on(root.querySelector('#logout-btn'), 'click', handleLogout);
      events.on(root.querySelector('#sync-now-btn'), 'click', handleSync);
    } else {
      root.innerHTML = `
        <section class="settings-section card">
          <h2 class="settings-section__title">☁️ Cloud Sync</h2>
          <p class="setting-item__desc mb-4">Sign in to sync your stories and progress across devices.</p>
          <div class="auth-form">
            <input type="email" id="auth-email" class="form-input" placeholder="Email context">
            <input type="password" id="auth-password" class="form-input" placeholder="Password">
            <div class="auth-form__actions">
              <button id="login-btn" class="btn btn--primary">Sign In</button>
              <button id="signup-btn" class="btn btn--secondary">Create Account</button>
            </div>
          </div>
        </section>
      `;
      events.on(root.querySelector('#login-btn'), 'click', handleLogin);
      events.on(root.querySelector('#signup-btn'), 'click', handleSignup);
    }
  };

  /**
   * Section: Appearance
   */
  const renderAppearance = () => {
    const root = parentElement.querySelector('#appearance-section-root');
    if (!root) {
      return;
    }

    root.innerHTML = `
      <section class="settings-section card">
        <h2 class="settings-section__title">🎨 Appearance</h2>
        <div class="setting-item">
          <div class="setting-item__info">
            <h3 class="setting-item__label">Theme</h3>
            <p class="setting-item__desc">Choose between light and dark mode</p>
          </div>
          <div class="theme-toggle-group">
            <button class="theme-btn ${currentTheme === 'light' ? 'active' : ''}" data-theme="light">☀️ Light</button>
            <button class="theme-btn ${currentTheme === 'dark' ? 'active' : ''}" data-theme="dark">🌙 Dark</button>
          </div>
        </div>
      </section>
    `;

    // Use delegation for theme buttons
    events.delegate(root, 'click', '.theme-btn', function () {
      const newTheme = this.dataset.theme;
      if (newTheme !== currentTheme) {
        toggleTheme();
        currentTheme = newTheme;
        root
          .querySelectorAll('.theme-btn')
          .forEach(b => b.classList.toggle('active', b.dataset.theme === newTheme));
        toast.success(`Switched to ${newTheme} mode`);
      }
    });
  };

  /**
   * Section: Reading Preferences
   */
  const renderReading = () => {
    const root = parentElement.querySelector('#reading-section-root');
    if (!root) {
      return;
    }

    root.innerHTML = `
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
                <span class="view-mode-option__preview"><span class="preview-box"></span><span class="preview-box"></span></span>
                <span>Side-by-Side</span>
              </span>
            </label>
            <label class="view-mode-option">
              <input type="radio" name="viewMode" value="stacked" ${currentSettings.viewMode === 'stacked' ? 'checked' : ''}>
              <span class="view-mode-option__card">
                <span class="view-mode-option__preview view-mode-option__preview--stacked"><span class="preview-box"></span><span class="preview-box"></span></span>
                <span>Stacked</span>
              </span>
            </label>
          </div>
        </div>
        
        <div class="setting-item">
          <div class="setting-item__info">
            <h3 class="setting-item__label">Text Size</h3>
            <p class="setting-item__desc">Size of Japanese text</p>
          </div>
          <select id="fontSize" class="form-select form-select--auto">
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
    `;
  };

  /**
   * Section: Data Management
   */
  const renderData = () => {
    const root = parentElement.querySelector('#data-section-root');
    if (!root) {
      return;
    }

    root.innerHTML = `
      <section class="settings-section card">
        <h2 class="settings-section__title">💾 Data</h2>
        
        <div class="setting-item">
          <div class="setting-item__info">
            <h3 class="setting-item__label">Export Data</h3>
            <p class="setting-item__desc">Download backup file</p>
          </div>
          <button id="export-btn" class="btn btn--secondary btn--sm">📥 Export</button>
        </div>
        
        <div class="setting-item">
          <div class="setting-item__info">
            <h3 class="setting-item__label">Import Data</h3>
            <p class="setting-item__desc">Restore from backup</p>
          </div>
          <label class="btn btn--secondary btn--sm">
            📤 Import
            <input type="file" id="import-input" accept=".json" class="hidden-input">
          </label>
        </div>

        <div class="setting-item setting-item--danger">
          <div class="setting-item__info">
            <h3 class="setting-item__label">Clear Audio Cache</h3>
            <p class="setting-item__desc">Remove all cached voice files</p>
          </div>
          <button id="clear-cache-btn" class="btn btn--ghost btn--sm btn--danger">🗑️ Clear</button>
        </div>

        <div class="setting-item setting-item--danger">
          <div class="setting-item__info">
            <h3 class="setting-item__label">Clear Image Cache</h3>
            <p class="setting-item__desc">Remove ${imageCount} cached images</p>
          </div>
          <button id="clear-images-btn" class="btn btn--ghost btn--sm btn--danger">🗑️ Clear</button>
        </div>

        ${
          session
            ? `
        <div class="setting-item setting-item--danger setting-item--critical">
          <div class="setting-item__info">
            <h3 class="setting-item__label">Wipe All Data</h3>
            <p class="setting-item__desc">Permanently delete ALL stories, progress, and cached images (local + cloud). Settings, theme, and API keys will be preserved.</p>
          </div>
          <button id="wipe-all-btn" class="btn btn--ghost btn--sm btn--critical">☠️ Wipe All</button>
        </div>
        `
            : ''
        }
      </section>
    `;

    events.on(root.querySelector('#export-btn'), 'click', handleExport);
    events.on(root.querySelector('#import-input'), 'change', handleImport);
    events.on(root.querySelector('#clear-cache-btn'), 'click', handleClearAudio);
    events.on(root.querySelector('#clear-images-btn'), 'click', handleClearImages);

    // wipe-all-btn is conditionally rendered (only when session exists)
    const wipeAllBtn = root.querySelector('#wipe-all-btn');
    if (wipeAllBtn) {
      events.on(wipeAllBtn, 'click', handleWipeAll);
    }
  };

  /**
   * Section: API Configuration
   */
  const renderApi = () => {
    const root = parentElement.querySelector('#api-section-root');
    if (!root) {
      return;
    }

    root.innerHTML = `
      <section class="settings-section card">
        <h2 class="settings-section__title">🔑 API Keys</h2>
        <div class="setting-item flex-col items-start gap-4">
          <div class="setting-item__info w-full">
            <h3 class="setting-item__label">Gemini API Key</h3>
            <p class="setting-item__desc">For generation and TTS</p>
          </div>
          <input type="password" id="geminiKey" class="form-input" placeholder="AIza..." value="${apiKeys.google || ''}">
        </div>
        
        <div class="setting-item flex-col items-start gap-4">
          <div class="setting-item__info w-full">
            <h3 class="setting-item__label">Pollinations Key</h3>
            <p class="setting-item__desc">Optional for images</p>
          </div>
          <input type="password" id="pollinationsKey" class="form-input" placeholder="pk_..." value="${apiKeys.pollinations || ''}">
        </div>
      </section>
    `;
  };

  /**
   * Section: About
   */
  const renderAbout = () => {
    const root = parentElement.querySelector('#about-section-root');
    if (!root) {
      return;
    }

    root.innerHTML = `
      <section class="settings-section card">
        <h2 class="settings-section__title">ℹ️ About</h2>
        <div class="about-info">
          <div class="about-logo">日本語物語</div>
          <p class="about-name">Nihongo Monogatari</p>
          <p class="about-version">Version 2.0.0</p>
          <p class="about-credits">Powered by Google Gemini AI</p>
        </div>
      </section>
    `;
  };

  /**
   * Handlers
   */
  const handleSave = () => {
    const viewMode =
      parentElement.querySelector('input[name="viewMode"]:checked')?.value || 'side-by-side';
    const fontSize = parentElement.querySelector('#fontSize')?.value || 'medium';
    const showFurigana = parentElement.querySelector('#showFurigana')?.checked ?? true;

    const google = parentElement.querySelector('#geminiKey')?.value || '';
    const pollinations = parentElement.querySelector('#pollinationsKey')?.value || '';

    saveSettings({ viewMode, fontSize, showFurigana });
    saveApiKeys({ google, pollinations });
    toast.success('Settings saved!');
  };

  const handleExport = () => {
    const data = {
      stories: JSON.parse(localStorage.getItem('nihongo_stories') || '[]'),
      progress: JSON.parse(localStorage.getItem('nihongo_progress') || '{}'),
      settings: currentSettings,
      theme: currentTheme,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nihongo-monogatari-backup.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup created');
  };

  const handleImport = async e => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
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
      }
      toast.success('Data imported! Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error('Invalid backup file');
    }
  };

  const handleClearAudio = async () => {
    if (confirm('Clear all cached audio?')) {
      const names = await caches.keys();
      const targets = names.filter(n => n.includes('audio'));
      await Promise.all(targets.map(n => caches.delete(n)));
      toast.success('Audio cache cleared');
    }
  };

  const handleClearImages = async () => {
    if (confirm('Clear all cached images?')) {
      if (await clearImageCache()) {
        toast.success('Image cache cleared');
        render();
      }
    }
  };

  const handleWipeAll = async () => {
    const confirmed = confirm(
      '⚠️ DANGER ZONE ⚠️\n\n' +
        'This will PERMANENTLY delete:\n' +
        '• All stories (local + cloud)\n' +
        '• All reading progress (local + cloud)\n' +
        '• All cached images (local + cloud)\n' +
        '• All cached audio (local)\n\n' +
        'Your settings (theme, font size, preferences) and API keys will be preserved.\n\n' +
        'This action CANNOT be undone. Are you sure?'
    );

    if (!confirmed) {
      return;
    }

    const doubleConfirmed = confirm(
      'Are you REALLY sure?\n\n' +
        'This will delete ALL your data from everywhere.\n' +
        'Type "OK" to confirm permanent deletion.'
    );

    if (!doubleConfirmed) {
      return;
    }

    toast.info('Wiping all data...');
    const result = await wipeAllData();

    if (result.success) {
      toast.success('☠️ All data wiped successfully!');
      // Reload after a short delay to clear the UI
      setTimeout(() => window.location.reload(), 1500);
    } else {
      toast.error(`Failed to wipe: ${result.error || 'Unknown error'}`);
    }
  };

  /**
   * Auth Handlers
   */
  const handleLogin = async () => {
    const email = parentElement.querySelector('#auth-email')?.value;
    const password = parentElement.querySelector('#auth-password')?.value;
    if (!email || !password) {
      return toast.error('Please enter email and password');
    }

    toast.info('Signing in...');
    const { data, error } = await signIn(email, password);
    if (error) {
      return toast.error(error.message);
    }

    session = data.session;
    toast.success('Welcome back!');
    renderSync();
  };

  const handleSignup = async () => {
    const email = parentElement.querySelector('#auth-email')?.value;
    const password = parentElement.querySelector('#auth-password')?.value;
    if (!email || !password) {
      return toast.error('Please enter email and password');
    }

    toast.info('Creating account...');
    const { data, error } = await signUp(email, password);
    if (error) {
      return toast.error(error.message);
    }

    if (data.user && data.session) {
      session = data.session;
      toast.success('Account created!');
    } else {
      toast.info('Account created! Please check your email if confirmation is enabled.');
    }
    renderSync();
  };

  const handleLogout = async () => {
    await signOut();
    session = null;
    toast.info('Signed out');
    renderSync();
  };

  const handleSync = async () => {
    toast.info('Syncing data...');
    const success = await syncAll();
    if (success) {
      toast.success('Sync complete!');
      // Update local counts
      imageCount = await getCachedImageCount();
      render();
    } else {
      toast.error('Sync failed. Please check connection.');
    }
  };

  render();

  // Cleanup
  return () => {
    events.cleanup();
  };
};

// Styles now in external CSS: src/styles/pages/settings.css
export default Settings;
