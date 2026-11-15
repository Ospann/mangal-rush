export interface DevParams {
  day: string | null;
  speed: number;
  debug: boolean;
}

export function parseDevParams(search: string, enabled: boolean): DevParams {
  const off: DevParams = { day: null, speed: 1, debug: false };
  if (!enabled) return off;
  const params = new URLSearchParams(search);
  const speed = Number(params.get('speed'));
  return {
    day: params.get('day'),
    speed: Number.isFinite(speed) && speed > 0 ? Math.min(speed, 8) : 1,
    debug: params.get('debug') === '1',
  };
}

export const devParams: DevParams = parseDevParams(
  typeof window === 'undefined' ? '' : window.location.search,
  import.meta.env.DEV || import.meta.env.VITE_PLATFORM === 'mock',
);
