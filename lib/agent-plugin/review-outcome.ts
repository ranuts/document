/** A review settles once; only verified execution permits dependent operations. */
export type ReviewOutcome<Action> =
  | { status: 'sent' | 'verified' | 'cancelled' | 'expired'; action: Action }
  | { status: 'failed'; action: Action; error: unknown };
