const width = 720;
const height = 1280;

const grillX = 12;
const grillTop = 800;
const grillW = width - grillX * 2;
const grillH = 412;
const slotsLeft = grillX + 30;
const slotsRight = width - grillX - 30;

export const layout = {
  width,
  height,
  hudH: 64,

  bubbleY: 130,
  guestY: 292,
  counterY: 392,
  counterH: 66,
  patienceY: 432,

  plateY: 532,
  plateSpacing: 226,
  stationY: 652,
  stationW: 88,
  stationLeft: 8,
  trayY: 742,
  trayMaxW: 116,
  bucketX: 668,
  bucketY: 650,

  grillX,
  grillTop,
  grillW,
  grillH,
  slotsLeft,
  slotsRight,
  skewerY: 978,
  meatTop: 866,
  meatBottom: 1090,
  barY: 1106,
  stripTop: 1122,
  stripBottom: grillTop + grillH - 12,
  coalsButtonY: 1246,
  tutorialUpperY: 490,
  tutorialLowerY: 1164,

  tapSlop: 14,
  plateMagnet: 150,
  seatMagnet: 190,
  bucketMagnet: 74,
} as const;

export function slotWidth(slots: number): number {
  return (layout.slotsRight - layout.slotsLeft) / slots;
}

export function slotX(slot: number, slots: number): number {
  return layout.slotsLeft + slotWidth(slots) * (slot + 0.5);
}

export function slotAt(x: number, slots: number): number {
  const index = Math.floor((x - layout.slotsLeft) / slotWidth(slots));
  return Math.min(slots - 1, Math.max(0, index));
}

export function skewerScaleX(slots: number): number {
  return Math.min(1.45, slotWidth(slots) / 104);
}

export function skewerScaleY(slots: number): number {
  return Math.min(1, slotWidth(slots) / 104);
}

export function seatX(seat: number, seats: number): number {
  return (layout.width / seats) * (seat + 0.5);
}

export function plateScale(plates: number): number {
  return Math.min(1, 700 / plates / 214);
}

export function stationX(index: number): number {
  return layout.stationLeft + layout.stationW * (index + 0.5);
}

export function trayX(index: number, count: number): number {
  const step = Math.min(layout.trayMaxW, 704 / count);
  return layout.width / 2 + (index - (count - 1) / 2) * step;
}

export function plateX(plate: number, plates: number): number {
  const spacing = Math.min(layout.plateSpacing, 700 / plates);
  return layout.width / 2 + (plate - (plates - 1) / 2) * spacing;
}

export function inGrill(y: number): boolean {
  return y >= layout.grillTop - 20 && y <= layout.grillTop + layout.grillH;
}

export function inMeatZone(y: number): boolean {
  return y >= layout.grillTop - 20 && y < layout.stripTop;
}

export function inCoalStrip(y: number): boolean {
  return y >= layout.stripTop && y <= layout.grillTop + layout.grillH;
}
