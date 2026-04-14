import type { WidgetsConfig } from '../types'

export let widgetsConfig: WidgetsConfig = {} as WidgetsConfig;

export function __setWidgetsConfig(config: WidgetsConfig) {
  widgetsConfig = config;
}
