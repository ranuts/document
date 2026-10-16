import type { MessageSaveOutcome } from '@ranuts/chat-ui';
import { ButtonBuilder, Div, View } from 'ranui/builder';
import { ArtifactError, type Artifact, type ArtifactProvenance, type ArtifactStore } from '../artifacts/store';
export interface ArtifactsLabels {
  title: string;
  empty: string;
  back: string;
  titleField: string;
  textField: string;
  version: string;
  saveVersion: string;
  apply: string;
  delete: string;
  confirmDelete: string;
  cancel: string;
  saved: string;
  conflict: string;
  limit: string;
  versionLimit: string;
  countLimit: string;
  textLimit: string;
  saveNew: string;
  failed: string;
  discardChanges: string;
  provenance: string;
}
/** Local text workspace. Applying delegates to the host's fresh document review. */
export function createArtifactsView(options: {
  store: ArtifactStore;
  labels: ArtifactsLabels;
  onApply(text: string): Promise<unknown> | unknown;
  onClose?(): void;
  conversation?(): string;
}) {
  const el = View('section').class('agent-artifacts').build();
  const heading = View('h2').build();
  const body = Div().build();
  const status = View('p').class('agent-artifact-status').attr('role', 'status').build();
  el.append(heading, body, status);
  let labels = options.labels;
  let current: Artifact | undefined;
  let dirty = false;
  let disposed = false;
  let generation = 0;
  let busy = false;
  const pendingSaves = new Set<(outcome: MessageSaveOutcome) => void>();
  let cancelConfirmation: (() => void) | undefined;
  const buttons = new Set<HTMLButtonElement>();
  function button(key: keyof ArtifactsLabels, run: () => void): HTMLButtonElement {
    const b = ButtonBuilder().attr('type', 'button').text(labels[key]).build();
    b.dataset.action = key;
    b.addEventListener('click', () => {
      if (key !== 'discardChanges' && key !== 'cancel' && cancelConfirmation) {
        cancelConfirmation();
        cancelConfirmation = undefined;
        status.textContent = '';
      }
      run();
    });
    buttons.add(b);
    return b;
  }
  function error(e: unknown): void {
    const key =
      e instanceof ArtifactError
        ? ({
            conflict: 'conflict',
            limit: 'limit',
            'version-limit': 'versionLimit',
            'count-limit': 'countLimit',
            'text-limit': 'textLimit',
            missing: 'failed',
            invalid: 'failed',
          }[e.code] as keyof ArtifactsLabels)
        : 'failed';
    status.textContent = labels[key];
    if (e instanceof ArtifactError && e.code === 'version-limit') {
      status.append(
        ' ',
        button('saveNew', () => {
          void perform(async () => {
            const title = body.querySelector<HTMLInputElement>('input')!;
            const text = body.querySelector<HTMLTextAreaElement>('textarea')!;
            const a = await options.store.create({
              title: title.value,
              text: text.value,
              provenance: current!.provenance,
            });
            editor(a);
            status.textContent = labels.saved;
            body.querySelector<HTMLTextAreaElement>('textarea')?.focus();
          });
        }),
      );
    }
  }
  async function perform(task: () => Promise<void>): Promise<boolean> {
    if (busy || disposed) return false;
    busy = true;
    for (const b of buttons) b.disabled = true;
    for (const input of body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input,textarea,select',
    ))
      input.disabled = true;
    try {
      await task();
      return !disposed;
    } catch (e) {
      if (!disposed) error(e);
      return false;
    } finally {
      busy = false;
      for (const b of buttons) b.disabled = b.dataset.action === 'saveVersion' && !dirty;
      for (const input of body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input,textarea,select',
      ))
        input.disabled = false;
    }
  }
  function reset(): void {
    cancelConfirmation?.();
    cancelConfirmation = undefined;
    buttons.clear();
    body.replaceChildren();
    status.textContent = '';
    heading.textContent = labels.title;
  }
  function discard(next: () => void, cancelled?: () => void): void {
    cancelConfirmation?.();
    cancelConfirmation = cancelled;
    if (!dirty) {
      cancelConfirmation = undefined;
      return next();
    }
    status.replaceChildren(
      document.createTextNode(labels.discardChanges + ' '),
      button('discardChanges', () => {
        cancelConfirmation = undefined;
        dirty = false;
        status.textContent = '';
        next();
      }),
      button('cancel', () => {
        cancelConfirmation?.();
        cancelConfirmation = undefined;
        status.textContent = '';
      }),
    );
  }
  function editor(a: Artifact): void {
    if (disposed) return;
    current = a;
    dirty = false;
    reset();
    const back = button('back', () =>
      discard(() => {
        void refresh();
      }),
    );
    const title = View('input')
      .attr('type', 'text')
      .attr('maxlength', '200')
      .attr('aria-label', labels.titleField)
      .build() as HTMLInputElement;
    title.value = a.title;
    const select = View('select').attr('aria-label', labels.version).build() as HTMLSelectElement;
    for (const v of a.versions) {
      const option = document.createElement('option');
      option.value = String(v.version);
      option.textContent = `${labels.version} ${v.version}`;
      select.append(option);
    }
    let selectedVersion = String(a.versions.at(-1)!.version);
    select.value = selectedVersion;
    const text = View('textarea').attr('aria-label', labels.textField).build() as HTMLTextAreaElement;
    text.value = a.versions.at(-1)!.text;
    const changed = () => {
      dirty = true;
      const save = body.querySelector<HTMLButtonElement>('[data-action="saveVersion"]');
      if (save) save.disabled = false;
    };
    title.addEventListener('input', changed);
    text.addEventListener('input', changed);
    select.addEventListener('change', () => {
      const value = select.value;
      const load = () => {
        selectedVersion = value;
        title.value = a.title;
        text.value = a.versions.find((v) => String(v.version) === value)!.text;
        dirty = value !== String(a.versions.at(-1)!.version);
        body.querySelector<HTMLButtonElement>('[data-action=saveVersion]')!.disabled = !dirty;
      };
      if (dirty) {
        select.value = selectedVersion;
        discard(() => {
          select.value = value;
          load();
        });
      } else load();
    });
    const origin = View('p').class('agent-artifact-provenance').build();
    const sourceNames = (a.provenance.sources ?? []).map((s) => s.title);
    origin.hidden = sourceNames.length === 0;
    origin.textContent = sourceNames.length ? `${labels.provenance} · ${sourceNames.join(' · ')}` : '';
    const actions = Div().class('agent-artifact-actions').build();
    actions.append(
      button('saveVersion', () => {
        void perform(async () => {
          const updated = await options.store.update(a.id, a.versions.at(-1)!.version, {
            title: title.value,
            text: text.value,
          });
          editor(updated);
          status.textContent = labels.saved;
          body.querySelector<HTMLTextAreaElement>('textarea')?.focus();
        });
      }),
      button('apply', () => {
        void perform(async () => {
          await options.onApply(text.value);
        });
      }),
      button('delete', () => {
        status.replaceChildren(
          button('confirmDelete', () => {
            void perform(async () => {
              await options.store.delete(a.id);
              dirty = false;
              await refresh();
            });
          }),
          button('cancel', () => {
            status.textContent = '';
          }),
        );
      }),
    );
    const form = Div().class('agent-artifact-editor').children(title, select, text, origin, actions).build();
    body.append(back, form);
    form.querySelector<HTMLButtonElement>('[data-action=saveVersion]')!.disabled = true;
    title.focus();
  }
  async function refresh(): Promise<void> {
    if (disposed || dirty) return;
    const revision = ++generation;
    try {
      const rows = await options.store.list();
      if (disposed || revision !== generation || dirty) return;
      current = undefined;
      reset();
      const list = View('ul').class('agent-artifacts-list').build();
      if (!rows.length) {
        const empty = View('p').text(labels.empty).build();
        body.append(empty);
      }
      for (const row of rows) {
        const open = button('title', () => {
          void perform(async () => {
            const a = await options.store.get(row.id);
            if (a) editor(a);
            else await refresh();
          });
        });
        open.textContent = row.title;
        open.dataset.artifact = row.id;
        list.append(View('li').children(open).build());
      }
      body.append(list);
      if (options.onClose) body.append(button('back', options.onClose));
      if (el.isConnected) body.querySelector('button')?.focus();
    } catch (e) {
      if (!disposed) error(e);
    }
  }
  return {
    el,
    refresh,
    save(text: string, origin?: ArtifactProvenance): Promise<MessageSaveOutcome> {
      if (disposed || busy) return Promise.resolve('cancelled');
      return new Promise((resolve) => {
        const settle = (outcome: MessageSaveOutcome) => {
          pendingSaves.delete(settle);
          resolve(outcome);
        };
        pendingSaves.add(settle);
        const create = () => {
          void perform(async () => {
            const a = await options.store.create({
              title:
                text
                  .trim()
                  .split('\n')[0]
                  .replace(/^#{1,6}\s+/, '')
                  .slice(0, 100) || labels.title,
              text,
              provenance: origin ?? { conversation: options.conversation?.() },
            });
            if (disposed || !pendingSaves.has(settle)) return;
            ++generation;
            editor(a);
            if (!disposed) status.textContent = labels.saved;
          }).then((success) => settle(success ? 'saved' : disposed ? 'cancelled' : 'failed'));
        };
        discard(create, () => settle('cancelled'));
      });
    },
    cancelPending(): void {
      if (cancelConfirmation) status.textContent = '';
      cancelConfirmation?.();
      cancelConfirmation = undefined;
      for (const settle of pendingSaves) settle('cancelled');
    },
    setLabels(next: ArtifactsLabels): void {
      labels = next;
      heading.textContent = labels.title;
      for (const b of buttons) {
        const key = b.dataset.action as keyof ArtifactsLabels;
        if (!b.dataset.artifact) b.textContent = labels[key];
      }
      for (const option of body.querySelectorAll('option')) option.textContent = `${labels.version} ${option.value}`;
      const origin = body.querySelector('.agent-artifact-provenance');
      if (origin && current) {
        const sources = (current.provenance.sources ?? []).map((source) => source.title);
        origin.textContent = sources.length ? `${labels.provenance} · ${sources.join(' · ')}` : '';
      }
      for (const [selector, key] of [
        ['input', 'titleField'],
        ['textarea', 'textField'],
        ['select', 'version'],
      ] as const)
        body.querySelector(selector)?.setAttribute('aria-label', labels[key]);
    },
    dispose(): void {
      disposed = true;
      cancelConfirmation?.();
      cancelConfirmation = undefined;
      for (const settle of pendingSaves) settle('cancelled');
      ++generation;
      buttons.clear();
      el.remove();
    },
    get current() {
      return current;
    },
  };
}
