import { balance, upgradeIds, type UpgradeId } from './balance';

export const locationIds = ['roadside', 'lake', 'bazaar', 'embankment', 'restaurant'] as const;
export type LocationId = (typeof locationIds)[number];

export interface LocationDef {
  id: LocationId;
  index: number;
  baseSlots: number;
  basePlates: number;
  costMult: number;
  upgrades: Partial<Record<UpgradeId, number>>;
}

export type UpgradeLevels = Partial<Record<UpgradeId, number>>;

export interface DayMods {
  grillSlots: number;
  plates: number;
  coalDecayMult: number;
  autoFanSlots: number;
  sprayerDelaySec: number | null;
  helper: boolean;
  fridgeBonus: number;
  canopy: boolean;
  patienceMult: number;
  tipMult: number;
}

export const locations: Record<LocationId, LocationDef> = {
  roadside: {
    id: 'roadside',
    index: 1,
    baseSlots: 4,
    basePlates: 2,
    costMult: 1,
    upgrades: { grill: 1, coal: 2, plates: 1, decor: 2, marinade: 1 },
  },
  lake: {
    id: 'lake',
    index: 2,
    baseSlots: 5,
    basePlates: 2,
    costMult: 1.2,
    upgrades: { grill: 1, coal: 2, fan: 1, sprayer: 2, plates: 1, decor: 2, marinade: 2 },
  },
  bazaar: {
    id: 'bazaar',
    index: 3,
    baseSlots: 5,
    basePlates: 3,
    costMult: 1.2,
    upgrades: {
      grill: 2,
      coal: 3,
      fan: 2,
      sprayer: 2,
      helper: 1,
      fridge: 2,
      decor: 3,
      marinade: 2,
    },
  },
  embankment: {
    id: 'embankment',
    index: 4,
    baseSlots: 6,
    basePlates: 3,
    costMult: 1.3,
    upgrades: {
      grill: 2,
      coal: 3,
      fan: 2,
      sprayer: 2,
      helper: 1,
      plates: 1,
      fridge: 2,
      canopy: 1,
      decor: 3,
      marinade: 3,
    },
  },
  restaurant: {
    id: 'restaurant',
    index: 5,
    baseSlots: 7,
    basePlates: 3,
    costMult: 1.35,
    upgrades: {
      grill: 1,
      coal: 3,
      fan: 2,
      sprayer: 2,
      helper: 1,
      plates: 1,
      fridge: 2,
      canopy: 1,
      decor: 3,
      marinade: 3,
    },
  },
};

export function isLocationId(value: unknown): value is LocationId {
  return typeof value === 'string' && (locationIds as readonly string[]).includes(value);
}

export function locationUpgrades(location: LocationId): UpgradeId[] {
  const def = locations[location];
  return upgradeIds.filter((id) => (def.upgrades[id] ?? 0) > 0);
}

export function maxUpgradeLevel(location: LocationId, upgrade: UpgradeId): number {
  const limit = locations[location].upgrades[upgrade] ?? 0;
  return Math.min(limit, balance.upgrades[upgrade].costs.length);
}

export function upgradeLevel(
  location: LocationId,
  levels: UpgradeLevels,
  upgrade: UpgradeId,
): number {
  const level = levels[upgrade] ?? 0;
  return Math.min(maxUpgradeLevel(location, upgrade), Math.max(0, Math.floor(level)));
}

export function upgradeCost(
  location: LocationId,
  upgrade: UpgradeId,
  level: number,
): number | null {
  if (level >= maxUpgradeLevel(location, upgrade)) return null;
  const base = balance.upgrades[upgrade].costs[level];
  if (base === undefined) return null;
  return Math.round((base * locations[location].costMult) / 10) * 10;
}

export function baseMods(): DayMods {
  return {
    grillSlots: 4,
    plates: 2,
    coalDecayMult: 1,
    autoFanSlots: 0,
    sprayerDelaySec: null,
    helper: false,
    fridgeBonus: 0,
    canopy: false,
    patienceMult: 1,
    tipMult: 1,
  };
}

export function withBuzz(mods: DayMods, buzz: number): DayMods {
  const rules = balance.guestRules;
  if (buzz > 0) return { ...mods, tipMult: mods.tipMult * rules.buzzTipMult };
  if (buzz < 0) return { ...mods, patienceMult: mods.patienceMult * rules.buzzPatienceMult };
  return mods;
}

export function modsFor(location: LocationId, levels: UpgradeLevels = {}): DayMods {
  const def = locations[location];
  const level = (upgrade: UpgradeId): number => upgradeLevel(location, levels, upgrade);
  const u = balance.upgrades;
  const sprayer = level('sprayer');
  return {
    grillSlots: Math.min(8, def.baseSlots + level('grill') * u.grill.slotsPerLevel),
    plates: Math.min(4, def.basePlates + level('plates')),
    coalDecayMult: u.coal.decayMult[level('coal')] ?? 1,
    autoFanSlots: level('fan'),
    sprayerDelaySec: sprayer > 0 ? (u.sprayer.delaySec[sprayer] ?? null) : null,
    helper: level('helper') > 0,
    fridgeBonus: level('fridge') * u.fridge.stockPerLevel,
    canopy: level('canopy') > 0,
    patienceMult: u.decor.patienceMult[level('decor')] ?? 1,
    tipMult: u.marinade.tipMult[level('marinade')] ?? 1,
  };
}
