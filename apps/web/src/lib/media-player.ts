// Browser-native media overlay player for PPTX embedded video/audio.
// Called when OnlyOffice SDK fires api.gqc("showMediaControl", ...) in Web Mode
// — the desktop path that would normally delegate to AscDesktopEditor.

export interface MediaEntry {
  key: string; // e.g. "media/video1.mp4"
  url: string; // blob URL
  isVideo: boolean;
}

let activeOverlay: HTMLElement | null = null;

export function hideMediaPlayer(): void {
  if (activeOverlay) {
    activeOverlay.remove();
    activeOverlay = null;
  }
}

export function showMediaPlayer(entries: MediaEntry[]): void {
  hideMediaPlayer();
  if (entries.length === 0) return;

  // Start with the first media entry; show a list if multiple.
  let currentIndex = 0;

  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:99999',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'background:rgba(0,0,0,0.75)',
  ].join(';');
  activeOverlay = overlay;

  // Clicking the backdrop closes the player.
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideMediaPlayer();
  });

  // Keyboard Escape closes the player.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideMediaPlayer();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);

  const panel = document.createElement('div');
  panel.style.cssText = [
    'position:relative',
    'background:#1a1a1a',
    'border-radius:8px',
    'padding:16px',
    'min-width:360px',
    'max-width:90vw',
    'max-height:90vh',
    'display:flex',
    'flex-direction:column',
    'gap:12px',
    'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
  ].join(';');

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = [
    'position:absolute',
    'top:8px',
    'right:10px',
    'background:transparent',
    'border:none',
    'color:#aaa',
    'font-size:18px',
    'cursor:pointer',
    'line-height:1',
    'padding:4px',
  ].join(';');
  closeBtn.addEventListener('click', hideMediaPlayer);
  panel.appendChild(closeBtn);

  // Title bar
  const title = document.createElement('div');
  title.style.cssText = 'color:#ccc;font-size:12px;padding-right:24px;font-family:sans-serif;';
  panel.appendChild(title);

  // Media element container
  const mediaContainer = document.createElement('div');
  mediaContainer.style.cssText = 'display:flex;align-items:center;justify-content:center;';
  panel.appendChild(mediaContainer);

  // Picker list (shown only when >1 media file)
  let pickerEl: HTMLElement | null = null;
  if (entries.length > 1) {
    pickerEl = document.createElement('div');
    pickerEl.style.cssText = [
      'display:flex',
      'flex-direction:column',
      'gap:4px',
      'max-height:120px',
      'overflow-y:auto',
    ].join(';');

    entries.forEach((entry, idx) => {
      const btn = document.createElement('button');
      btn.textContent = (entry.isVideo ? '▶ ' : '♪ ') + entry.key.split('/').pop();
      btn.dataset['idx'] = String(idx);
      btn.style.cssText = [
        'text-align:left',
        'background:transparent',
        'border:1px solid #444',
        'color:#ccc',
        'border-radius:4px',
        'padding:4px 8px',
        'cursor:pointer',
        'font-size:12px',
        'font-family:sans-serif',
      ].join(';');
      btn.addEventListener('click', () => {
        currentIndex = idx;
        renderMedia();
      });
      pickerEl!.appendChild(btn);
    });
    panel.appendChild(pickerEl);
  }

  function renderMedia() {
    mediaContainer.innerHTML = '';
    const entry = entries[currentIndex];
    title.textContent = entry.key.split('/').pop() ?? entry.key;

    // Highlight active picker button
    if (pickerEl) {
      Array.from(pickerEl.querySelectorAll('button')).forEach((b, i) => {
        (b as HTMLButtonElement).style.background = i === currentIndex ? '#333' : 'transparent';
        (b as HTMLButtonElement).style.borderColor = i === currentIndex ? '#666' : '#444';
      });
    }

    if (entry.isVideo) {
      const video = document.createElement('video');
      video.src = entry.url;
      video.controls = true;
      video.autoplay = true;
      video.style.cssText = 'max-width:80vw;max-height:60vh;border-radius:4px;background:#000;';
      mediaContainer.appendChild(video);
    } else {
      const audio = document.createElement('audio');
      audio.src = entry.url;
      audio.controls = true;
      audio.autoplay = true;
      audio.style.cssText = 'width:320px;margin:16px 0;';
      mediaContainer.appendChild(audio);
    }
  }

  renderMedia();
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}
