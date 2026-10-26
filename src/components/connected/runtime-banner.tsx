import { serverConfig } from '@/lib/server-config';

export function RuntimeBanner() {
  const {label} = serverConfig();
  return label ? <p>{label}</p> : null;
}
