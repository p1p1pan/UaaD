export type ActivityCountdownPhase = 'upcoming' | 'selling' | 'soldOut' | 'closed';

interface ActivityCountdownStateInput {
  enrollOpenAt: string;
  enrollCloseAt: string;
  soldOut?: boolean;
  now?: number;
}

export interface ActivityCountdownState {
  phase: ActivityCountdownPhase;
  targetTime: number | null;
  remainingMs: number;
}

export function resolveActivityCountdownState({
  enrollOpenAt,
  enrollCloseAt,
  soldOut = false,
  now = Date.now(),
}: ActivityCountdownStateInput): ActivityCountdownState {
  const openAt = new Date(enrollOpenAt).getTime();
  const closeAt = new Date(enrollCloseAt).getTime();

  if (!Number.isFinite(openAt) || !Number.isFinite(closeAt)) {
    return {
      phase: 'closed',
      targetTime: null,
      remainingMs: 0,
    };
  }

  if (now < openAt) {
    return {
      phase: 'upcoming',
      targetTime: openAt,
      remainingMs: Math.max(0, openAt - now),
    };
  }

  if (now > closeAt) {
    return {
      phase: 'closed',
      targetTime: closeAt,
      remainingMs: 0,
    };
  }

  if (soldOut) {
    return {
      phase: 'soldOut',
      targetTime: closeAt,
      remainingMs: 0,
    };
  }

  return {
    phase: 'selling',
    targetTime: closeAt,
    remainingMs: Math.max(0, closeAt - now),
  };
}
