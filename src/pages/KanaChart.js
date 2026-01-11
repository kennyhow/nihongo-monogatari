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

// Styles now in external CSS: src/styles/pages/kanachart.css
export default KanaChart;
