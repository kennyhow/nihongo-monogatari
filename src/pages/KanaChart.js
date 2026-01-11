/**
 * Kana Chart Page
 * Displays Hiragana and Katakana tables with romaji.
 */

import { KANA_DATA } from '../data/kana.js';
import { createEventManager } from '../utils/componentBase.js';

// Vowel column headers
const VOWELS = ['a', 'i', 'u', 'e', 'o'];

// Section definitions with their names
const SECTIONS = [
  { key: 'basic', name: 'Basic' },
  { key: 'dakuten', name: 'Dakuten (Voiced)' },
  { key: 'handakuten', name: 'Handakuten (Semi-voiced)' },
];

const KanaChart = parentElement => {
  // Event manager
  const events = createEventManager();

  let currentSystem = 'hiragana'; // 'hiragana' or 'katakana'

  const render = () => {
    const data = KANA_DATA[currentSystem];

    const html = `
      <div class="kana-page animate-fade-in">
        <div class="kana-header">
          <h1>Kana Chart</h1>
          <p class="text-muted">Master the basics of Japanese reading.</p>

          <div class="kana-toggle">
            <button class="toggle-btn ${currentSystem === 'hiragana' ? 'active' : ''}" data-system="hiragana">Hiragana</button>
            <button class="toggle-btn ${currentSystem === 'katakana' ? 'active' : ''}" data-system="katakana">Katakana</button>
          </div>
        </div>

        <div class="kana-sections">
          ${SECTIONS.map(
            section => `
            <div class="kana-section">
              <h3 class="kana-section-title">${section.name}</h3>
              <div class="kana-grid-wrapper">
                <!-- Column headers -->
                <div class="kana-grid kana-grid--with-labels">
                  <div class="kana-corner"></div>
                  ${VOWELS.map(
                    vowel => `
                    <div class="kana-header-cell">${vowel}</div>
                  `
                  ).join('')}
                </div>

                <!-- Rows -->
                ${data[section.key]
                  .map(
                    row => `
                  <div class="kana-grid kana-grid--with-labels">
                    <div class="kana-row-label">${row.label || ' '}</div>
                    ${row.kana
                      .map(
                        (kana, i) => `
                      <div class="kana-card ${!kana ? 'kana-card--empty' : ''}">
                        ${
                          kana
                            ? `
                          <div class="kana-char">${kana}</div>
                          <div class="kana-romaji">${row.romaji[i]}</div>
                        `
                            : ''
                        }
                      </div>
                    `
                      )
                      .join('')}
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>
          `
          ).join('')}
        </div>

        <div class="kana-info">
          <div class="info-card">
            <h3>💡 Tips</h3>
            <ul>
              <li><strong>Hiragana</strong> is used for native Japanese words and grammar.</li>
              <li><strong>Katakana</strong> is used for foreign loanwords and emphasis.</li>
              <li><strong>Dakuten</strong> (゛) adds voice: ka→ga, sa→za, ta→da, ha→ba</li>
              <li><strong>Handakuten</strong> (゜) makes 'p' sounds: ha→pa</li>
              <li>Practice writing each character to build muscle memory!</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    parentElement.innerHTML = html;
    setupListeners();
  };

  const setupListeners = () => {
    // Use delegation for toggle buttons
    events.delegate(parentElement, 'click', '.toggle-btn', function () {
      currentSystem = this.dataset.system;
      render();
    });
  };

  render();

  // Cleanup
  return () => {
    events.cleanup();
  };
};

// Add styles
const kanaStyles = document.createElement('style');
kanaStyles.textContent = `
  .kana-page {
    padding-bottom: var(--space-12);
    max-width: 900px;
    margin: 0 auto;
  }

  .kana-header {
    text-align: center;
    margin-bottom: var(--space-8);
  }

  .kana-toggle {
    display: inline-flex;
    background: var(--color-bg-subtle);
    padding: 4px;
    border-radius: var(--radius-lg);
    margin-top: var(--space-6);
  }

  .toggle-btn {
    padding: var(--space-2) var(--space-6);
    border: none;
    background: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-weight: 600;
    transition: all var(--duration-fast);
    color: var(--color-text-muted);
  }

  .toggle-btn.active {
    background: var(--color-surface);
    color: var(--color-primary);
    box-shadow: var(--shadow-sm);
  }

  /* Sections */
  .kana-sections {
    display: flex;
    flex-direction: column;
    gap: var(--space-10);
  }

  .kana-section {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: var(--space-6);
  }

  .kana-section-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-primary);
    margin: 0 0 var(--space-5) 0;
    text-align: center;
  }

  .kana-grid-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  /* Grid with labels */
  .kana-grid--with-labels {
    grid-template-columns: auto repeat(5, 1fr);
  }

  .kana-grid {
    display: grid;
    gap: var(--space-2);
  }

  /* Column headers */
  .kana-corner {
    width: var(--space-8);
  }

  .kana-header-cell {
    text-align: center;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    font-size: var(--text-sm);
    padding: var(--space-2);
  }

  /* Row labels */
  .kana-row-label {
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    font-size: var(--text-sm);
    width: var(--space-8);
    padding: var(--space-2);
  }

  /* Kana cards */
  .kana-card {
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-3);
    text-align: center;
    transition: transform var(--duration-fast), box-shadow var(--duration-fast), border-color var(--duration-fast);
    min-height: var(--space-12);
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .kana-card:not(.kana-card--empty):hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: var(--color-primary);
    background: var(--color-surface);
  }

  .kana-card--empty {
    background: transparent;
    border: 1px dashed var(--color-border);
    opacity: 0.3;
  }

  .kana-char {
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    color: var(--color-text);
    margin-bottom: var(--space-1);
    line-height: 1.2;
  }

  .kana-romaji {
    font-size: 10px;
    color: var(--color-text-muted);
    text-transform: lowercase;
    letter-spacing: 0.02em;
  }

  /* Info section */
  .kana-info {
    margin-top: var(--space-10);
  }

  .info-card {
    background: var(--color-bg-subtle);
    padding: var(--space-6);
    border-radius: var(--radius-xl);
  }

  .info-card h3 {
    margin-bottom: var(--space-4);
    font-size: var(--text-lg);
  }

  .info-card ul {
    list-style: none;
    padding: 0;
  }

  .info-card li {
    margin-bottom: var(--space-3);
    padding-left: var(--space-6);
    position: relative;
    color: var(--color-text-secondary);
    line-height: 1.6;
  }

  .info-card li::before {
    content: "•";
    position: absolute;
    left: 0;
    color: var(--color-primary);
    font-weight: bold;
  }

  /* Dark mode adjustments */
  [data-theme="dark"] .kana-section {
    background: var(--color-bg-subtle);
    border-color: var(--color-border);
  }

  [data-theme="dark"] .kana-card {
    background: var(--color-surface);
  }

  [data-theme="dark"] .kana-card:not(.kana-card--empty):hover {
    background: var(--color-bg-subtle);
  }

  /* Responsive */
  @media (max-width: 600px) {
    .kana-grid--with-labels {
      grid-template-columns: auto repeat(5, 1fr);
      gap: var(--space-1);
    }

    .kana-card {
      padding: var(--space-2);
      min-height: var(--space-10);
    }

    .kana-char {
      font-size: var(--text-xl);
    }

    .kana-romaji {
      font-size: 9px;
    }

    .kana-corner,
    .kana-row-label {
      width: var(--space-6);
      font-size: 10px;
    }

    .kana-section {
      padding: var(--space-4);
    }
  }
`;
document.head.appendChild(kanaStyles);

export default KanaChart;
