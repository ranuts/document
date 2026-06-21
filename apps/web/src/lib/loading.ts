import 'ranui/loading';

export type LoadingController = {
  removeLoading: () => void;
  setProgress: (percent: number, label?: string) => void;
};

// Auto-progress stages while waiting for editor to initialize
const STAGES = [
  { to: 12, ms: 600, label: 'Initializing…' },
  { to: 45, ms: 3200, label: 'Loading document engine…' },
  { to: 72, ms: 2200, label: 'Processing document…' },
  { to: 90, ms: 1800, label: 'Rendering…' },
];

export const showLoading = (): LoadingController => {
  const mask = document.createElement('div');
  mask.className = 'loading-overlay';

  const spinner = document.createElement('r-loading');
  spinner.setAttribute('name', 'circle');
  spinner.setAttribute('size', 'large');
  spinner.style.cssText = 'color: #1890ff; font-size: 28px;';

  const progressWrap = document.createElement('div');
  progressWrap.className = 'loading-progress-wrap';

  const progressBar = document.createElement('div');
  progressBar.className = 'loading-progress-bar';
  progressWrap.appendChild(progressBar);

  const statusLabel = document.createElement('p');
  statusLabel.className = 'loading-status';
  statusLabel.textContent = 'Initializing…';

  mask.appendChild(spinner);
  mask.appendChild(progressWrap);
  mask.appendChild(statusLabel);
  document.body.appendChild(mask);

  let current = 0;
  let stageIdx = 0;
  let intervalId: ReturnType<typeof setInterval>;

  const applyProgress = (pct: number, text?: string) => {
    current = pct;
    progressBar.style.width = `${pct}%`;
    if (text) statusLabel.textContent = text;
  };

  const tick = () => {
    if (stageIdx >= STAGES.length) {
      clearInterval(intervalId);
      return;
    }
    const s = STAGES[stageIdx];
    const step = (s.to - current) / (s.ms / 80);
    const next = Math.min(current + step, s.to);
    applyProgress(next, s.label);
    if (current >= s.to) stageIdx++;
  };
  intervalId = setInterval(tick, 80);

  const setProgress = (percent: number, label?: string) => {
    clearInterval(intervalId);
    applyProgress(percent, label);
  };

  const removeLoading = () => {
    clearInterval(intervalId);
    applyProgress(100, 'Ready!');
    setTimeout(() => {
      mask.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(mask)) document.body.removeChild(mask);
      }, 280);
    }, 320);
  };

  return { removeLoading, setProgress };
};
