import { validatePayload, payloadText, type ArtifactPayload } from '../artifacts/payload';
import { artifactFilename, exportPayload, type ArtifactExportFormat } from '../artifacts/export';
export interface ArtifactPresentationLabels {
  titleField?: string;
  textField?: string;
  export: string;
  import: string;
  importHint: string;
  preview: string;
  next: string;
  previous: string;
  structuredHint: string;
}
/** Bounded editable data page. A hidden JSON owner keeps draft capture and AI review lossless. */
export function createArtifactPresentation(
  text: HTMLTextAreaElement,
  labels: ArtifactPresentationLabels,
  initial?: ArtifactPayload,
  title: () => string = () => 'artifact',
) {
  const el = document.createElement('div');
  el.className = 'agent-artifact-presentation';
  const preview = document.createElement('div');
  preview.className = 'agent-artifact-data-preview';
  const abort = new AbortController();
  const kind = initial?.kind ?? 'text';
  let page = 0;
  let committing = false;
  let disabled = false;
  function payload(): ArtifactPayload {
    const data =
      kind === 'text' ? { kind: 'text' as const, text: text.value } : validatePayload(JSON.parse(text.value));
    if (data.kind !== kind) throw new Error('Changed artifact kind');
    return data;
  }
  function render() {
    preview.replaceChildren();
    if (kind === 'text') return;
    const data = payload();
    if (data.kind === 'table') {
      page = Math.min(page, Math.max(0, Math.ceil(data.rows.length / 10) - 1));
      const table = document.createElement('table');
      const head = document.createElement('tr');
      for (const [columnIndex, column] of data.columns.entries()) {
        const cell = document.createElement('th');
        cell.append(
          field(column, `${labels.preview} · ${columnIndex + 1}`, (value) => {
            data.columns[columnIndex] = value;
            commit(data);
          }),
        );
        head.append(cell);
      }
      table.append(head);
      for (const [rowIndex, row] of data.rows.slice(page * 10, page * 10 + 10).entries()) {
        const tr = document.createElement('tr');
        for (const [columnIndex, value] of row.entries()) {
          const td = document.createElement('td');
          td.append(
            field(value, `${data.columns[columnIndex]} · ${page * 10 + rowIndex + 1}`, (value) => {
              data.rows[page * 10 + rowIndex][columnIndex] = value;
              commit(data);
            }),
          );
          tr.append(td);
        }
        table.append(tr);
      }
      preview.append(table);
      pages(Math.max(1, Math.ceil(data.rows.length / 10)));
    } else if (data.kind === 'slides') {
      page = Math.min(page, data.slides.length - 1);
      preview.append(
        field(data.slides[page].title, `${labels.titleField ?? labels.preview} · ${page + 1}`, (value) => {
          data.slides[page].title = value;
          commit(data);
        }),
        field(data.slides[page].body, `${labels.textField ?? labels.preview} · ${page + 1}`, (value) => {
          data.slides[page].body = value;
          commit(data);
        }),
      );
      pages(data.slides.length);
    }
  }
  function commit(data: ArtifactPayload) {
    text.value = payloadText(data);
    committing = true;
    try {
      text.dispatchEvent(new Event('input'));
    } finally {
      committing = false;
    }
  }
  function field(value: string, label: string, change: (value: string) => void) {
    const input = document.createElement('textarea');
    input.className = 'agent-artifact-cell';
    input.rows = Math.min(4, Math.max(1, Math.ceil(value.length / 60), value.split('\n').length));
    input.disabled = disabled;
    input.value = value;
    input.setAttribute('aria-label', label);
    input.maxLength = 16384;
    input.addEventListener('input', () => change(input.value));
    return input;
  }
  function pages(count: number) {
    for (const [label, step] of [
      [labels.previous, -1],
      [labels.next, 1],
    ] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.dataset.unavailable = String(page + step < 0 || page + step >= count);
      button.disabled = disabled || button.dataset.unavailable === 'true';
      button.addEventListener('click', () => {
        page += step;
        render();
      });
      preview.append(button);
    }
    preview.append(document.createTextNode(` ${page + 1} / ${count}`));
  }
  const disclosure = document.createElement('details'),
    summary = document.createElement('summary');
  summary.textContent = labels.export;
  const hint = document.createElement('p');
  hint.textContent = labels.structuredHint;
  disclosure.append(summary);
  if (kind !== 'text') disclosure.append(hint);
  for (const format of ['txt', 'md', 'csv', 'json'] as ArtifactExportFormat[]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = format.toUpperCase();
    button.hidden = format === 'csv' && kind !== 'table';
    button.disabled = disabled;
    button.addEventListener('click', () => {
      try {
        const output = exportPayload(payload(), format);
        const url = URL.createObjectURL(
          new Blob([output], {
            type:
              format === 'json'
                ? 'application/json'
                : format === 'csv'
                  ? 'text/csv;charset=utf-8'
                  : 'text/plain;charset=utf-8',
          }),
        );
        const a = document.createElement('a');
        a.href = url;
        a.download = artifactFilename(title(), format);
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {
        text.setCustomValidity(labels.importHint);
        text.reportValidity();
      }
    });
    disclosure.append(button);
  }
  function safeRender() {
    try {
      render();
    } catch {
      preview.textContent = labels.importHint;
    }
  }
  text.addEventListener(
    'input',
    () => {
      text.setCustomValidity('');
      try {
        if (!committing) safeRender();
      } catch {
        preview.textContent = labels.importHint;
      }
    },
    { signal: abort.signal },
  );
  el.append(preview, disclosure);
  render();
  return {
    setDisabled(value: boolean) {
      disabled = value;
      for (const input of el.querySelectorAll<HTMLButtonElement | HTMLTextAreaElement>('button,textarea'))
        input.disabled = value || input.dataset.unavailable === 'true';
    },
    dispose: () => abort.abort(),
    setLabels(next: ArtifactPresentationLabels) {
      labels = next;
      summary.textContent = labels.export;
      hint.textContent = labels.structuredHint;
      safeRender();
    },
    refresh: safeRender,
    el,
    payload,
    get kind() {
      return kind;
    },
  };
}
