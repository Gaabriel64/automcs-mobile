// Config d'auto-mcs (auto-mcs.ini) reçue via Telepath.
//
// Le serveur lit le .ini en conservant la casse des clés (ConfigParser.optionxform = str) :
// les vraies clés sont allocatedMemory, updateAuto, customFlags, enableProxy, enableGeyser,
// autostart, bkupMax… Une clé « allocatedmemory » est donc une AUTRE clé, ignorée du serveur.
//
// Et write_config remplace tout le fichier par ce que l'app envoie : il faut donc écrire à
// partir de la config lue JUSTE AVANT, jamais d'une copie gardée en mémoire depuis le
// chargement de l'écran (elle annulerait les changements faits depuis).

// Clés en minuscules créées par erreur par d'anciennes versions de l'app
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
