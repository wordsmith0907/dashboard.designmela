import 'server-only';
import { resolveRuntimeConfig } from './runtime-config';

export function serverConfig() { return resolveRuntimeConfig(process.env); }
export function connectedConfig() {
  const config = serverConfig();
  if (config.mode !== 'connected') throw new Error('Connected Mode is unavailable.');
  return config;
}
