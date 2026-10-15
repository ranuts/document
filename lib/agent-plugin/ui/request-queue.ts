import type { TurnResult } from './controller';

export interface QueuedRequest<Binding> {
  readonly id: string;
  readonly text: string;
  readonly binding: Binding;
  /** Cancelled validation is recoverable text, never executable FIFO work. */
  readonly recoverOnly?: true;
}
export interface RequestQueueState<Binding> {
  readonly entries: readonly QueuedRequest<Binding>[];
  readonly paused: boolean;
  /** An unaccepted active attempt remains unavailable until its submit physically settles. */
  readonly preparing?: { readonly id: string; readonly stopping: boolean };
}
interface Session<Binding> {
  entries: QueuedRequest<Binding>[];
  paused: boolean;
}
interface Active<Binding> {
  session: string;
  entry: QueuedRequest<Binding>;
  accepted: boolean;
  cancelled: boolean;
  resumeAfter: boolean;
  invalidated: boolean;
  holding: boolean;
  review?: string;
  replacement?: { current(): boolean };
}
/** Volatile host queue. One global submit owns execution until its promise settles. */
export class RequestQueue<Binding> {
  private readonly sessions = new Map<string, Session<Binding>>();
  private selected?: string;
  private active?: Active<Binding>;
  private application?: { session: string; cancelled: boolean; resumeAfter: boolean; cancel?(): void };
  constructor(
    private readonly options: {
      execute(entry: QueuedRequest<Binding>, accept: () => boolean): Promise<TurnResult>;
      cancel(): void;
      revoke(entry: QueuedRequest<Binding>): void;
      changed(): void;
    },
  ) {}
  get activeId(): string | undefined {
    return this.active?.entry.id;
  }
  get busy(): boolean {
    return !!this.active || !!this.application;
  }
  state(id: string): RequestQueueState<Binding> {
    const session = this.session(id);
    const active = this.active;
    return {
      entries: session.entries,
      paused: session.paused,
      ...(active?.session === id && !active.accepted
        ? { preparing: { id: active.entry.id, stopping: active.cancelled } }
        : {}),
    };
  }
  /** Every physical document Apply, including retained cards, blocks subsequent submits. */
  acquireApplication(
    session: string,
    owner?: string,
    cancel?: () => void,
  ): (((status: 'success' | 'failed' | 'stopped') => void) & { stop(): void }) | undefined {
    if (this.application || (this.active && this.active.entry.id !== owner)) return;
    const application = { session, cancelled: false, resumeAfter: false, cancel };
    this.application = application;
    let released = false;
    const release = (status: 'success' | 'failed' | 'stopped') => {
      if (released || this.application !== application) return;
      released = true;
      this.application = undefined;
      if (status !== 'success' && !application.resumeAfter) this.session(session).paused = true;
      this.options.changed();
      queueMicrotask(() => this.drain());
    };
    return Object.assign(release, {
      stop: () => {
        if (this.application === application) this.pause(session);
      },
    });
  }
  pendingConversations(): string[] {
    return [...this.sessions].filter(([, state]) => state.entries.length).map(([id]) => id);
  }
  /** Keep every volatile request owner reachable until execution and recovery finish. */
  retainedConversations(): string[] {
    const ids = new Set(this.pendingConversations());
    if (this.active) ids.add(this.active.session);
    if (this.application) ids.add(this.application.session);
    return [...ids];
  }
  private session(id: string): Session<Binding> {
    let session = this.sessions.get(id);
    if (!session) {
      session = { entries: [], paused: false };
      this.sessions.set(id, session);
    }
    return session;
  }
  select(id: string): void {
    if (this.selected && this.selected !== id) this.pause(this.selected);
    this.selected = id;
    this.options.changed();
  }
  enqueue(
    session: string,
    text: string,
    binding: Binding,
    replacement?: { owner: string; current(): boolean },
  ): QueuedRequest<Binding> {
    const entry = Object.freeze({ id: crypto.randomUUID(), text, binding });
    const state = this.session(session);
    // A fresh explicit Send need not resume anything when no older work remains.
    if (state.paused && !state.entries.some((entry) => !entry.recoverOnly)) {
      state.paused = false;
      if (this.active?.session === session && this.active.cancelled) this.active.resumeAfter = true;
      if (this.application?.session === session && this.application.cancelled) this.application.resumeAfter = true;
    }
    if (replacement && replacement.current()) {
      state.entries.unshift(entry);
      state.paused = false;
      if (this.active?.entry.id === replacement.owner && this.active.session === session) {
        this.active.replacement = replacement;
        this.active.resumeAfter = true;
        if (this.active.holding) this.active = undefined;
      }
    } else state.entries.push(entry);
    this.options.changed();
    this.drain();
    return entry;
  }
  pause(id: string): void {
    this.session(id).paused = true;
    if (this.application?.session === id) this.application.resumeAfter = false;
    if (this.active?.session === id) {
      this.active.resumeAfter = false;
      this.cancel();
    }
    if (this.application?.session === id) this.cancelApplication();
    this.options.changed();
  }
  pauseAll(): void {
    for (const id of this.sessions.keys()) this.pause(id);
  }
  resume(id: string): void {
    this.session(id).paused = false;
    if (this.application?.session === id) this.application.resumeAfter = true;
    if (this.active?.session === id && this.active.cancelled) this.active.resumeAfter = true;
    this.options.changed();
    this.drain();
  }
  sendNow(id: string, entryId: string): void {
    const session = this.session(id);
    const index = session.entries.findIndex((entry) => entry.id === entryId);
    if (index < 0 || session.entries[index].recoverOnly || this.active?.entry.id === entryId) return;
    session.entries.unshift(...session.entries.splice(index, 1));
    session.paused = false;
    if (this.application) this.application.resumeAfter = true;
    if (this.active) {
      this.active.resumeAfter = true;
      this.cancel();
    } else this.cancelApplication();
    this.options.changed();
    this.drain();
  }
  remove(id: string, entryId: string): boolean {
    if (this.active?.entry.id === entryId) return false;
    const session = this.session(id);
    const index = session.entries.findIndex((entry) => entry.id === entryId);
    if (index < 0) return false;
    const [entry] = session.entries.splice(index, 1);
    this.options.revoke(entry);
    this.options.changed();
    return true;
  }
  restore(id: string, entryId: string, empty: boolean, insert: (text: string) => void): boolean {
    if (!empty) return false;
    const entry = this.session(id).entries.find((item) => item.id === entryId);
    if (!entry || !this.remove(id, entryId)) return false;
    insert(entry.text);
    return true;
  }
  invalidate(id: string): void {
    const session = this.session(id);
    for (const entry of session.entries) this.options.revoke(entry);
    session.entries = [];
    session.paused = false;
    if (this.active?.session === id) {
      this.active.invalidated = true;
      this.cancel();
    }
    if (this.application?.session === id) this.cancelApplication();
    this.options.changed();
  }
  invalidateAll(): void {
    for (const id of this.sessions.keys()) this.invalidate(id);
  }
  /** Card ownership survives pending() becoming false during asynchronous Apply. */
  settleReview(owner: string, status: string): void {
    const active = this.active;
    if (!active || active.entry.id !== owner) return;
    active.review = status;
    if (active.holding) this.finish(active, status === 'verified' ? 'success' : 'failed');
  }
  private cancel(): void {
    const active = this.active;
    if (!active || active.cancelled) return;
    active.cancelled = true;
    if (!active.accepted && !active.invalidated) {
      const session = this.session(active.session);
      session.entries = session.entries.map((entry) =>
        entry.id === active.entry.id ? Object.freeze({ ...entry, recoverOnly: true as const }) : entry,
      );
      this.options.revoke(active.entry);
    }
    if (this.application && !this.application.cancelled) {
      this.application.cancelled = true;
      this.application.cancel?.();
    }
    this.options.cancel();
    // A review callback owns held settlement, including an in-flight Apply.
  }
  private cancelApplication(): void {
    if (!this.application || this.application.cancelled) return;
    this.application.cancelled = true;
    this.application.cancel?.();
    this.options.cancel();
  }
  private drain(): void {
    if (this.active || this.application || !this.selected) return;
    const session = this.session(this.selected);
    const next = session.entries.find((entry) => !entry.recoverOnly);
    if (session.paused || !next) return;
    const active: Active<Binding> = {
      session: this.selected,
      entry: next,
      accepted: false,
      cancelled: false,
      resumeAfter: false,
      invalidated: false,
      holding: false,
    };
    this.active = active;
    this.options.changed();
    const accept = () => {
      if (this.active !== active || active.cancelled || active.invalidated) return false;
      if (active.accepted) return true;
      active.accepted = true;
      session.entries = session.entries.filter((entry) => entry !== active.entry);
      this.options.changed();
      return true;
    };
    let execution: Promise<TurnResult>;
    try {
      execution = this.options.execute(active.entry, accept);
    } catch {
      this.finish(active, 'failed');
      return;
    }
    void execution.then(
      (result) => {
        if (this.active !== active) return;
        if (!active.invalidated && result.status === 'review-pending' && active.accepted) {
          active.holding = true;
          if (active.replacement?.current()) {
            this.active = undefined;
            this.options.changed();
            this.drain();
          } else if (active.review) this.finish(active, active.review === 'verified' ? 'success' : 'failed');
          else this.options.changed();
        } else this.finish(active, result.status);
      },
      () => this.finish(active, 'failed'),
    );
  }
  private finish(active: Active<Binding>, status: TurnResult['status']): void {
    if (this.active !== active) return;
    const session = this.session(active.session);
    if (
      !active.invalidated &&
      ((!active.resumeAfter && status !== 'success') || (!active.accepted && status === 'success'))
    )
      session.paused = true;
    this.active = undefined;
    this.options.changed();
    // Let the host finish abort/cleanup before another submit can acquire it.
    queueMicrotask(() => this.drain());
  }
}
