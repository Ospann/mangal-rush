import type { GameI18n } from '../../i18n';
import type { DayGoal } from '../levels/types';

export function goalText(i18n: GameI18n, goal: DayGoal): string {
  return i18n.t(`goal.${goal.type}`, { value: goal.value });
}

export function goalShortText(i18n: GameI18n, goal: DayGoal, value: number): string {
  return i18n.t(`goal.short.${goal.type}`, { value, target: goal.value });
}
