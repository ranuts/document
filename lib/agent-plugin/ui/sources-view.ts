import { createViewHeader, labelViewBack } from './view-header';
import { sourcePreview } from './source-preview';
import { sourceMatches } from '../references/reference-search';
import { Div, View } from 'ranui/builder';
import { ReferenceSources, readLocalReference } from '../references/reference-sources';

export interface SourcesLabels {
  title: string;
  offline: string;
  excerpt: string;
  local: string;
  localHint: string;
  loading: string;
  failed: string;
  tooLarge: string;
  limit: string;
  corrupt?: string;
  encrypted?: string;
  empty?: string;
  timeout?: string;
  unsupported: string;
  remove: string;
  attach: string;
  close: string;
  search?: string;
  openSource?: string;
  previewTruncated?: string;
}
/** Source management is explicit and independent from inference-provider configuration. */
export function createSourcesView(options: {
  sources: ReferenceSources;
  labels: SourcesLabels;
  changed(): void;
  close(): void;
}) {
  let labels = options.labels;
  const el = View('section').class('agent-workspace-view agent-sources-view').build();
  const heading = View('h2').build();
  heading.tabIndex = -1;
  const excerpt = View('p').class('agent-entry-note').build();
  const offlineHint = View('p').class('agent-offline-hint agent-entry-note').attr('role', 'status').build();
  const status = View('p').class('agent-sources-status').attr('role', 'status').build();
  const search = View<HTMLInputElement>('input').attr('type', 'search').build();
  search.addEventListener('input', () => {
    update();
  });
  const attached = Div().class('agent-sources-attached').build();
  const local = View<HTMLInputElement>('input')
    .attr('type', 'file')
    .attr('accept', '.txt,.md,.csv,.tsv,.json,.docx,.xlsx,.pptx,.pdf')
    .build();
  const localHint = View('p').class('agent-entry-note').build();
  const localHeading = View('h3').build();
  let disposed = false;
  let epoch = 0;
  let busy = false;
  let localOperation: AbortController | undefined;
  let operationId = 0;
  const attach = (source: Parameters<ReferenceSources['add']>[0], isCurrent: () => boolean) => {
    if (isCurrent()) {
      options.sources.add(source);
      update();
    }
  };
  const button = (action: () => void) => {
    const b = View<HTMLButtonElement>('button').attr('type', 'button').build();
    b.addEventListener('click', action);
    return b;
  };
  const back = button(options.close);
  const label = (control: HTMLElement, key: string) => {
    const wrapper = View('label').build();
    const text = View('span').text(key).build();
    wrapper.append(text, control);
    return { wrapper, text };
  };
  const attachFile = button(() => local.click());
  const localField = label(local, '');
  localField.wrapper.hidden = true;
  el.append(
    createViewHeader(heading, back),
    excerpt,
    offlineHint,
    status,
    search,
    attached,
    localHeading,
    attachFile,
    localField.wrapper,
    localHint,
  );
  async function run(action: (isCurrent: () => boolean) => Promise<void>) {
    if (busy || disposed) return;
    const revision = epoch;
    const id = ++operationId;
    const isCurrent = () => !disposed && revision === epoch && id === operationId;
    busy = true;
    status.textContent = labels.loading;
    try {
      await action(isCurrent);
      if (isCurrent()) status.textContent = '';
    } catch (error) {
      if (isCurrent()) {
        const errors: Record<string, string | undefined> = {
          'source-corrupt': labels.corrupt,
          'source-encrypted': labels.encrypted,
          'source-empty': labels.empty,
          'source-timeout': labels.timeout,
          'source-limit': labels.limit,
          'source-too-large': labels.tooLarge,
          'source-unsupported': labels.unsupported,
        };
        status.textContent = (error instanceof Error ? errors[error.message] : undefined) ?? labels.failed;
      }
    } finally {
      if (id === operationId) busy = false;
    }
  }
  local.addEventListener('change', () => {
    const file = local.files?.[0];
    local.value = '';
    if (file)
      void run(async (isCurrent) => {
        localOperation = new AbortController();
        try {
          attach(await readLocalReference(file, localOperation.signal), isCurrent);
        } finally {
          if (isCurrent()) localOperation = undefined;
        }
      });
  });
  function update() {
    attached.replaceChildren();
    for (const source of options.sources.list()) {
      const row = Div().class('agent-source-row').build();
      if (!sourceMatches(source, search.value)) continue;
      const text = sourcePreview(source, labels.openSource ?? labels.excerpt, search.value, labels.previewTruncated);
      const remove = button(() => {
        options.sources.remove(source.id);
        update();
      });
      remove.textContent = labels.remove;
      remove.setAttribute('aria-label', `${labels.remove}: ${source.title}`);
      row.append(text, remove);
      attached.append(row);
    }
    options.changed();
  }
  function setLabels(next: SourcesLabels) {
    labels = next;
    heading.textContent = labels.title;
    search.placeholder = labels.search ?? labels.title;
    search.setAttribute('aria-label', labels.search ?? labels.title);
    offlineHint.textContent = labels.offline;
    syncConnectivity();
    excerpt.textContent = labels.excerpt;
    labelViewBack(back, labels.close);
    localHeading.textContent = labels.local;
    attachFile.textContent = labels.attach;
    localField.text.textContent = labels.attach;
    localHint.textContent = labels.localHint;
    update();
  }
  function syncConnectivity() {
    const offline = navigator.onLine === false;
    offlineHint.hidden = !offline;
  }
  window.addEventListener('online', syncConnectivity);
  window.addEventListener('offline', syncConnectivity);
  setLabels(labels);
  function cancelPending() {
    localOperation?.abort();
    localOperation = undefined;
    epoch++;
    operationId++;
    busy = false;
    status.textContent = '';
  }
  return {
    el,
    cancelPending,
    focus: () => heading.focus(),
    setLabels,
    refresh: update,
    dispose: () => {
      disposed = true;
      localOperation?.abort();
      localOperation = undefined;
      epoch++;
      window.removeEventListener('online', syncConnectivity);
      window.removeEventListener('offline', syncConnectivity);
    },
  };
}
