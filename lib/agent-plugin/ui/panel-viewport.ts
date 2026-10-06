/** Keep the narrow-screen composer in the visual viewport without disabling pinch zoom. */
export function mountPanelViewport(panel: HTMLElement): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => {};
  const reset = () => {
    panel.style.removeProperty('height');
    panel.style.removeProperty('top');
  };
  const update = () => {
    if (
      window.innerWidth > 480 ||
      viewport.scale !== 1 ||
      !Number.isFinite(viewport.height) ||
      viewport.height <= 0 ||
      !Number.isFinite(viewport.offsetTop)
    ) {
      reset();
      return;
    }
    panel.style.height = `${viewport.height}px`;
    panel.style.top = `${Math.max(0, viewport.offsetTop)}px`;
  };
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  update();
  return () => {
    viewport.removeEventListener('resize', update);
    viewport.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
    reset();
  };
}
