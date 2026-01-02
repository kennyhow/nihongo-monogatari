/**
 * Kana Chart Page
 * Displays Hiragana and Katakana tables with romaji.
 */

import { KANA_DATA } from '../data/kana.js';
import { createEventManager } from '../utils/componentBase.js';

const KanaChart = parentElement => {
  // Event manager
  const events = createEventManager();

  let currentSystem = 'hiragana'; // 'hiragana' or 'katakana'

  const render = () => {
    const data = KANA_DATA[currentSystem];

    // Group into rows of 5
    const rows = [];
    for (let i = 0; i < data.length; i += 5) {
      rows.push(data.slice(i, i + 5).reverse()); // Reverse to show a, i, u, e, o from left if needed?
      // Japanese charts usually go:
      // a i u e o
      // ka ki ku ke ko
      // Actually, let's just keep the order as provided in kana.js
    }

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

        <div class="kana-grid-container">
          <div class="kana-grid">
            ${data
              .map(
                item => `
              <div class="kana-card ${!item.kana ? 'kana-card--empty' : ''}">
                ${
                  item.kana
                    ? `
                  <div class="kana-char">${item.kana}</div>
                  <div class="kana-romaji">${item.romaji}</div>
                `
                    : ''
                }
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="kana-info">
          <div class="info-card">
            <h3>💡 Tips</h3>
            <ul>
              <li><strong>Hiragana</strong> is used for native Japanese words and grammar.</li>
              <li><strong>Katakana</strong> is used for foreign loanwords and emphasis.</li>
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
    max-width: 800px;
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

  .kana-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--space-3);
    margin-bottom: var(--space-8);
  }

  .kana-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-4) var(--space-2);
    text-align: center;
    transition: transform var(--duration-fast), box-shadow var(--duration-fast);
  }

  .kana-card:not(.kana-card--empty):hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: var(--color-primary-light);
  }

  .kana-card--empty {
    background: transparent;
    border: none;
  }

  .kana-char {
    font-family: var(--font-display);
    font-size: var(--text-3xl);
    color: var(--color-text);
    margin-bottom: var(--space-1);
  }

  .kana-romaji {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

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
  }

  .info-card li::before {
    content: "•";
    position: absolute;
    left: 0;
    color: var(--color-primary);
    font-weight: bold;
  }

  @media (max-width: 480px) {
    .kana-char {
      font-size: var(--text-2xl);
    }
  }
`;
document.head.appendChild(kanaStyles);

export default KanaChart;
