import type { LocationId } from './locations';

export type TutorialStep =
  | 'place'
  | 'flip'
  | 'take'
  | 'serve'
  | 'fan'
  | 'coals'
  | 'side'
  | 'splash';

export type TutorialSignal =
  | 'placed'
  | 'flipped'
  | 'taken'
  | 'served'
  | 'fanned'
  | 'coalsAdded'
  | 'sideAdded'
  | 'flare'
  | 'flareOut';

export const TUTORIAL_LOCATION: LocationId = 'roadside';
export const TUTORIAL_FAN_MOVES = 24;

const plans: Record<number, readonly TutorialStep[]> = {
  1: ['place', 'flip', 'take', 'serve'],
  2: ['fan', 'coals'],
  3: ['side'],
};

const doneBy: Record<TutorialStep, TutorialSignal> = {
  place: 'placed',
  flip: 'flipped',
  take: 'taken',
  serve: 'served',
  fan: 'fanned',
  coals: 'coalsAdded',
  side: 'sideAdded',
  splash: 'flareOut',
};

export class Tutorial {
  private readonly queue: TutorialStep[];
  private flaring = false;
  private splashTaught = false;
  private fanMoves = 0;

  constructor(day: number) {
    this.queue = [...(plans[day] ?? [])];
  }

  static forDay(location: LocationId, day: number, stars: number): Tutorial | null {
    if (location !== TUTORIAL_LOCATION || stars > 0 || !(day in plans)) return null;
    return new Tutorial(day);
  }

  get step(): TutorialStep | null {
    if (this.flaring) return 'splash';
    return this.queue[0] ?? null;
  }

  get finished(): boolean {
    return this.step === null;
  }

  signal(signal: TutorialSignal): boolean {
    const before = this.step;
    if (signal === 'flare' && !this.splashTaught) this.flaring = true;
    if (signal === 'flareOut' && this.flaring) {
      this.flaring = false;
      this.splashTaught = true;
    }
    if (signal === 'fanned') {
      this.fanMoves += 1;
      if (this.fanMoves < TUTORIAL_FAN_MOVES) return before !== this.step;
    }
    const index = this.queue.findIndex((step) => doneBy[step] === signal);
    if (index >= 0) this.queue.splice(0, index + 1);
    return before !== this.step;
  }
}
