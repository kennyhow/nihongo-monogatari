const ProgressBar = ({ current, total }) => {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));

  return `
    <div class="progress-container" style="width: 100%; display: flex; align-items: center; gap: 1rem;">
      <div class="progress-track" style="flex: 1; height: 0.5rem; background-color: var(--color-border); border-radius: 9999px; overflow: hidden;">
        <div class="progress-fill" style="width: ${percentage}%; height: 100%; background-color: var(--color-primary); opacity: 0.8; transition: width 0.3s ease;"></div>
      </div>
      <span class="progress-text" style="font-size: 0.875rem; color: var(--color-text-muted); font-variant-numeric: tabular-nums;">
        ${Math.round(percentage)}%
      </span>
    </div>
  `;
};

export default ProgressBar;
