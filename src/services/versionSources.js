// Minecraft version lists per server type, fetched from the phone
// (like the desktop app does: foundry.find_latest_mc / validate_version).
//
// Same sources as the desktop when they return JSON (Paper, Purpur,
// Fabric, Quilt, NeoForge, Spigot/CraftBukkit). The desktop reads HTML pages for
// Vanilla (mcversions.net) and Forge; here their official JSON equivalents are used
// (Mojang manifest, Forge promotions_slim.json), which are more reliable to parse.
//
// An unavailable list never blocks anything: the create screen keeps a free text field,
// and the server itself validates the type + version when downloading the jar.

export const SERVER_TYPES = [
  { id: 'vanilla',     label: 'Vanilla' },
  { id: 'paper',       label: 'Paper' },
  { id: 'purpur',      label: 'Purpur' },
  { id: 'spigot',      label: 'Spigot' },
  { id: 'craftbukkit', label: 'CraftBukkit' },
  { id: 'fabric',      label: 'Fabric' },
  { id: 'quilt',       label: 'Quilt' },
  { id: 'forge',       label: 'Forge' },
  { id: 'neoforge',    label: 'NeoForge' },
];

export const SOURCES = {
  vanilla:     'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json',
  paper:       'https://fill.papermc.io/v3/projects/paper',
  purpur:      'https://api.purpurmc.org/v2/purpur',
  spigot:      'https://getbukkit.org/api/jars/spigot/latest',
  craftbukkit: 'https://getbukkit.org/api/jars/craftbukkit/latest',
  fabric:      'https://meta.fabricmc.net/v2/versions/game',
  quilt:       'https://meta.quiltmc.org/v3/versions/game',
  forge:       'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json',
  neoforge:    'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge',
};

const TIMEOUT_MS = 15000;

// Compares two versions like "1.20.4" (ascending order), used to sort Forge
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

const unique = list => [...new Set(list)];

// NeoForge version "21.1.5" -> Minecraft version "1.21.1" (same rule as the desktop;
// "1.21.0" and "1.21" are equivalent for the server, "1.21" is displayed).
export function neoforgeToMinecraft(version) {
  const v = String(version).split('.');
  let mc;
  if (parseInt(v[0], 10) >= 26) {
    const parts = v.slice(0, -1);
    if (parts[parts.length - 1] === '0') parts.pop();
    mc = parts.join('.');
  } else {
    mc = `1.${v.slice(0, 2).join('.')}`;
  }
  return mc.replace(/\.0$/, '');
}

// Each parser returns Minecraft versions, from newest to oldest
export const parsers = {
  // Mojang manifest: already sorted newest to oldest, only keep "release" entries
  vanilla: data => (data?.versions || []).filter(v => v.type === 'release').map(v => v.id),

  // Paper: { versions: { "1.21": ["1.21.4", ...], "1.20": [...] } } (newest groups first).
  // The desktop ignores versions containing "-" (pre-releases, release candidates).
  paper: data => Object.values(data?.versions || {}).flat().filter(v => !String(v).includes('-')),

  // Purpur : { versions: ["1.14.1", ..., "1.21.4"] } (ordre croissant)
  purpur: data => [...(data?.versions || [])].reverse(),

  // Fabric / Quilt: [{ version, stable }, ...] (newest first), stable ones only
  fabric: data => (Array.isArray(data) ? data : []).filter(i => i.stable).map(i => i.version),
  quilt:  data => (Array.isArray(data) ? data : []).filter(i => i.stable).map(i => i.version),

  // NeoForge : { versions: ["20.2.1-beta", ..., "21.1.5"] } (ordre croissant)
  neoforge: data => unique(
    [...(data?.versions || [])]
      .reverse()
      .filter(v => !/beta|alpha|snapshot/i.test(v))
      .map(neoforgeToMinecraft)
  ),

  // Forge : { promos: { "1.20.1-recommended": "47.2.0", "1.20.1-latest": "47.3.0", ... } }
  forge: data => unique(
    Object.keys(data?.promos || {})
      .map(k => /^(\d+(?:\.\d+)+)-(?:recommended|latest)$/.exec(k)?.[1])
      .filter(Boolean)
  ).sort((a, b) => compareVersions(b, a)),

  // Spigot / CraftBukkit: only the latest version is exposed { version: "1.21.4" }
  spigot:      data => (data?.version ? [String(data.version)] : []),
  craftbukkit: data => (data?.version ? [String(data.version)] : []),
};

async function getJson(url, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Available versions for a type, newest to oldest (empty list if not found)
export async function fetchVersions(type, fetchImpl = fetch) {
  const url = SOURCES[type];
  const parse = parsers[type];
  if (!url || !parse) throw new Error(`Unknown server type: ${type}`);
  const list = parse(await getJson(url, fetchImpl));
  return unique(list.map(String));
}
