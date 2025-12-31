import { saveProgress, getStoryProgress, getSettings } from '../utils/storage.js';
import ProgressBar from './ProgressBar.js';
import { playAudio, cancelAudio, preloadNextSegment } from '../utils/audio.js';

const Reader = ({ story, initialProgress, onComplete }) => {
  const settings = getSettings();
  const isSideBySide = settings.viewMode === 'side-by-side';
  const showFurigana = settings.showFurigana;

  // State
  let currentProgress = initialProgress?.completed ? 100 : 0;
  let activeSegmentIndex = -1; // -1 means none playing

  // HTML Generation
  const render = () => {
    const html = `
      <div class="reader-container">
        <div class="reader-header" style="position: sticky; top: 0; background: var(--color-bg); z-index: 10; padding: 1rem 0; border-bottom: 1px solid var(--color-border); margin-bottom: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
              <h2 class="jp-title" style="margin: 0; font-size: 1.25rem;">${story.titleJP}</h2>
              <span style="font-size: 0.875rem; color: var(--color-text-muted);">${story.titleEN}</span>
            </div>
            
             <button id="stop-audio-btn" class="btn" style="
               padding: 0.25rem 0.75rem; 
               font-size: 0.875rem; 
               background-color: transparent; 
               color: var(--color-secondary); 
               border: 1px solid var(--color-secondary);
               box-shadow: none;
             ">
              ⏹️ Stop Audio
            </button>
          </div>
          ${ProgressBar({ current: currentProgress, total: 100 })}
        </div>

        <div class="story-content ${isSideBySide ? 'view-side-by-side' : 'view-stacked'}" style="
          display: grid; 
          grid-template-columns: ${isSideBySide ? '1fr 1fr' : '1fr'}; 
          gap: ${isSideBySide ? '2rem' : '3rem'};
        ">
          ${story.content.map((segment, index) => `
            <div class="segment ${index === activeSegmentIndex ? 'active-reading' : ''}" id="segment-${index}" style="margin-bottom: ${isSideBySide ? '2rem' : '0'}; opacity: ${activeSegmentIndex !== -1 && activeSegmentIndex !== index ? '0.5' : '1'}; transition: opacity 0.3s;">
              <div class="jp-segment notification-target" style="
                position: relative;
                font-size: ${settings.fontSize === 'large' ? '1.5rem' : '1.25rem'}; 
                line-height: 1.8; 
                margin-bottom: 1rem;
                padding: 1rem;
                background-color: var(--color-surface);
                border-radius: var(--radius-md);
                box-shadow: var(--shadow-sm);
                border: ${index === activeSegmentIndex ? '2px solid var(--color-accent)' : '2px solid transparent'};
                cursor: pointer;
                transition: border-color 0.2s;
              " title="Click to listen">
                <button class="play-hint" style="
                  position: absolute; top: 0.5rem; right: 0.5rem; 
                  background: none; border: none; opacity: 0.3; font-size: 1rem; cursor: pointer;
                ">🔊</button>
                <p class="jp-text">${(showFurigana && segment.jp_furigana) ? segment.jp_furigana : segment.jp}</p>
              </div>
              
              <div class="en-segment" style="
                font-size: 1rem; 
                color: var(--color-text-muted);
                padding: 0 1rem;
                line-height: 1.6;
              ">
                <p>${segment.en}</p>
                ${segment.notes && segment.notes.length > 0 ? `
                  <div class="notes" style="margin-top: 0.5rem; font-size: 0.85rem; border-top: 1px dashed var(--color-border); padding-top: 0.5rem;">
                    ${segment.notes.map(note => `
                      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.25rem;">
                        <span style="font-weight: 500; color: var(--color-primary);">${note.term}:</span>
                        <span>${note.meaning}</span>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="reader-footer" style="margin-top: 4rem; text-align: center; padding-bottom: 4rem;">
          <button id="complete-btn" class="btn" style="padding: 1rem 3rem; font-size: 1.125rem;">
            Finish Story
          </button>
        </div>
      </div>
    `;

    // Check if we are re-rendering into existing element or creating new
    if (containerElement.innerHTML === '') {
      containerElement.innerHTML = html;
    } else {
      // Diffing is hard in vanilla, let's just cheat and update class names for active state
      // This is a bit hacky but prevents full re-render flickering
      story.content.forEach((_, idx) => {
        const seg = containerElement.querySelector(`#segment-${idx}`);
        const box = seg.querySelector('.jp-segment');
        if (idx === activeSegmentIndex) {
          seg.style.opacity = '1';
          box.style.borderColor = 'var(--color-accent)';
        } else {
          seg.style.opacity = activeSegmentIndex !== -1 ? '0.5' : '1';
          box.style.borderColor = 'transparent';
        }
      });
      return;
      // Note: the full re-render below is safer for logic simplicty if we accept flicker, 
      // but let's try to just update container if it exists.
      // Actually, for simplicity I'll full re-render on initial load, but for state updates I'll do DOM manipulation
    }

    setupListeners();
  };

  const setupListeners = () => {
    // Play Audio Listeners
    story.content.forEach((segment, index) => {
      const el = containerElement.querySelector(`#segment-${index} .jp-segment`);
      el.addEventListener('click', () => {
        playSegment(index);
      });
    });

    // Stop Audio
    containerElement.querySelector('#stop-audio-btn').addEventListener('click', () => {
      cancelAudio();
      activeSegmentIndex = -1;
      render(); // Update UI
    });

    // Complete
    containerElement.querySelector('#complete-btn').addEventListener('click', () => {
      saveProgress(story.id, { completed: true });
      cancelAudio();
      if (onComplete) onComplete();
    });
  };

  const playSegment = (index) => {
    activeSegmentIndex = index;
    render(); // Update UI to highlight

    playAudio(story.content[index].jp, () => {
      // On finish
      activeSegmentIndex = -1;
      render();
    });

    // Lazy load next segment
    if (index + 1 < story.content.length) {
      preloadNextSegment(story.content[index + 1].jp);
    }
  };

  // Helper for mock furigana (in a real app, this would be parsed better)
  function addFurigana(text) {
    return text;
  }

  // Responsive layout check
  const mediaQuery = window.matchMedia('(max-width: 768px)');
  const handleResize = (e) => {
    const content = containerElement.querySelector('.story-content');
    if (!content) return;
    if (e.matches) {
      content.style.gridTemplateColumns = '1fr';
    } else if (isSideBySide) {
      content.style.gridTemplateColumns = '1fr 1fr';
    }
  };


  // Element creation to return
  const containerElement = document.createElement('div');
  render();

  mediaQuery.addListener(handleResize);
  // Defer resize check until it's in DOM or just trust CSS initial
  setTimeout(() => handleResize(mediaQuery), 0);

  // Cleanup on unmount (manual in vanilla)
  // We can't easily detect unmount here without a framework, but `cancelAudio` should be called by the router/page wrapper

  return containerElement;
};

export default Reader;
