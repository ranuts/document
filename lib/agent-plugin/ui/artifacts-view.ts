import { createViewHeader, labelViewBack } from './view-header';
import { createArtifactPresentation, type ArtifactPresentationLabels } from './artifact-presentation';
import { validatePayload, payloadText } from '../artifacts/payload';
import {
  captureArtifactDraft,
  replaceArtifactRange,
  sameArtifactDraft,
  type ArtifactDraftBinding,
} from '../artifacts/edit-proposal';
import { createArtifactWorkflow, type ArtifactWorkflowLabels, type ArtifactRevisionRequest } from './artifact-workflow';
import type { MessageSaveOutcome } from '@ranuts/chat-ui';
import { ButtonBuilder, Div, View } from 'ranui/builder';
import { ArtifactError, type Artifact, type ArtifactProvenance, type ArtifactStore } from '../artifacts/store';
export interface ArtifactsLabels extends ArtifactPresentationLabels {
  title: string;
  empty: string;
  back: string;
  backToConversation?: string;
  backToList?: string;
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
  refinement?: {
    labels: ArtifactWorkflowLabels;
    submit(request: ArtifactRevisionRequest): void | (() => void);
    stop(): void;
  };
}) {
  const el = View('section').class('agent-artifacts').build();
  const heading = View('h2').build();
  heading.tabIndex = -1;
  const header = createViewHeader(heading);
  let backDestination: 'conversation' | 'list' = 'conversation';
  const body = Div().build();
  const status = View('p').class('agent-artifact-status').attr('role', 'status').build();
  el.append(header, body, status);
  let labels = options.labels;
  let current: Artifact | undefined;
  let activePresentation: ReturnType<typeof createArtifactPresentation> | undefined;
  let dirty = false;
  let draftRevision = 0;
  let workflow: ReturnType<typeof createArtifactWorkflow> | undefined;
  let captureDraft: (() => ArtifactDraftBinding) | undefined;
  const invalidateDraft = () => {
    ++draftRevision;
    workflow?.invalidate();
  };
  let disposed = false;
  let generation = 0;
  let busy = false;
  const pendingSaves = new Set<(outcome: MessageSaveOutcome) => void>();
  let cancelConfirmation: (() => void) | undefined;
  const buttons = new Set<HTMLButtonElement>();
  function button(key: keyof ArtifactsLabels, run: () => void): HTMLButtonElement {
    const b = ButtonBuilder()
      .attr('type', 'button')
      .text(labels[key] ?? '')
      .build();
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
  function setBack(back: HTMLButtonElement, destination: 'conversation' | 'list'): void {
    backDestination = destination;
    labelViewBack(
      back,
      (destination === 'conversation' ? labels.backToConversation : labels.backToList) ?? labels.back,
    );
    header.prepend(back);
  }
  function draftContent(text: string) {
    const version = current?.versions.find(
      (v) => String(v.version) === body.querySelector<HTMLSelectElement>('select')?.value,
    );
    if (!version?.payload) return { text };
    if (version.payload.kind === 'text') return { text, payload: validatePayload({ kind: 'text', text }) };
    try {
      const payload = validatePayload(JSON.parse(text));
      if (payload.kind !== version.payload.kind) throw new Error('Changed kind');
      return { text: payloadText(payload), payload };
    } catch {
      throw new ArtifactError('invalid');
    }
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
            invalid: 'importHint',
          }[e.code] as keyof ArtifactsLabels)
        : 'failed';
    status.textContent = labels[key] ?? labels.failed;
    if (e instanceof ArtifactError && (e.code === 'version-limit' || e.code === 'conflict')) {
      status.append(
        ' ',
        button('saveNew', () => {
          void perform(async () => {
            const title = body.querySelector<HTMLInputElement>('input')!;
            const text = body.querySelector<HTMLTextAreaElement>('textarea[data-artifact-source]')!;
            const a = await options.store.create({
              title: title.value,
              ...draftContent(text.value),
              provenance: current!.provenance,
            });
            editor(a);
            status.textContent = labels.saved;
            body.querySelector<HTMLTextAreaElement>('textarea[data-artifact-source]')?.focus();
          });
        }),
      );
    }
  }
  async function perform(task: () => Promise<void>): Promise<boolean> {
    if (busy || disposed) return false;
    busy = true;
    activePresentation?.setDisabled(true);
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
      activePresentation?.setDisabled(false);
      for (const b of buttons) b.disabled = b.dataset.action === 'saveVersion' && !dirty;
      for (const input of body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input,textarea,select',
      ))
        input.disabled = false;
    }
  }
  function reset(): void {
    invalidateDraft();
    activePresentation?.dispose();
    activePresentation = undefined;
    workflow?.dispose();
    workflow = undefined;
    captureDraft = undefined;
    cancelConfirmation?.();
    cancelConfirmation = undefined;
    buttons.clear();
    header.replaceChildren(heading);
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
    setBack(back, 'list');
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
    const text = View('textarea')
      .attr('aria-label', labels.textField)
      .attr('data-artifact-source', 'true')
      .build() as HTMLTextAreaElement;
    text.dataset.artifactSource = 'true';
    text.value = a.versions.at(-1)!.text;
    const presentationHost = document.createElement('div');
    const source = document.createElement('details');
    const sourceSummary = document.createElement('summary');
    sourceSummary.textContent = labels.textField + ' · JSON';
    sourceSummary.dataset.artifactSourceSummary = 'true';
    source.append(sourceSummary, text);
    source.hidden = !(a.versions.at(-1)!.payload && a.versions.at(-1)!.payload!.kind !== 'text');
    if (source.hidden) source.removeChild(text);
    let presentation = createArtifactPresentation(text, labels, a.versions.at(-1)!.payload, () => title.value);
    activePresentation = presentation;
    presentationHost.append(presentation.el);
    const changed = () => {
      invalidateDraft();
      dirty = true;
      const save = body.querySelector<HTMLButtonElement>('[data-action="saveVersion"]');
      if (save) save.disabled = false;
    };
    title.addEventListener('input', changed);
    text.addEventListener('input', changed);
    select.addEventListener('change', () => {
      const value = select.value;
      const load = () => {
        invalidateDraft();
        selectedVersion = value;
        title.value = a.title;
        const loaded = a.versions.find((v) => String(v.version) === value)!;
        text.value = loaded.text;
        presentation.dispose();
        presentation = createArtifactPresentation(text, labels, loaded.payload, () => title.value);
        activePresentation = presentation;
        presentationHost.replaceChildren(presentation.el);
        source.hidden = !loaded.payload || loaded.payload.kind === 'text';
        if (source.hidden) {
          source.open = false;
          if (text.parentElement === source) source.removeChild(text);
          form.insertBefore(text, presentationHost);
        } else source.append(text);
        if (presentation.kind !== 'text') form.insertBefore(actions, presentationHost);
        else form.insertBefore(actions, workflow?.el ?? null);
        const apply = body.querySelector<HTMLButtonElement>('[data-action=apply]');
        if (apply) apply.hidden = loaded.payload?.kind !== undefined && loaded.payload.kind !== 'text';
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
            ...draftContent(text.value),
          });
          editor(updated);
          status.textContent = labels.saved;
          body.querySelector<HTMLTextAreaElement>('textarea[data-artifact-source]')?.focus();
        });
      }),
      button('apply', () => {
        if (presentation.kind !== 'text') return;
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
    const form = Div()
      .class('agent-artifact-editor')
      .children(title, select, ...(source.hidden ? [text] : []), presentationHost, source, origin, actions)
      .build();
    if (presentation.kind !== 'text') form.insertBefore(actions, presentationHost);
    body.append(form);
    const applyButton = actions.querySelector<HTMLButtonElement>('[data-action=apply]')!;
    applyButton.hidden = !!a.versions.at(-1)!.payload && a.versions.at(-1)!.payload!.kind !== 'text';
    captureDraft = () =>
      captureArtifactDraft({
        artifactId: a.id,
        expectedVersion: a.versions.at(-1)!.version,
        revision: draftRevision,
        title: title.value,
        text: text.value,
        ...(presentation.kind === 'table' || presentation.kind === 'slides' ? { payloadKind: presentation.kind } : {}),
        start: presentation.kind === 'text' ? text.selectionStart : 0,
        end: presentation.kind === 'text' ? text.selectionEnd : 0,
      });
    if (options.refinement) {
      const isCurrent = (bound: ArtifactDraftBinding) =>
        !disposed && !!captureDraft && sameArtifactDraft(bound, captureDraft());
      workflow = createArtifactWorkflow({
        labels: options.refinement.labels,
        capture: () => captureDraft?.(),
        useEntire: () => text.setSelectionRange(0, 0),
        isCurrent,
        submit: options.refinement.submit,
        stop: options.refinement.stop,
        accept: async (bound, replacement, hostCurrent) => {
          if (!hostCurrent() || !isCurrent(bound)) return false;
          const persisted = await options.store.get(bound.artifactId);
          if (!hostCurrent() || !isCurrent(bound)) return false;
          if (!persisted || persisted.versions.at(-1)?.version !== bound.expectedVersion) {
            error(new ArtifactError('conflict'));
            return false;
          }
          if (bound.payloadKind) {
            try {
              const payload = validatePayload(JSON.parse(replacement));
              if (payload.kind !== bound.payloadKind) return false;
              replacement = payloadText(payload);
            } catch {
              error(new ArtifactError('invalid'));
              return false;
            }
          }
          text.value = replaceArtifactRange(bound, replacement);
          presentation.refresh();
          dirty = true;
          ++draftRevision;
          body.querySelector<HTMLButtonElement>('[data-action=saveVersion]')!.disabled = false;
          if (bound.payloadKind) presentationHost.querySelector('textarea')?.focus();
          else {
            text.focus();
            text.setSelectionRange(bound.start, bound.start + replacement.length);
          }
          return true;
        },
      });
      form.append(workflow.el);
      for (const event of ['select', 'click', 'keyup', 'input'])
        text.addEventListener(event, () => workflow?.refreshScope());
    }
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
      body.append(
        button('import', () =>
          discard(() => {
            reset();
            const title = document.createElement('input');
            title.setAttribute('aria-label', labels.titleField);
            title.maxLength = 200;
            const data = document.createElement('textarea');
            data.maxLength = 262144;
            const importForm = document.createElement('div');
            importForm.className = 'agent-artifact-editor';
            body.append(importForm);
            data.setAttribute('aria-label', labels.import);
            data.placeholder = labels.importHint;
            const hint = document.createElement('p');
            hint.textContent = labels.importHint;
            importForm.append(
              title,
              hint,
              data,
              button('saveNew', () => {
                void perform(async () => {
                  let envelope: { schemaVersion?: unknown; payload?: unknown };
                  try {
                    if (new TextEncoder().encode(data.value).length > 262144) throw new Error('too large');
                    envelope = JSON.parse(data.value);
                  } catch {
                    throw new ArtifactError('invalid');
                  }
                  if (
                    !envelope ||
                    envelope.schemaVersion !== 1 ||
                    Object.keys(envelope).some((k) => !['schemaVersion', 'payload'].includes(k))
                  )
                    throw new ArtifactError('invalid');
                  let payload;
                  try {
                    payload = validatePayload(envelope.payload);
                  } catch {
                    throw new ArtifactError('invalid');
                  }
                  const a = await options.store.create({
                    title: title.value,
                    text: payloadText(payload),
                    payload,
                    provenance: { conversation: options.conversation?.() },
                  });
                  editor(a);
                  status.textContent = labels.saved;
                });
              }),
            );
            setBack(
              button('back', () =>
                discard(() => {
                  dirty = false;
                  void refresh();
                }),
              ),
              'list',
            );
            data.addEventListener('input', () => {
              dirty = true;
            });
            title.addEventListener('input', () => {
              dirty = true;
            });
            title.focus();
          }),
        ),
      );

      if (options.onClose) setBack(button('back', options.onClose), 'conversation');
      if (el.isConnected) heading.focus();
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
    recover(bound: ArtifactDraftBinding, instruction: string): Promise<boolean> {
      if (disposed || busy) return Promise.resolve(false);
      // Opening this view may already have launched a metadata refresh. Recovery
      // takes presentation ownership before it can remove the queued instruction.
      ++generation;
      const stage = () => {
        const text = body.querySelector<HTMLTextAreaElement>('textarea[data-artifact-source]');
        if (!text || !workflow) return false;
        const matching = text.value === bound.text;
        // Old offsets are never applied to a newer body. A changed selection
        // request must select afresh or explicitly choose the entire artifact.
        text.setSelectionRange(
          matching && bound.scope === 'selection' ? bound.start : 0,
          matching && bound.scope === 'selection' ? bound.end : 0,
        );
        workflow.restoreInstruction(instruction, !matching && bound.scope === 'selection');
        return true;
      };
      if (current?.id === bound.artifactId && captureDraft) return Promise.resolve(stage());
      return new Promise((resolve) => {
        discard(
          () => {
            const revision = ++generation;
            void perform(async () => {
              const artifact = await options.store.get(bound.artifactId);
              if (disposed || revision !== generation) return;
              if (!artifact) throw new ArtifactError('missing');
              editor(artifact);
              resolve(stage());
            }).then(() => resolve(false));
          },
          () => resolve(false),
        );
      });
    },
    cancelPending(): void {
      ++generation;
      invalidateDraft();
      if (cancelConfirmation) status.textContent = '';
      cancelConfirmation?.();
      cancelConfirmation = undefined;
      for (const settle of pendingSaves) settle('cancelled');
    },
    setRefinementLabels(next: ArtifactWorkflowLabels): void {
      if (options.refinement) options.refinement.labels = next;
      workflow?.setLabels(next);
    },
    isCurrentDraft(bound: ArtifactDraftBinding): boolean {
      return !disposed && !!captureDraft && sameArtifactDraft(bound, captureDraft());
    },
    setLabels(next: ArtifactsLabels): void {
      labels = next;
      heading.textContent = labels.title;
      activePresentation?.setLabels(labels);
      const sourceSummary = body.querySelector('[data-artifact-source-summary]');
      if (sourceSummary) sourceSummary.textContent = labels.textField + ' · JSON';
      for (const b of buttons) {
        const key = b.dataset.action as keyof ArtifactsLabels;
        if (key === 'back') {
          labelViewBack(
            b,
            (backDestination === 'conversation' ? labels.backToConversation : labels.backToList) ?? labels.back,
          );
        } else if (!b.dataset.artifact) b.textContent = labels[key] ?? '';
      }
      for (const option of body.querySelectorAll('option')) option.textContent = `${labels.version} ${option.value}`;
      const origin = body.querySelector('.agent-artifact-provenance');
      if (origin && current) {
        const sources = (current.provenance.sources ?? []).map((source) => source.title);
        origin.textContent = sources.length ? `${labels.provenance} · ${sources.join(' · ')}` : '';
      }
      for (const [selector, key] of [
        ['input', 'titleField'],
        ['textarea[data-artifact-source]', 'textField'],
        ['select', 'version'],
      ] as const)
        body.querySelector(selector)?.setAttribute('aria-label', labels[key]);
    },
    dispose(): void {
      disposed = true;
      activePresentation?.dispose();
      workflow?.dispose();
      cancelConfirmation?.();
      cancelConfirmation = undefined;
      for (const settle of pendingSaves) settle('cancelled');
      ++generation;
      buttons.clear();
      header.replaceChildren(heading);
      el.remove();
    },
    get current() {
      return current;
    },
  };
}
