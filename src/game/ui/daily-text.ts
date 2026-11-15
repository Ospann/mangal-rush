import type { GameI18n } from '../../i18n';
import type { DailyTask } from '../daily';

export function dailyText(i18n: GameI18n, task: DailyTask): string {
  const params = { value: Math.round(task.progress), target: task.target };
  if (task.kind === 'perfect') {
    return i18n.t('daily.perfect', { ...params, meat: i18n.t(`meat.${task.meat ?? 'chicken'}`) });
  }
  return i18n.t(`daily.${task.kind}`, params);
}
