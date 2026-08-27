export interface ResolutionInput {
  width: string;
  height: string;
  refreshRate: string;
}

export const DEFAULT_INPUT: ResolutionInput = {
  width: '1920',
  height: '1080',
  refreshRate: '60',
};

/** Read ?w=&h=&hz= from a query string. Missing / invalid params fall back
 *  to the defaults. Values are kept as strings so the form stays controlled. */
export function inputFromQuery(search: string): ResolutionInput {
  const params = new URLSearchParams(search);
  const pick = (key: string, fallback: string): string => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    const trimmed = raw.trim();
    if (trimmed === '' || !/^\d+(\.\d+)?$/.test(trimmed)) return fallback;
    return trimmed;
  };
  return {
    width: pick('w', DEFAULT_INPUT.width),
    height: pick('h', DEFAULT_INPUT.height),
    refreshRate: pick('hz', DEFAULT_INPUT.refreshRate),
  };
}

export function queryFromInput(input: ResolutionInput): string {
  const params = new URLSearchParams();
  params.set('w', input.width);
  params.set('h', input.height);
  params.set('hz', input.refreshRate);
  return params.toString();
}

export function hasResolutionParams(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has('w') || params.has('h') || params.has('hz');
}

export function shareUrl(input: ResolutionInput): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?${queryFromInput(input)}`;
}
