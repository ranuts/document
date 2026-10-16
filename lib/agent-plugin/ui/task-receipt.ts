import { t } from '@ranuts/shared/i18n';
import type { AgentEvent } from '@ranuts/agent-core/runtime';
const states = ['verified', 'sent', 'failed', 'cancelled'] as const;
type State = (typeof states)[number];
const keys = {
  verified: 'agentChangesVerified',
  sent: 'agentChangesSent',
  failed: 'agentChangesFailed',
  cancelled: 'agentChangesCancelled',
} as const;
/** A flat, collapsed receipt of actual settled write outcomes; never a task permission. */
export function createTaskReceipt() {
  const el = document.createElement('details');
  el.className = 'agent-task-receipt';
  el.hidden = true;
  const summary = document.createElement('summary');
  const list = document.createElement('ul');
  const limit = document.createElement('p');
  limit.className = 'agent-task-receipt-limit';
  limit.hidden = true;
  el.append(summary, list, limit);
  const outcomes: Array<{ status: State; target: string }> = [];
  const counts: Record<State, number> = { verified: 0, sent: 0, failed: 0, cancelled: 0 };
  let disposed = false;
  const render = () => {
    summary.textContent =
      `${t('agentViewChanges')} · ` +
      states
        .map((status) => {
          const count = counts[status];
          return count ? t(keys[status], { count }) : '';
        })
        .filter(Boolean)
        .join(' · ');
    list.replaceChildren(
      ...outcomes.map((outcome) => {
        const row = document.createElement('li');
        row.textContent = `${outcome.target} · ${t(keys[outcome.status], { count: 1 })}`;
        return row;
      }),
    );
    const total = states.reduce((count, status) => count + counts[status], 0);
    limit.hidden = total <= outcomes.length;
    limit.textContent = limit.hidden ? '' : t('agentReceiptDetailsLimit', { shown: outcomes.length, total });
    el.hidden = total === 0;
  };
  window.addEventListener('languagechange', render);
  return {
    el,
    observe(event: AgentEvent) {
      if (event.type !== 'tool_result' || event.readOnlyHint !== false || disposed) return;
      let data: { status?: State; target?: string };
      try {
        data = JSON.parse(event.content);
      } catch {
        data = {};
      }
      const status = event.isError ? 'failed' : states.includes(data?.status as State) ? data.status : undefined;
      if (!status) return;
      counts[status]++;
      if (outcomes.length < 16)
        outcomes.push({
          status,
          target: typeof data?.target === 'string' ? data.target.slice(0, 200) : t('agentCurrentDocument'),
        });
      render();
    },
    dispose() {
      disposed = true;
      window.removeEventListener('languagechange', render);
    },
  };
}
