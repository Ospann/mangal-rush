import { writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { campaignDays } from '../src/game/levels';
import { modsFor } from '../src/game/locations';
import { averageBot, expertBot, reportDay, type DayReport } from '../src/game/sim/bot';

const RUNS = Number(process.env.SIM_RUNS ?? 30);

function pct(value: number): string {
  return `${Math.round(value * 100)}%`.padStart(5);
}

function row(report: DayReport): string {
  return [
    report.id.padEnd(5),
    pct(report.passRate),
    pct(report.goalRate),
    pct(report.threeStarRate),
    report.avgStars.toFixed(2).padStart(5),
    Math.round(report.avgRevenue).toString().padStart(6),
    `${Math.round(report.minRevenue)}-${Math.round(report.maxRevenue)}`.padStart(10),
    report.avgServed.toFixed(1).padStart(6),
    report.avgLost.toFixed(1).padStart(5),
    report.avgBurnt.toFixed(1).padStart(5),
  ].join(' ');
}

it('simulates the campaign with bots', () => {
  const header = 'day    pass  goal 3star stars    rev    min-max served  lost burnt';
  const calibration: Record<string, { avg: DayReport; expert: DayReport }> = {};
  const lines: string[] = [];
  for (const [name, skill] of [
    ['average bot', averageBot],
    ['expert bot', expertBot],
  ] as const) {
    lines.push('', `${name}, ${RUNS} runs per day, no upgrades`, header);
    for (const level of campaignDays) {
      const report = reportDay(level, modsFor(level.location), skill, RUNS);
      lines.push(`${row(report)}  ${level.stars.join('/')} ${level.goal.type}:${level.goal.value}`);
      const entry = (calibration[level.id] ??= { avg: report, expert: report });
      if (skill === averageBot) entry.avg = report;
      else entry.expert = report;
    }
  }
  console.log(lines.join('\n'));
  if (process.env.SIM_OUT) writeFileSync(process.env.SIM_OUT, JSON.stringify(calibration));
  expect(campaignDays.length).toBeGreaterThan(0);
});
