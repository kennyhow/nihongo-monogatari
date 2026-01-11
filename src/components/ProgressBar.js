const ProgressBar = ({ current, total }) => {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));

  return `
    <div class="progress-container">
      <div class="progress-track">
        <div class="progress-fill" style="width: ${percentage}%;"></div>
      </div>
      <span class="progress-text">
        ${Math.round(percentage)}%
      </span>
    </div>
  `;
};

export default ProgressBar;
