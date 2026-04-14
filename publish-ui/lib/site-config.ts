import type { SiteConfig } from '../types'

export let siteConfig: SiteConfig = {} as SiteConfig;

export function __setSiteConfig(config: SiteConfig) {
  siteConfig = config;
}
