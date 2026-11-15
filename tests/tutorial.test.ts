import { describe, expect, it } from 'vitest';
import { Tutorial, TUTORIAL_FAN_MOVES } from '../src/game/tutorial';

describe('Tutorial', () => {
  it('runs only on the first three roadside days without stars', () => {
    expect(Tutorial.forDay('roadside', 1, 0)).not.toBeNull();
    expect(Tutorial.forDay('roadside', 3, 0)).not.toBeNull();
    expect(Tutorial.forDay('roadside', 4, 0)).toBeNull();
    expect(Tutorial.forDay('roadside', 1, 2)).toBeNull();
    expect(Tutorial.forDay('bazaar', 1, 0)).toBeNull();
  });

  it('walks the first day in order', () => {
    const tutorial = new Tutorial(1);
    expect(tutorial.step).toBe('place');
    expect(tutorial.signal('flipped')).toBe(true);
    expect(tutorial.step).toBe('take');
    tutorial.signal('served');
    expect(tutorial.finished).toBe(true);
  });

  it('ignores signals of steps already passed', () => {
    const tutorial = new Tutorial(1);
    tutorial.signal('placed');
    expect(tutorial.signal('placed')).toBe(false);
    expect(tutorial.step).toBe('flip');
  });

  it('teaches splashing once when a flare appears', () => {
    const tutorial = new Tutorial(1);
    tutorial.signal('flare');
    expect(tutorial.step).toBe('splash');
    tutorial.signal('flareOut');
    expect(tutorial.step).toBe('place');
    tutorial.signal('flare');
    expect(tutorial.step).toBe('place');
  });

  it('needs a real swipe to finish the fan step', () => {
    const tutorial = new Tutorial(2);
    for (let move = 1; move < TUTORIAL_FAN_MOVES; move += 1) tutorial.signal('fanned');
    expect(tutorial.step).toBe('fan');
    tutorial.signal('fanned');
    expect(tutorial.step).toBe('coals');
  });
});
