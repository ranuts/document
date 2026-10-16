import { createRequestQueueView } from './request-queue-view';
import type { RequestQueue } from './request-queue';

/** Bind queue UI to the current chat without owning execution or document permissions. */
export function createRequestQueueControls<Binding>(options: {
  queue(): RequestQueue<Binding> | undefined;
  conversation(): string;
  getDraft(): string;
  setDraft(text: string): void;
  focus(): void;
  /** True when the host opened prerequisite setup instead of executing the request. */
  prepare(text: string): boolean;
}) {
  const view = createRequestQueueView({
    focus: options.focus,
    edit: (id) => {
      if (options.getDraft().trim()) {
        view.occupied();
        return;
      }
      if (
        !options.queue()?.restore(options.conversation(), id, true, (text) => {
          options.setDraft(text);
          options.focus();
        })
      )
        view.unavailable();
    },
    remove: (id) => options.queue()?.remove(options.conversation(), id),
    sendNow: (id) => {
      const queue = options.queue();
      const conversation = options.conversation();
      const entry = queue?.state(conversation).entries.find((entry) => entry.id === id);
      if (entry && !options.prepare(entry.text)) queue?.sendNow(conversation, id);
    },
    resume: () => {
      const queue = options.queue();
      const conversation = options.conversation();
      const entry = queue?.state(conversation).entries.find((entry) => !entry.recoverOnly);
      if (entry && !options.prepare(entry.text)) queue?.resume(conversation);
    },
  });
  return view;
}
