import { createViewHeader, labelViewBack } from './view-header';
import { sourcePreview } from './source-preview';
import { sourceMatches } from '../connectors/reference-search';
import { renderSearchText } from './search-highlight';
import { Div, View } from 'ranui/builder';
import { ReferenceSources, McpResources, boundedText, readLocalReference } from '../connectors/reference-sources';

export interface SourcesLabels {
  title: string;
  offline: string;
  excerpt: string;
  local: string;
  localHint: string;
  mcp: string;
  url: string;
  token: string;
  connect: string;
  disconnect: string;
  drive: string;
  driveHint: string;
  unavailable: string;
  reconnect: string;
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
  attached: string;
  attach: string;
  close: string;
  more: string;
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
  const driveSearch = View<HTMLInputElement>('input').attr('type', 'search').build();
  search.addEventListener('input', () => {
    update();
    filterDiscovered();
  });
  driveSearch.maxLength = 200;
  driveSearch.addEventListener('input', () => {
    cancelPending();
    nextPage = '';
    more.hidden = true;
    driveRows.replaceChildren();
  });
  const attached = Div().class('agent-sources-attached').build();
  const local = View<HTMLInputElement>('input')
    .attr('type', 'file')
    .attr('accept', '.txt,.md,.csv,.tsv,.json,.docx,.xlsx,.pptx,.pdf')
    .build();
  const localHint = View('p').class('agent-entry-note').build();
  const url = View<HTMLInputElement>('input').attr('type', 'url').build();
  const token = View<HTMLInputElement>('input').attr('type', 'password').attr('autocomplete', 'off').build();
  const mcpRows = Div().class('agent-source-options').build();
  const driveRows = Div().class('agent-source-options').build();
  const localHeading = View('h3').build();
  const mcpHeading = View('h3').build();
  const driveHeading = View('h3').build();
  const driveHint = View('p').class('agent-entry-note').build();
  let client: McpResources | undefined;
  let disposed = false;
  let epoch = 0;
  let busy = false;
  let localOperation: AbortController | undefined;
  let mcpConnected = false;
  let driveConnected = false;
  let driveDisconnecting = false;
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
  const connect = button(
    () =>
      void run(async (isCurrent) => {
        client?.disconnect();
        options.sources.disconnect('mcp');
        options.changed();
        client = new McpResources(url.value, token.value);
        token.value = '';
        const current = client;
        const resources = await current.list();
        if (!isCurrent() || client !== current) return;
        mcpConnected = true;
        syncConnectionActions();
        mcpRows.replaceChildren();
        renderMcp(resources, current);
      }, 'mcp'),
  );
  function renderMcp(resources: Awaited<ReturnType<McpResources['list']>>, current: McpResources) {
    for (const resource of resources) {
      const row = button(
        () =>
          void run(async (isCurrent) => {
            const source = await current.read(resource.uri);
            if (current !== client) return;
            attach(source, isCurrent);
          }, 'mcp'),
      );
      row.textContent = resource.name;
      row.dataset.sourceTitle = resource.name;
      mcpRows.append(row);
    }
    mcpMore.hidden = !current.continuation;
    filterDiscovered();
  }
  const mcpMore = button(
    () =>
      void run(async (isCurrent) => {
        const current = client;
        if (!current?.continuation) return;
        const rows = await current.list(current.continuation);
        if (isCurrent() && current === client) renderMcp(rows, current);
      }, 'mcp'),
  );
  const disconnect = button(() => {
    cancelPending();
    client?.disconnect();
    client = undefined;
    mcpConnected = false;
    syncConnectionActions();
    options.sources.disconnect('mcp');
    mcpRows.replaceChildren();
    update();
  });
  const drive = button(() => {
    if (busy || disposed || driveDisconnecting || navigator.onLine === false) return;
    const popup = window.open('about:blank', '_blank', 'popup,width=560,height=720');
    if (!popup) {
      status.textContent = labels.failed;
      return;
    }
    void run(async (isCurrent) => {
      try {
        const result = await google('start', 'POST');
        if (!isCurrent()) {
          popup.close();
          return;
        }
        const destination = new URL(String(result.authorizationUrl));
        if (destination.origin !== 'https://accounts.google.com') throw new Error('source-unavailable');
        popup.location.href = destination.href;
      } catch (error) {
        popup.close();
        throw error;
      }
    }, 'google');
  });
  const driveDisconnect = button(() => {
    if (driveDisconnecting) return;
    driveDisconnecting = true;
    cancelPending();
    driveConnected = false;
    syncConnectionActions();
    options.sources.disconnect('google');
    update();
    driveRows.replaceChildren();
    status.textContent = labels.loading;
    const revision = epoch;
    const operation = operationId;
    void google('disconnect', 'POST')
      .then(() => {
        if (!disposed && epoch === revision && operation === operationId) status.textContent = '';
      })
      .catch(() => {
        if (!disposed && epoch === revision && operation === operationId) status.textContent = labels.failed;
      })
      .finally(() => {
        driveDisconnecting = false;
        if (!disposed) syncConnectionActions();
      });
  });
  const driveList = button(() => void run((isCurrent) => listDrive('', isCurrent), 'google'));
  let nextPage = '';
  const drivePages = new Set<string>();
  const driveFiles = new Set<string>();
  const more = button(() => void run((isCurrent) => listDrive(nextPage, isCurrent), 'google'));
  const label = (control: HTMLElement, key: string) => {
    const wrapper = View('label').build();
    const text = View('span').text(key).build();
    wrapper.append(text, control);
    return { wrapper, text };
  };
  const attachFile = button(() => local.click());
  const localField = label(local, '');
  localField.wrapper.hidden = true;
  const urlField = label(url, '');
  const tokenField = label(token, '');
  const mcpDetails = View<HTMLDetailsElement>('details').class('agent-disclosure agent-source-settings').build();
  const mcpSummary = View('summary').children(mcpHeading).build();
  mcpDetails.append(mcpSummary, urlField.wrapper, tokenField.wrapper, connect, disconnect, mcpRows, mcpMore);
  const driveSection = View('section')
    .class('agent-cloud-sources')
    .children(driveHeading, driveHint, drive, driveSearch, driveList, driveDisconnect, driveRows, more)
    .build();
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
    mcpDetails,
    driveSection,
  );
  function syncConnectionActions() {
    mcpMore.hidden = !mcpConnected || !client?.continuation;
    connect.hidden = mcpConnected;
    disconnect.hidden = !mcpConnected;
    drive.hidden = driveConnected;
    drive.disabled = driveDisconnecting;
    driveList.disabled = driveDisconnecting;
    driveDisconnect.hidden = !driveConnected;
  }
  async function google(path: string, method = 'GET'): Promise<Record<string, unknown>> {
    if (navigator.onLine === false) throw new Error('source-offline');
    const response = await fetch(`/api/connectors/google/${path}`, {
      method,
      credentials: 'same-origin',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('source-unavailable');
    const data = JSON.parse(await boundedText(response));
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? 'source-auth'
          : data.error === 'source_too_large'
            ? 'source-too-large'
            : data.error === 'not_configured'
              ? 'source-unavailable'
              : 'source-failed',
      );
    return data;
  }
  async function listDrive(pageToken: string, isCurrent: () => boolean) {
    const params = new URLSearchParams({ q: driveSearch.value.trim() });
    if (pageToken) params.set('pageToken', pageToken);
    const result = await google(`list?${params}`);
    if (!isCurrent()) return;
    if (!pageToken) {
      driveRows.replaceChildren();
      drivePages.clear();
      driveFiles.clear();
    } else drivePages.add(pageToken);
    if (!Array.isArray(result.files)) throw new Error('source-failed');
    for (const file of result.files.slice(0, 30)) {
      if (
        typeof file.id !== 'string' ||
        typeof file.name !== 'string' ||
        driveFiles.has(file.id) ||
        driveFiles.size >= 300
      )
        continue;
      driveFiles.add(file.id);
      const row = button(
        () =>
          void run(async (isCurrent) => {
            const read = await google(`read?id=${encodeURIComponent(file.id)}`);
            if (typeof read.text !== 'string') throw new Error('source-failed');
            attach(
              {
                id: crypto.randomUUID(),
                connector: 'google',
                title: file.name,
                text: read.text,
                uri: `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`,
              },
              isCurrent,
            );
          }, 'google'),
      );
      row.textContent = file.name;
      row.dataset.sourceTitle = file.name;
      driveRows.append(row);
    }
    driveConnected = true;
    syncConnectionActions();
    const token = result.nextPageToken;
    nextPage =
      typeof token === 'string' &&
      token.length <= 2048 &&
      token !== pageToken &&
      !drivePages.has(token) &&
      drivePages.size < 9 &&
      driveFiles.size < 300
        ? token
        : '';
    more.hidden = !nextPage;
    filterDiscovered();
  }
  async function run(action: (isCurrent: () => boolean) => Promise<void>, connector?: 'mcp' | 'google') {
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
        if (error instanceof Error && error.message === 'source-auth') {
          if (connector === 'mcp') {
            client?.disconnect();
            client = undefined;
            mcpConnected = false;
            mcpRows.replaceChildren();
          } else if (connector === 'google') {
            driveConnected = false;
            driveRows.replaceChildren();
            nextPage = '';
            more.hidden = true;
          }
          syncConnectionActions();
        }
        const errors: Record<string, string | undefined> = {
          'source-corrupt': labels.corrupt,
          'source-encrypted': labels.encrypted,
          'source-empty': labels.empty,
          'source-timeout': labels.timeout,
          'source-offline': labels.offline,
          'source-limit': labels.limit,
          'source-too-large': labels.tooLarge,
          'source-unsupported': labels.unsupported,
          'source-auth': labels.reconnect,
          'source-unavailable': labels.unavailable,
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
  function filterDiscovered() {
    for (const container of [mcpRows, driveRows])
      for (const row of container.children) {
        renderSearchText(
          row as HTMLElement,
          (row as HTMLElement).dataset.sourceTitle ?? '',
          search.value.replace(/\s+/gu, ' ').trim().toLocaleLowerCase(),
        );
        (row as HTMLElement).hidden = !sourceMatches(
          { title: (row as HTMLElement).dataset.sourceTitle ?? '', text: '' },
          search.value,
        );
      }
  }
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
  let channel: BroadcastChannel | undefined;
  try {
    channel = new BroadcastChannel('document-google-connector');
    channel.onmessage = (event) => {
      if (event.data?.type === 'google-connector-complete')
        void run(async (isCurrent) => {
          const state = await google('status');
          if (!state.connected) throw new Error('source-auth');
          await listDrive('', isCurrent);
        }, 'google');
    };
  } catch {
    /* Explicit list remains available. */
  }
  function setLabels(next: SourcesLabels) {
    labels = next;
    heading.textContent = labels.title;
    search.placeholder = labels.search ?? labels.title;
    search.setAttribute('aria-label', labels.search ?? labels.title);
    driveSearch.placeholder = labels.search ?? labels.drive;
    driveSearch.setAttribute('aria-label', `${labels.drive}: ${labels.search ?? labels.title}`);
    mcpMore.textContent = labels.more;
    mcpMore.hidden = !client?.continuation;
    offlineHint.textContent = labels.offline;
    syncConnectivity();
    excerpt.textContent = labels.excerpt;
    labelViewBack(back, labels.close);
    localHeading.textContent = labels.local;
    attachFile.textContent = labels.attach;
    syncConnectionActions();
    localField.text.textContent = labels.attach;
    localHint.textContent = labels.localHint;
    mcpHeading.textContent = labels.mcp;
    urlField.text.textContent = labels.url;
    tokenField.text.textContent = labels.token;
    connect.textContent = labels.connect;
    disconnect.textContent = labels.disconnect;
    driveHeading.textContent = labels.drive;
    driveHint.textContent = labels.driveHint;
    drive.textContent = labels.connect;
    driveList.textContent = labels.attached;
    driveDisconnect.textContent = labels.disconnect;
    more.textContent = labels.more;
    more.hidden = !nextPage;
    update();
  }
  function syncConnectivity() {
    const offline = navigator.onLine === false;
    driveSection.hidden = offline;
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
      client?.disconnect();
      channel?.close();
      window.removeEventListener('online', syncConnectivity);
      window.removeEventListener('offline', syncConnectivity);
      token.value = '';
    },
  };
}
