export type ApplicationMode = 'demo' | 'connected';
/** Fail closed: a typo or an unfinished connection must never load demo records. */
export function applicationMode(value: string | undefined): ApplicationMode {
  if (value === 'demo') return 'demo';
  if (value === 'connected') return 'connected';
  throw new Error('Invalid application mode. Use demo or connected.');
}
