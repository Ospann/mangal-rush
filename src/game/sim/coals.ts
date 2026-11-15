import { balance } from '../balance';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class Coals {
  level: number;
  cooldownSec = 0;
  smokeLeftSec = 0;
  readonly mods: number[];

  constructor(
    readonly slotCount: number,
    startLevel: number = balance.coals.startLevel,
  ) {
    this.level = clamp(startLevel, 0, 1);
    this.mods = Array.from({ length: slotCount }, () => 0);
  }

  profile(slot: number): number {
    if (this.slotCount <= 1) return 1;
    const center = (this.slotCount - 1) / 2;
    const distance = Math.abs(slot - center) / center;
    return 1 - balance.coals.edgeDrop * distance * distance;
  }

  get smokeFactor(): number {
    const { smokeSec, smokeFactor } = balance.coals;
    if (this.smokeLeftSec <= 0) return 1;
    const progress = 1 - this.smokeLeftSec / smokeSec;
    return smokeFactor + (1 - smokeFactor) * progress;
  }

  get isSmoking(): boolean {
    return this.smokeLeftSec > 0;
  }

  get canAdd(): boolean {
    return this.cooldownSec <= 0;
  }

  heat(slot: number): number {
    const base = this.level * this.profile(slot) * this.smokeFactor;
    return clamp(base + (this.mods[slot] ?? 0), 0, balance.coals.maxSlotHeat);
  }

  tick(dtSec: number, decayMult = 1): void {
    const { decayPerSec, minLevel } = balance.coals;
    if (this.level > minLevel) {
      this.level = Math.max(minLevel, this.level - decayPerSec * decayMult * dtSec);
    }
    this.cooldownSec = Math.max(0, this.cooldownSec - dtSec);
    this.smokeLeftSec = Math.max(0, this.smokeLeftSec - dtSec);

    for (let slot = 0; slot < this.slotCount; slot += 1) {
      const mod = this.mods[slot] ?? 0;
      if (mod > 0) this.mods[slot] = Math.max(0, mod - balance.fan.decayPerSec * dtSec);
      else if (mod < 0)
        this.mods[slot] = Math.min(0, mod + balance.flare.chillRecoverPerSec * dtSec);
    }
  }

  add(): boolean {
    if (!this.canAdd) return false;
    this.level = clamp(this.level + balance.coals.addAmount, 0, 1);
    this.cooldownSec = balance.coals.addCooldownSec;
    this.smokeLeftSec = balance.coals.smokeSec;
    return true;
  }

  fan(slot: number, amount: number): void {
    if (slot < 0 || slot >= this.slotCount || amount <= 0) return;
    const current = this.mods[slot] ?? 0;
    this.mods[slot] = Math.min(balance.fan.maxBoost, current + amount);
  }

  hold(slot: number, boost: number): void {
    if (slot < 0 || slot >= this.slotCount) return;
    const current = this.mods[slot] ?? 0;
    if (current >= 0 && current < boost) this.mods[slot] = boost;
  }

  chill(slot: number): void {
    if (slot < 0 || slot >= this.slotCount) return;
    this.mods[slot] = Math.min(this.mods[slot] ?? 0, balance.flare.waterChill);
  }
}
