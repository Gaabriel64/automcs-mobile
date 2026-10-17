// auto-mcs config (auto-mcs.ini) received through Telepath.
//
// The server reads the .ini keeping the case of keys (ConfigParser.optionxform = str):
// the real keys are allocatedMemory, updateAuto, customFlags, enableProxy, enableGeyser,
// autostart, bkupMax... A key like "allocatedmemory" is therefore a DIFFERENT key that the server ignores.
//
// And write_config replaces the whole file with what the app sends: always write from the
// config read JUST BEFORE, never from a copy kept in memory since the screen loaded
// (it would undo the changes made since).

// Lowercase keys created by mistake by older versions of the app
const STRAY_KEYS = ['allocatedmemory', 'updateauto', 'customflags', 'enableproxy', 'enablegeyser'];

export function cleanConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return cfg;
  const general = { ...(cfg.general || {}) };
  STRAY_KEYS.forEach(k => { delete general[k]; });
  return { ...cfg, general };
}

export async function fetchFreshConfig(service) {
  return cleanConfig(await service.getServerAttr('config_file'));
}
