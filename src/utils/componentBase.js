/**
 * Component Base Utilities
 * Lightweight helpers for vanilla JS components with lifecycle support
 */

import { EventManager } from './eventManager.js';

// Global cleanup registry - stores cleanup functions by component ID
const cleanupRegistry = new Map();
let componentIdCounter = 0;

/**
 * Creates a DOM element from an HTML string
 * @param {string} html - HTML string to convert
 * @returns {HTMLElement} The created element
 */
export const createElement = html => {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
};

/**
 * Creates a component with lifecycle management
 * @param {Object} config - Component configuration
 * @param {Function} config.render - Returns HTML string
 * @param {Function} [config.onMount] - Called after element is in DOM
 * @param {Function} [config.onUnmount] - Called when element is removed
 * @returns {HTMLElement} The component element with lifecycle attached
 */
export const createComponent = ({ render, onMount, onUnmount }) => {
  const id = `component-${++componentIdCounter}`;
  const html = render();
  const element = createElement(html);
  element.dataset.componentId = id;

  // Store cleanup functions
  const cleanups = [];
  if (onUnmount) {
    cleanups.push(onUnmount);
  }
  cleanupRegistry.set(id, cleanups);

  // Schedule onMount for next frame (after element is in DOM)
  if (onMount) {
    requestAnimationFrame(() => {
      if (document.contains(element)) {
        onMount(element);
      }
    });
  }

  return element;
};

/**
 * Register a cleanup function for a component
 * @param {HTMLElement} element - Component element
 * @param {Function} cleanupFn - Function to call on unmount
 */
export const useCleanup = (element, cleanupFn) => {
  const id = element.dataset?.componentId;
  if (id && cleanupRegistry.has(id)) {
    cleanupRegistry.get(id).push(cleanupFn);
  }
};

/**
 * Run all cleanup functions for a component
 * @param {HTMLElement} element - Component element or container
 */
export const runCleanups = element => {
  // Find all components in this element
  const components = element.querySelectorAll('[data-component-id]');
  components.forEach(comp => {
    const id = comp.dataset.componentId;
    if (id && cleanupRegistry.has(id)) {
      const cleanups = cleanupRegistry.get(id);
      cleanups.forEach(fn => {
        try {
          fn();
        } catch (e) {
          console.error('Cleanup error:', e);
        }
      });
      cleanupRegistry.delete(id);
    }
  });

  // Also check if element itself is a component
  const id = element.dataset?.componentId;
  if (id && cleanupRegistry.has(id)) {
    const cleanups = cleanupRegistry.get(id);
    cleanups.forEach(fn => {
      try {
        fn();
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    });
    cleanupRegistry.delete(id);
  }
};

/**
 * Simple reactive state helper
 * @param {*} initialValue - Initial state value
 * @returns {[Function, Function]} [getter, setter] tuple
 */
export const createState = initialValue => {
  let value = initialValue;
  const subscribers = new Set();

  const get = () => value;

  const set = newValue => {
    const nextValue = typeof newValue === 'function' ? newValue(value) : newValue;
    if (nextValue !== value) {
      value = nextValue;
      subscribers.forEach(fn => fn(value));
    }
  };

  const subscribe = fn => {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  };

  return { get, set, subscribe };
};

/**
 * Debounce a function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (fn, delay = 300) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Format time in minutes and seconds
 * @param {number} seconds - Total seconds
 * @returns {string} Formatted time string (e.g., "2:45")
 */
export const formatTime = seconds => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Create an EventManager for component lifecycle
 *
 * EventManager provides centralized event handling with automatic cleanup.
 * Use this in components to manage event listeners efficiently.
 *
 * @returns {EventManager} Event manager instance
 *
 * @example
 * import { createEventManager } from './componentBase.js';
 *
 * export default function render(container) {
 *   const events = createEventManager();
 *
 *   events.on(button, 'click', handleClick);
 *   events.delegate(container, 'click', '.card', handleCardClick);
 *
 *   return () => events.cleanup();
 * }
 */
export const createEventManager = () => {
  return new EventManager();
};
