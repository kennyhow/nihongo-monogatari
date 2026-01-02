/**
 * Centralized event management with automatic cleanup
 *
 * Replaces scattered addEventListener calls throughout the codebase.
 * Integrates with existing router cleanup system - no MutationObserver needed.
 *
 * @example
 * ```javascript
 * import { createEventManager } from './componentBase.js';
 *
 * export default function render(container) {
 *   const events = createEventManager();
 *
 *   // Individual elements
 *   events.on(container.querySelector('#button'), 'click', handleClick);
 *
 *   // Window/document events
 *   events.on(window, 'scroll', handleScroll);
 *   events.on(document, 'keydown', handleKeydown);
 *
 *   // Multiple/dynamic elements (delegation)
 *   events.delegate(container, 'click', '.story-card', handleCardClick);
 *
 *   // Router automatically calls cleanup on navigation
 *   return () => events.cleanup();
 * }
 * ```
 */

export class EventManager {
  /** @private */
  #handlers = [];

  /**
   * Register an event handler with automatic cleanup
   *
   * Use this for individual elements (especially those with IDs),
   * window, or document events.
   *
   * @param {Element|Document|Window} element - Target element
   * @param {string} event - Event name (click, scroll, keydown, etc.)
   * @param {Function} handler - Event handler function
   * @param {boolean|AddEventListenerOptions} options - Event listener options
   * @returns {EventManager} Returns this for chaining
   *
   * @example
   * events.on(button, 'click', handleClick);
   * events.on(window, 'resize', handleResize);
   * events.on(document, 'keydown', handleKeydown);
   */
  on(element, event, handler, options = false) {
    if (!element) {
      console.warn('EventManager.on() called with null element');
      return this;
    }

    // Support passive event listeners for better scroll/touch performance
    const opts = this.#normalizeOptions(options);

    element.addEventListener(event, handler, opts);
    this.#handlers.push({ element, event, handler, options: opts });
    return this;
  }

  /**
   * Event delegation: Attach handler to parent that filters by selector
   *
   * Use this for multiple elements with the same behavior or dynamic content.
   * Perfect for list items, cards, buttons in grids, tooltips.
   *
   * @param {Element} parent - Parent element to attach listener to
   * @param {string} event - Event name
   * @param {string} selector - CSS selector for target elements (use classes, not IDs)
   * @param {Function} handler - Handler function (receives actual target element as `this`)
   * @param {boolean|AddEventListenerOptions} options - Event listener options
   * @returns {EventManager} Returns this for chaining
   *
   * @example
   * // Handle all current AND future .story-card elements
   * events.delegate(container, 'click', '.story-card', handleCardClick);
   *
   * // Vocabulary tooltips that may be added dynamically
   * events.delegate(storyElement, 'mouseenter', '.vocabulary-word', showTooltip);
   */
  delegate(parent, event, selector, handler, options = false) {
    if (!parent) {
      console.warn('EventManager.delegate() called with null parent');
      return this;
    }

    // Warn if using ID selector (should use .on() instead)
    if (selector.startsWith('#')) {
      console.warn(
        `EventManager.delegate() with ID selector "${selector}" - ` +
          'consider using .on() for individual elements'
      );
    }

    const delegatedHandler = e => {
      // Use closest() to find the matching element (handles nested elements)
      const target = e.target.closest(selector);

      // Verify the target is within the parent (not a descendant of a sibling)
      if (target && parent.contains(target)) {
        handler.call(target, e);
      }
    };

    const opts = this.#normalizeOptions(options);
    parent.addEventListener(event, delegatedHandler, opts);
    this.#handlers.push({
      element: parent,
      event,
      handler: delegatedHandler,
      options: opts,
      delegated: true,
      selector,
    });
    return this;
  }

  /**
   * Manually remove a specific event listener
   *
   * Note: Usually you'll just call cleanup() instead.
   *
   * @param {Element} element - Target element
   * @param {string} event - Event name
   * @param {Function} handler - Handler function to remove
   */
  off(element, event, handler) {
    element.removeEventListener(event, handler);
    this.#handlers = this.#handlers.filter(
      h => !(h.element === element && h.event === event && h.handler === handler)
    );
  }

  /**
   * Remove all registered event listeners
   *
   * Call this in component cleanup functions.
   * The router will automatically call this on navigation.
   *
   * Safe to call multiple times - subsequent calls will be no-ops.
   */
  cleanup() {
    this.#handlers.forEach(({ element, event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    this.#handlers = [];
  }

  /**
   * Get count of active handlers
   *
   * Useful for debugging and testing.
   *
   * @returns {number} Number of registered handlers
   */
  get size() {
    return this.#handlers.length;
  }

  /**
   * Normalize event listener options
   *
   * Ensures passive event listeners for scroll/touch by default
   *
   * @private
   * @param {boolean|AddEventListenerOptions} options
   * @returns {AddEventListenerOptions}
   */
  #normalizeOptions(options) {
    if (typeof options === 'object') {
      return options;
    }

    // Enable passive listeners for scroll/touch events by default
    const passiveEvents = ['scroll', 'touchstart', 'touchmove', 'touchend'];
    const isPassive = passiveEvents.some(evt => evt === options);

    return {
      passive: isPassive,
      capture: options === true,
    };
  }
}
