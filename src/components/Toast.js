/**
 * Toast Notification System
 * Shows dismissible notifications for success, error, warning messages
 */

import { createEventManager } from '../utils/componentBase.js';

let toastContainer = null;
const toasts = new Map();
const toastEventManagers = new Map(); // Store EventManagers separately
let toastIdCounter = 0;

/**
 * Get or create the toast container
 */
const getContainer = () => {
  if (!toastContainer || !document.contains(toastContainer)) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('role', 'alert');
    toastContainer.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
};

/**
 * Show a toast notification
 * @param {Object} options - Toast options
 * @param {string} options.message - Message to display
 * @param {string} [options.type='info'] - Toast type: 'success', 'error', 'warning', 'info'
 * @param {number} [options.duration=4000] - Duration in ms (0 for persistent)
 * @param {Function} [options.action] - Optional action callback
 * @param {string} [options.actionLabel] - Label for action button
 * @returns {string} Toast ID for programmatic dismissal
 */
export const showToast = ({
  message,
  type = 'info',
  duration = 4000,
  action,
  actionLabel = 'Undo',
}) => {
  const container = getContainer();
  const id = `toast-${++toastIdCounter}`;

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.id = id;
  toast.innerHTML = `
    <span class="toast__icon">${icons[type] || icons.info}</span>
    <span class="toast__message">${message}</span>
    ${action ? `<button class="btn btn--sm btn--ghost toast__action">${actionLabel}</button>` : ''}
    <button class="icon-btn toast__close" aria-label="Dismiss">✕</button>
  `;

  container.appendChild(toast);
  toasts.set(id, toast);

  // Event handlers with EventManager for automatic cleanup
  const events = createEventManager();
  const closeBtn = toast.querySelector('.toast__close');
  events.on(closeBtn, 'click', () => dismissToast(id));

  if (action) {
    const actionBtn = toast.querySelector('.toast__action');
    events.on(actionBtn, 'click', () => {
      action();
      dismissToast(id);
    });
  }

  // Store events manager for cleanup in a Map (not dataset - dataset only stores strings!)
  toastEventManagers.set(id, events);

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }

  return id;
};

/**
 * Dismiss a toast by ID
 * @param {string} id - Toast ID
 */
export const dismissToast = id => {
  const toast = toasts.get(id);
  if (!toast) {
    return;
  }

  // Clean up event listeners
  const events = toastEventManagers.get(id);
  if (events) {
    events.cleanup();
    toastEventManagers.delete(id);
  }

  toast.style.animation = 'toastSlideOut 0.3s ease-out forwards';
  setTimeout(() => {
    toast.remove();
    toasts.delete(id);
  }, 300);
};

/**
 * Shorthand helpers
 */
export const toast = {
  success: (message, options = {}) => showToast({ message, type: 'success', ...options }),
  error: (message, options = {}) =>
    showToast({ message, type: 'error', duration: 6000, ...options }),
  warning: (message, options = {}) => showToast({ message, type: 'warning', ...options }),
  info: (message, options = {}) => showToast({ message, type: 'info', ...options }),
};

// Add the slide out animation to the stylesheet
const style = document.createElement('style');
style.textContent = `
  @keyframes toastSlideOut {
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }
`;
document.head.appendChild(style);
