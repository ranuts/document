import type { ChatMessage, ChatMessageAction } from '@ranuts/chat-ui';
export interface ResultActionLabels {
  shorter: string;
  bullets: string;
  summarize: string;
  shorterPrompt: string;
  bulletsPrompt: string;
  summarizePrompt: string;
  source: string;
  conflict: string;
  replace: string;
  keep: string;
}
/** Host-owned follow-ups only stage bounded plain text. Sending remains the composer's job. */
export function createResultActions(options: {
  composer: HTMLTextAreaElement;
  getInput(): string;
  setInput(text: string): void;
  focus(): void;
  session(): string;
  onStage(): void;
  labels(): ResultActionLabels;
}) {
  const el = document.createElement('section');
  el.className = 'agent-result-choice';
  el.hidden = true;
  let disposed = false;
  let composing = false;
  let pending: { text: string; draft: string; session: string } | undefined;
  const startComposition = () => {
    composing = true;
  };
  const endComposition = () => {
    composing = false;
  };
  options.composer.addEventListener('compositionstart', startComposition);
  options.composer.addEventListener('compositionend', endComposition);
  el.addEventListener('pointerdown', (event) => {
    if (composing) event.preventDefault();
  });
  function cancel(): void {
    pending = undefined;
    el.hidden = true;
    el.replaceChildren();
  }
  function stage(text: string): void {
    options.setInput(text);
    options.onStage();
    cancel();
    options.focus();
  }
  function render(): void {
    if (!pending) return;
    const labels = options.labels();
    const hint = document.createElement('p');
    hint.setAttribute('role', 'status');
    hint.textContent = labels.conflict;
    const preview = document.createElement('p');
    preview.className = 'agent-result-choice-preview';
    preview.textContent = pending.text.split('\n\n')[0];
    const replace = document.createElement('button');
    replace.type = 'button';
    replace.dataset.action = 'replace';
    replace.textContent = labels.replace;
    const keep = document.createElement('button');
    keep.type = 'button';
    keep.dataset.action = 'keep';
    keep.textContent = labels.keep;
    replace.addEventListener('click', () => {
      if (disposed || composing || !pending) return;
      if (pending.session !== options.session()) return cancel();
      if (pending.draft !== options.getInput()) {
        pending.draft = options.getInput();
        render();
        return;
      }
      stage(pending.text);
    });
    keep.addEventListener('click', () => {
      cancel();
      options.focus();
    });
    el.replaceChildren(hint, preview, replace, keep);
    el.hidden = false;
  }
  function suggest(text: string, session: string): void {
    if (disposed || composing || session !== options.session()) return;
    if (!options.getInput().trim()) return stage(text);
    pending = { text, draft: options.getInput(), session };
    render();
  }
  return {
    el,
    cancel,
    refresh: render,
    actions(message: ChatMessage): readonly ChatMessageAction[] {
      if (disposed || message.role !== 'agent' || message.interrupted || message.copyOnly) return [];
      const session = options.session();
      if (message.metadata?.conversation && message.metadata.conversation !== session) return [];
      const labels = options.labels();
      const choices = message.documentArtifact
        ? [
            ['shorter', labels.shorter, labels.shorterPrompt],
            ['bullets', labels.bullets, labels.bulletsPrompt],
          ]
        : Array.isArray(message.metadata?.sources) && message.metadata.sources.length
          ? [['summarize', labels.summarize, labels.summarizePrompt]]
          : [];
      return choices.map(([id, label]) => ({
        id,
        label,
        run: (source: string) => {
          // Bounded excerpts are visible in the composer for review; no hidden response data is sent.
          const current = options.labels();
          const prompt =
            id === 'shorter'
              ? current.shorterPrompt
              : id === 'bullets'
                ? current.bulletsPrompt
                : current.summarizePrompt;
          const excerpt = source.slice(0, 6000);
          suggest(`${prompt}\n\n${current.source}:\n${excerpt}${source.length > excerpt.length ? '\n…' : ''}`, session);
        },
      }));
    },
    dispose(): void {
      disposed = true;
      options.composer.removeEventListener('compositionstart', startComposition);
      options.composer.removeEventListener('compositionend', endComposition);
      cancel();
      el.remove();
    },
  };
}
