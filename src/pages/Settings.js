/**
 * Settings Page
 * User preferences and app configuration
 * Refactored for modularity and better organization.
 */

import { getSettings, saveSettings, getTheme, toggleTheme, getApiKeys, saveApiKeys, syncAll, wipeAllData } from '../utils/storage.js';
import { toast } from '../components/Toast.js';
import { clearImageCache, getCachedImageCount } from '../utils/imageStorage.js';
import { supabase, signIn, signUp, signOut, getSession } from '../utils/supabase.js';

const Settings = (parentElement) => {
  // Local state for rendering
  let currentSettings = getSettings();
  let currentTheme = getTheme();
  let apiKeys = getApiKeys();
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

    parentElement.querySelector('#save-btn')?.addEventListener('click', handleSave);
  };

  /**
   * Section: Cloud Sync
   */
  const renderSync = () => {
    const root = parentElement.querySelector('#sync-section-root');
    if (!root) return;

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
      root.querySelector('#logout-btn')?.addEventListener('click', handleLogout);
      root.querySelector('#sync-now-btn')?.addEventListener('click', handleSync);
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
      root.querySelector('#login-btn')?.addEventListener('click', handleLogin);
      root.querySelector('#signup-btn')?.addEventListener('click', handleSignup);
    }
  };

  /**
   * Section: Appearance
   */
  const renderAppearance = () => {
    const root = parentElement.querySelector('#appearance-section-root');
    if (!root) return;

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

    root.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newTheme = btn.dataset.theme;
        if (newTheme !== currentTheme) {
          toggleTheme();
          currentTheme = newTheme;
          root.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === newTheme));
          toast.success(`Switched to ${newTheme} mode`);
        }
      });
    });
  };

  /**
   * Section: Reading Preferences
   */
  const renderReading = () => {
    const root = parentElement.querySelector('#reading-section-root');
    if (!root) return;

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
          <select id="fontSize" class="form-select" style="width: auto; min-width: 120px;">
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
    if (!root) return;

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
            <input type="file" id="import-input" accept=".json" style="display: none;">
          </label>
        </div>
        
        <div class="setting-item setting-item--danger">
          <div class="setting-item__info">
            <h3 class="setting-item__label">Clear Audio Cache</h3>
            <p class="setting-item__desc">Remove all cached voice files</p>
          </div>
          <button id="clear-cache-btn" class="btn btn--ghost btn--sm" style="color: var(--color-error);">🗑️ Clear</button>
        </div>

        <div class="setting-item setting-item--danger">
          <div class="setting-item__info">
            <h3 class="setting-item__label">Clear Image Cache</h3>
            <p class="setting-item__desc">Remove ${imageCount} cached images</p>
          </div>
          <button id="clear-images-btn" class="btn btn--ghost btn--sm" style="color: var(--color-error);">🗑️ Clear</button>
        </div>

        ${session ? `
        <div class="setting-item setting-item--danger" style="background: var(--color-error-light); padding: var(--space-4); border-radius: var(--radius-md); margin-top: var(--space-4);">
          <div class="setting-item__info">
            <h3 class="setting-item__label">Wipe All Data</h3>
            <p class="setting-item__desc">Permanently delete ALL stories, progress, and cached images (local + cloud). Settings, theme, and API keys will be preserved.</p>
          </div>
          <button id="wipe-all-btn" class="btn btn--ghost btn--sm" style="color: var(--color-error); border: 1px solid var(--color-error);">☠️ Wipe All</button>
        </div>
        ` : ''}
      </section>
    `;

    root.querySelector('#export-btn')?.addEventListener('click', handleExport);
    root.querySelector('#import-input')?.addEventListener('change', handleImport);
    root.querySelector('#clear-cache-btn')?.addEventListener('click', handleClearAudio);
    root.querySelector('#clear-images-btn')?.addEventListener('click', handleClearImages);
    root.querySelector('#wipe-all-btn')?.addEventListener('click', handleWipeAll);
  };

  /**
   * Section: API Configuration
   */
  const renderApi = () => {
    const root = parentElement.querySelector('#api-section-root');
    if (!root) return;

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
    if (!root) return;

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
    const viewMode = parentElement.querySelector('input[name="viewMode"]:checked')?.value || 'side-by-side';
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
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nihongo-monogatari-backup.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup created');
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.stories) localStorage.setItem('nihongo_stories', JSON.stringify(data.stories));
      if (data.progress) localStorage.setItem('nihongo_progress', JSON.stringify(data.progress));
      if (data.settings) localStorage.setItem('nihongo_settings', JSON.stringify(data.settings));
      if (data.theme) localStorage.setItem('nihongo_theme', data.theme);
      toast.success('Data imported! Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
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

    if (!confirmed) return;

    const doubleConfirmed = confirm(
      'Are you REALLY sure?\n\n' +
      'This will delete ALL your data from everywhere.\n' +
      'Type "OK" to confirm permanent deletion.'
    );

    if (!doubleConfirmed) return;

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
    if (!email || !password) return toast.error('Please enter email and password');

    toast.info('Signing in...');
    const { data, error } = await signIn(email, password);
    if (error) return toast.error(error.message);

    session = data.session;
    toast.success('Welcome back!');
    renderSync();
  };

  const handleSignup = async () => {
    const email = parentElement.querySelector('#auth-email')?.value;
    const password = parentElement.querySelector('#auth-password')?.value;
    if (!email || !password) return toast.error('Please enter email and password');

    toast.info('Creating account...');
    const { data, error } = await signUp(email, password);
    if (error) return toast.error(error.message);

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
};

// Organized Styles
const settingsStyles = document.createElement('style');
settingsStyles.textContent = `
  .settings-page { max-width: 700px; margin: 0 auto; padding-bottom: var(--space-16); }
  .settings-header { margin-bottom: var(--space-8); }
  .settings-sections { display: flex; flex-direction: column; gap: var(--space-6); }
  .settings-section { padding: var(--space-6); }
  .settings-section__title { font-size: var(--text-lg); margin-bottom: var(--space-6); padding-bottom: var(--space-3); border-bottom: 1px solid var(--color-border); }
  .setting-item { display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); padding: var(--space-4) 0; border-bottom: 1px solid var(--color-border); }
  .setting-item:last-child { border-bottom: none; }
  .setting-item__label { font-size: var(--text-base); font-weight: 600; margin-bottom: var(--space-1); }
  .setting-item__desc { font-size: var(--text-sm); color: var(--color-text-muted); }
  .theme-toggle-group { display: flex; gap: var(--space-2); padding: 4px; background: var(--color-bg-subtle); border-radius: var(--radius-lg); }
  .theme-btn { padding: var(--space-2) var(--space-4); border: none; background: transparent; border-radius: var(--radius-md); cursor: pointer; transition: all var(--duration-fast); }
  .theme-btn.active { background: var(--color-surface); box-shadow: var(--shadow-sm); }
  .view-mode-selector { display: flex; gap: var(--space-3); }
  .view-mode-option { cursor: pointer; position: relative; }
  .view-mode-option input { position: absolute; opacity: 0; }
  .view-mode-option__card { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-3); background: var(--color-bg-subtle); border: 2px solid var(--color-border); border-radius: var(--radius-md); }
  .view-mode-option input:checked + .view-mode-option__card { border-color: var(--color-primary); background: var(--color-primary-light); }
  .view-mode-option__preview { display: flex; gap: 4px; padding: 8px; background: var(--color-surface); border-radius: var(--radius-sm); }
  .view-mode-option__preview--stacked { flex-direction: column; }
  .preview-box { width: 24px; height: 16px; background: var(--color-border); border-radius: 2px; }
  .toggle { position: relative; width: 48px; height: 28px; }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .toggle__slider { position: absolute; cursor: pointer; inset: 0; background: var(--color-border); border-radius: var(--radius-full); transition: var(--duration-fast); }
  .toggle__slider::before { content: ''; position: absolute; height: 20px; width: 20px; left: 4px; bottom: 4px; background: white; border-radius: 50%; transition: var(--duration-fast); }
  .toggle input:checked + .toggle__slider { background: var(--color-primary); }
  .toggle input:checked + .toggle__slider::before { transform: translateX(20px); }
  .about-info { text-align: center; padding: var(--space-4); }
  .about-logo { font-size: var(--text-3xl); color: var(--color-primary); margin-bottom: var(--space-2); }
  .settings-footer { margin-top: var(--space-12); text-align: center; }

  /* Auth Styles */
  .auth-status { display: flex; justify-content: space-between; align-items: center; background: var(--color-bg-subtle); padding: var(--space-4); border-radius: var(--radius-md); }
  .auth-status__info { display: flex; flex-direction: column; gap: 4px; }
  .auth-status__badge { font-size: 10px; font-weight: 700; color: var(--color-success); background: var(--color-success-light); padding: 2px 6px; border-radius: var(--radius-sm); width: fit-content; }
  .auth-status__email { font-weight: 500; font-size: var(--text-sm); }
  .auth-status__actions { display: flex; gap: var(--space-2); }
  .auth-form { display: flex; flex-direction: column; gap: var(--space-3); }
  .auth-form__actions { display: flex; gap: var(--space-3); margin-top: var(--space-1); }
  .auth-form__actions .btn { flex: 1; }
`;
document.head.appendChild(settingsStyles);

export default Settings;
