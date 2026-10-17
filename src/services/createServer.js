// Server creation through Telepath, with the same calls in the same order as the
// desktop (views/server/create.py → CreateServerProgressScreen, foundry.pre_server_create) :
//
//   main/check_free_space → create/push_new_server → create/pre_server_create
//   → main/java_check → create/download_jar → [create/install_server]
//   → create/generate_server_files → create/create_backup → create/post_server_create
//
// The server keeps the creation state in memory (foundry.new_server_info) between these
// calls: they must therefore follow each other, and only one server can be created at a time.
//
// Limits of this first version: no addons at creation time (Fabric API, Geyser,
// disabling chat reporting) and no imported world. Geyser is enabled afterwards from
// the server settings, mods from the Mods tab.

// Types that need the install step (Forge/NeoForge/Fabric/Quilt installer)
export const NEEDS_INSTALL = ['forge', 'neoforge', 'fabric', 'quilt'];

// Desktop defaults (foundry.new_server_init)
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
  // No addons at creation time, so these options are not announced to the server
  geyser_support: false,
  disable_chat_reporting: false,
  enable_proxy: false,
};

const randomHash = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');

// Dictionary sent to create/push_new_server. It replaces the whole new_server_info on the
// server: it must therefore contain every key expected by main (1.2.2) AND by
// ui-fixes (1.3.x) — `addon_objects` (list) for one, `addon_object` for the other.
export function buildServerInfo({ name, type, version, port = '25565', ip = '', settings = {} }) {
  return {
    _hash: randomHash(),
    _telepath_data: null,
    name: String(name).trim(),
    type,
    version: String(version).trim(),
    build: '',        // resolved by the server (search_version) in download_jar
    jar_link: '',
    ip,
    port: String(port),
    server_settings: { ...DEFAULT_SETTINGS, ...settings },
    addon_objects: [],
    addon_object: null,
    // Must NOT be null: generate_server_files calls acl_object.count_rules() and
    // reads its whitelist. A non-empty dict makes the server build an empty AclManager.
    acl_object: { rules: {} },
  };
}

const TYPE_LABEL = { forge: 'Forge', neoforge: 'NeoForge', fabric: 'Fabric', quilt: 'Quilt' };

export function buildSteps(type) {
  const steps = [
    { id: 'space',   label: 'Checking disk space' },
    { id: 'push',    label: 'Preparing' },
    { id: 'pre',     label: 'Initializing' },
    { id: 'java',    label: 'Checking Java' },
    { id: 'jar',     label: "Downloading 'server.jar'" },
  ];
  if (NEEDS_INSTALL.includes(type)) steps.push({ id: 'install', label: `Installing ${TYPE_LABEL[type]}` });
  steps.push(
    { id: 'files',   label: 'Configuring the server' },
    { id: 'backup',  label: 'Initial backup' },
    { id: 'post',    label: 'Finalizing' },
  );
  return steps;
}

// Timeouts (ms): the server only answers once the step is finished
const MIN = 60 * 1000;
const TIMEOUTS = { push: 30000, pre: 5 * MIN, java: 20 * MIN, jar: 20 * MIN, install: 20 * MIN, files: 10 * MIN, backup: 10 * MIN, post: 5 * MIN };

// Runs the creation. `service` = telepathService (checkFreeSpace + createCall).
// `onStep(index, status)` with status = 'running' | 'done' | 'error'.
export async function createServer(service, { name, type, version, port, settings }, onStep = () => {}) {
  const steps = buildSteps(type);
  const serverInfo = buildServerInfo({ name, type, version, port, settings });

  const run = {
    space: async () => {
      if ((await service.checkFreeSpace()) === false) {
        throw new Error('Not enough free disk space on the machine hosting auto-mcs.');
      }
    },
    push: () => service.createCall('create/push_new_server',
      { server_info: serverInfo, import_info: { name: null, path: null } }, TIMEOUTS.push),
    pre: () => service.createCall('create/pre_server_create', { telepath: true }, TIMEOUTS.pre),
    java: async () => {
      const ok = await service.createCall('main/java_check',
        { server_version: serverInfo.version, server_type: type }, TIMEOUTS.java);
      if (ok === false) throw new Error('Java could not be installed or verified.');
    },
    jar: async () => {
      const ok = await service.createCall('create/download_jar', { imported: false }, TIMEOUTS.jar);
      if (ok === false) {
        throw new Error("Could not download 'server.jar': version not found for this type, or the server has no Internet access.");
      }
    },
    install: async () => {
      const ok = await service.createCall('create/install_server', { imported: false }, TIMEOUTS.install);
      if (ok === false) throw new Error('The server installation failed.');
    },
    files: async () => {
      const ok = await service.createCall('create/generate_server_files', {}, TIMEOUTS.files);
      if (ok === false) throw new Error('Generating the server files failed.');
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
