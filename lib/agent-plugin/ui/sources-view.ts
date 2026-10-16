import { Div, View } from 'ranui/builder';
import { ReferenceSources, McpResources, boundedText, readLocalReference } from '../connectors/reference-sources';

export interface SourcesLabels {
  title: string;
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
  unsupported: string;
  remove: string;
  attached: string;
  attach: string;
  close: string;
  more: string;
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
  const status = View('p').attr('role', 'status').build();
  const attached = Div().class('agent-sources-attached').build();
  const local = View<HTMLInputElement>('input').attr('type', 'file').attr('accept', '.txt,.md,.csv,.tsv,.json').build();
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
  let mcpConnected = false;
  let driveConnected = false;
  let operationEpoch = 0;
  const attach = (source: Parameters<ReferenceSources['add']>[0]) => {
    if (!disposed && operationEpoch === epoch) {
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
      void run(async () => {
        client?.disconnect();
        options.sources.disconnect('mcp');
        options.changed();
        client = new McpResources(url.value, token.value);
        token.value = '';
        const current = client;
        const resources = await current.list();
        if (disposed || operationEpoch !== epoch || client !== current) return;
        mcpConnected = true;
        syncConnectionActions();
        mcpRows.replaceChildren();
        for (const resource of resources) {
          const row = button(
            () =>
              void run(async () => {
                const source = await current.read(resource.uri);
                if (current !== client) return;
                attach(source);
              }),
          );
          row.textContent = resource.name;
          mcpRows.append(row);
        }
      }),
  );
  const disconnect = button(() => {
    epoch++;
    client?.disconnect();
    client = undefined;
    mcpConnected = false;
    syncConnectionActions();
    options.sources.disconnect('mcp');
    mcpRows.replaceChildren();
    update();
  });
  const drive = button(() => {
    if (busy || disposed) return;
    const popup = window.open('about:blank', '_blank', 'popup,width=560,height=720');
    if (!popup) {
      status.textContent = labels.failed;
      return;
    }
    void run(async () => {
      try {
        const result = await google('start', 'POST');
        if (disposed || operationEpoch !== epoch) {
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
    });
  });
  const driveDisconnect = button(() => {
    epoch++;
    driveConnected = false;
    syncConnectionActions();
    options.sources.disconnect('google');
    update();
    driveRows.replaceChildren();
    status.textContent = labels.loading;
    const revision = epoch;
    void google('disconnect', 'POST')
      .then(() => {
        if (!disposed && epoch === revision) status.textContent = '';
      })
      .catch(() => {
        if (!disposed && epoch === revision) status.textContent = labels.failed;
      });
  });
  const driveList = button(() => void run(() => listDrive()));
  let nextPage = '';
  const more = button(() => void run(() => listDrive(nextPage)));
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
  mcpDetails.append(mcpSummary, urlField.wrapper, tokenField.wrapper, connect, disconnect, mcpRows);
  el.append(
    back,
    heading,
    excerpt,
    status,
    attached,
    localHeading,
    attachFile,
    localField.wrapper,
    localHint,
    mcpDetails,
    driveHeading,
    driveHint,
    drive,
    driveList,
    driveDisconnect,
    driveRows,
    more,
  );
  function syncConnectionActions() {
    connect.hidden = mcpConnected;
    disconnect.hidden = !mcpConnected;
    drive.hidden = driveConnected;
    driveDisconnect.hidden = !driveConnected;
  }
  async function google(path: string, method = 'GET'): Promise<Record<string, unknown>> {
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
  async function listDrive(pageToken = '') {
    const result = await google(`list${pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ''}`);
    if (!pageToken) driveRows.replaceChildren();
    if (disposed || operationEpoch !== epoch) return;
    if (!Array.isArray(result.files)) throw new Error('source-failed');
    for (const file of result.files.slice(0, 30)) {
      if (typeof file.id !== 'string' || typeof file.name !== 'string') continue;
      const row = button(
        () =>
          void run(async () => {
            const read = await google(`read?id=${encodeURIComponent(file.id)}`);
            if (typeof read.text !== 'string') throw new Error('source-failed');
            attach({
              id: crypto.randomUUID(),
              connector: 'google',
              title: file.name,
              text: read.text,
              uri: `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`,
            });
          }),
      );
      row.textContent = file.name;
      driveRows.append(row);
    }
    driveConnected = true;
    syncConnectionActions();
    nextPage = typeof result.nextPageToken === 'string' ? result.nextPageToken : '';
    more.hidden = !nextPage;
  }
  async function run(action: () => Promise<void>) {
    if (busy || disposed) return;
    const revision = epoch;
    operationEpoch = revision;
    busy = true;
    status.textContent = labels.loading;
    try {
      await action();
      if (!disposed && revision === epoch) status.textContent = '';
    } catch (error) {
      if (!disposed && revision === epoch)
        status.textContent =
          error instanceof Error && error.message === 'source-too-large'
            ? labels.tooLarge
            : error instanceof Error && error.message === 'source-unsupported'
              ? labels.unsupported
              : error instanceof Error && error.message === 'source-auth'
                ? labels.reconnect
                : error instanceof Error && error.message === 'source-unavailable'
                  ? labels.unavailable
                  : labels.failed;
    } finally {
      busy = false;
    }
  }
  local.addEventListener('change', () => {
    const file = local.files?.[0];
    local.value = '';
    if (file)
      void run(async () => {
        attach(await readLocalReference(file));
      });
  });
  function update() {
    attached.replaceChildren();
    for (const source of options.sources.list()) {
      const row = Div().class('agent-source-row').build();
      const text = View('span').text(source.title).build();
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
        void run(async () => {
          const state = await google('status');
          if (!state.connected) throw new Error('source-auth');
          await listDrive();
        });
    };
  } catch {
    /* Explicit list remains available. */
  }
  function setLabels(next: SourcesLabels) {
    labels = next;
    heading.textContent = labels.title;
    excerpt.textContent = labels.excerpt;
    back.textContent = labels.close;
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
  setLabels(labels);
  return {
    el,
    cancelPending: () => {
      epoch++;
      status.textContent = '';
    },
    focus: () => heading.focus(),
    setLabels,
    refresh: update,
    dispose: () => {
      disposed = true;
      epoch++;
      client?.disconnect();
      channel?.close();
      token.value = '';
    },
  };
}
