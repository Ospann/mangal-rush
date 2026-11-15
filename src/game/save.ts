import type { SaveSchema } from '@core/save';
import type { Language } from '../i18n';
import type { LocationId, UpgradeLevels } from './locations';

export interface GameSave extends Record<string, unknown> {
  money: number;
  stars: Record<string, number>;
  upgrades: Partial<Record<LocationId, UpgradeLevels>>;
  regulars: Record<string, number>;
  buzz: number;
  soundEnabled: boolean;
  language: Language | null;
}

export const saveSchema: SaveSchema<GameSave> = {
  version: 4,
  defaults: () => ({
    money: 0,
    stars: {},
    upgrades: {},
    regulars: {},
    buzz: 0,
    soundEnabled: true,
    language: null,
  }),
  migrations: {
    2: (data) => {
      const { highScore, ...rest } = data;
      return { ...rest, bestScore: typeof highScore === 'number' ? highScore : 0 };
    },
    3: (data) => {
      const { bestScore: _bestScore, levelsCompleted: _levelsCompleted, ...rest } = data;
      return { ...rest, money: 0, stars: {}, upgrades: {} };
    },
    4: (data) => ({ ...data, regulars: {}, buzz: 0 }),
  },
};
