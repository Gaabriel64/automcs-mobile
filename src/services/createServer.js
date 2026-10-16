// Création d'un serveur via Telepath, avec les mêmes appels et le même ordre que le
// desktop (views/server/create.py → CreateServerProgressScreen, foundry.pre_server_create) :
//
//   main/check_free_space → create/push_new_server → create/pre_server_create
//   → main/java_check → create/download_jar → [create/install_server]
//   → create/generate_server_files → create/create_backup → create/post_server_create
//
// Le serveur garde l'état de la création en mémoire (foundry.new_server_info) entre ces
// appels : ils doivent donc se suivre, un seul serveur créé à la fois.
//
// Limites de cette première version : pas d'addons à la création (Fabric API, Geyser,
// désactivation du chat reporting) ni de monde importé. Geyser s'active ensuite depuis
// les paramètres du serveur, les mods depuis l'onglet Mods.

// Types qui nécessitent l'étape d'installation (installeur Forge/NeoForge/Fabric/Quilt)
export const NEEDS_INSTALL = ['forge', 'neoforge', 'fabric', 'quilt'];

// Valeurs par défaut du desktop (foundry.new_server_init)
export const DEFAULT_SETTINGS = {
  world: 'world',
  seed: '',
  level_type: 'default',
  motd: 'A Minecraft Server',
  difficulty: 'normal',        // peaceful | easy | normal | hard | hardcore
  gamemode: 'survival',        // survival | creative | adventure
  spawn_creatures: true,
  spawn_protection: false,
  pvp: false,
  max_players: '20',
  keep_inventory: false,
  daylight_weather_cycle: true,
  command_blocks: false,
  random_tick_speed: '3',
  // Pas d'addons à la création : on n'annonce donc pas ces options au serveur
  geyser_support: false,
  disable_chat_reporting: false,
  enable_proxy: false,
};

const randomHash = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');

// Dictionnaire envoyé à create/push_new_server. Il remplace tout new_server_info côté
// serveur : il doit donc contenir toutes les clés attendues par main (1.2.2) ET par
// ui-fixes (1.3.x) — `addon_objects` (liste) pour l'un, `addon_object` pour l'autre.
export function buildServerInfo({ name, type, version, port = '25565', ip = '', settings = {} }) {
  return {
    _hash: randomHash(),
    _telepath_data: null,
    name: String(name).trim(),
    type,
    version: String(version).trim(),
    build: '',        // résolus par le serveur (search_version) dans download_jar
    jar_link: '',
    ip,
    port: String(port),
    server_settings: { ...DEFAULT_SETTINGS, ...settings },
    addon_objects: [],
    addon_object: null,
    // Ne doit PAS être null : generate_server_files appelle acl_object.count_rules() et
    // lit sa liste blanche. Un dict non vide fait construire un AclManager vide au serveur.
    acl_object: { rules: {} },
  };
}

const TYPE_LABEL = { forge: 'Forge', neoforge: 'NeoForge', fabric: 'Fabric', quilt: 'Quilt' };

export function buildSteps(type) {
  const steps = [
    { id: 'space',   label: "Vérification de l'espace disque" },
    { id: 'push',    label: 'Préparation' },
    { id: 'pre',     label: 'Initialisation' },
    { id: 'java',    label: 'Vérification de Java' },
    { id: 'jar',     label: "Téléchargement de 'server.jar'" },
  ];
  if (NEEDS_INSTALL.includes(type)) steps.push({ id: 'install', label: `Installation de ${TYPE_LABEL[type]}` });
  steps.push(
    { id: 'files',   label: 'Configuration du serveur' },
    { id: 'backup',  label: 'Sauvegarde initiale' },
    { id: 'post',    label: 'Finalisation' },
  );
  return steps;
}

// Délais (ms) : le serveur ne répond qu'une fois l'étape terminée
const MIN = 60 * 1000;
const TIMEOUTS = { push: 30000, pre: 5 * MIN, java: 20 * MIN, jar: 20 * MIN, install: 20 * MIN, files: 10 * MIN, backup: 10 * MIN, post: 5 * MIN };

// Exécute la création. `service` = telepathService (checkFreeSpace + createCall).
// `onStep(index, status)` avec status = 'running' | 'done' | 'error'.
export async function createServer(service, { name, type, version, port, settings }, onStep = () => {}) {
  const steps = buildSteps(type);
  const serverInfo = buildServerInfo({ name, type, version, port, settings });

  const run = {
    space: async () => {
      if ((await service.checkFreeSpace()) === false) {
        throw new Error("Espace disque insuffisant sur la machine qui héberge auto-mcs.");
      }
    },
    push: () => service.createCall('create/push_new_server',
      { server_info: serverInfo, import_info: { name: null, path: null } }, TIMEOUTS.push),
    pre: () => service.createCall('create/pre_server_create', { telepath: true }, TIMEOUTS.pre),
    java: async () => {
      const ok = await service.createCall('main/java_check',
        { server_version: serverInfo.version, server_type: type }, TIMEOUTS.java);
      if (ok === false) throw new Error("Java n'a pas pu être installé ou vérifié.");
    },
    jar: async () => {
      const ok = await service.createCall('create/download_jar', { imported: false }, TIMEOUTS.jar);
      if (ok === false) {
        throw new Error("Impossible de télécharger 'server.jar' : version introuvable pour ce type, ou le serveur n'a pas accès à Internet.");
      }
    },
    install: async () => {
      const ok = await service.createCall('create/install_server', { imported: false }, TIMEOUTS.install);
      if (ok === false) throw new Error("L'installation du serveur a échoué.");
    },
    files: async () => {
      const ok = await service.createCall('create/generate_server_files', {}, TIMEOUTS.files);
      if (ok === false) throw new Error('La génération des fichiers du serveur a échoué.');
    },
    backup: () => service.createCall('create/create_backup', { import_server: false }, TIMEOUTS.backup),
    post: () => service.createCall('create/post_server_create', { telepath: true }, TIMEOUTS.post),
  };

  for (let i = 0; i < steps.length; i++) {
    onStep(i, 'running');
    try {
      await run[steps[i].id]();
    } catch (e) {
      onStep(i, 'error');
      const err = new Error(e.message);
      err.step = steps[i];
      err.stepIndex = i;
      throw err;
    }
    onStep(i, 'done');
  }
  return serverInfo.name;
}
