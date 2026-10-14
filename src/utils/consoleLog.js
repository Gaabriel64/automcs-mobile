// Rendu de la console, identique à celui d'auto-mcs (desktop).
//
// Sources côté auto-mcs :
//  - ServerObject.update_log (source/core/server/manager.py) : chaque ligne du
//    journal est envoyée sous la forme { text: [heure, TYPE, message, [r,g,b,a]] }
//    (couleurs en flottants 0..1, comme dans Kivy).
//  - views/server/manager/console.py : le message prend la couleur du type ;
//    l'heure et le type sont dans des pastilles (fond = couleur éclaircie de
//    -0.2 pour l'heure, couleur du type pour le type, texte = couleur - 0.65).
//  - Les codes de couleur Minecraft (§a, §c…) sont déjà convertis par le serveur
//    en balises Kivy [color=#RRGGBB]…[/color] ; les caractères [ ] & du message
//    sont échappés (&bl; &br; &amp;), voir kivy.utils.escape_markup.

// Couleurs par type quand le serveur n'envoie pas la couleur (valeurs de update_log)
export const TYPE_COLORS = {
  INFO:   [0.6, 0.6, 1, 1],
  CHAT:   [0.439, 0.839, 1, 1],
  PLAYER: [0.953, 0.929, 0.38, 1],
  WARN:   [1, 0.804, 0.42, 1],
  ERROR:  [1, 0.5, 0.65, 1],
  CRIT:   [1, 0.5, 0.65, 1],
  SEVERE: [1, 0.5, 0.65, 1],
  FATAL:  [1, 0.5, 0.65, 1],
  EXEC:   [1, 0.298, 0.6, 1],
  START:  [0.3, 1, 0.6, 1],
  STOP:   [0.3, 1, 0.6, 1],
};

const clamp01 = (v) => (v > 1 ? 1 : v < 0 ? 0 : v);

// Équivalent de constants.brighten_color : décalage additif par canal RGB (alpha inchangé)
export function brighten(color, amount) {
  const [r, g, b, a = 1] = color;
  return [clamp01(r + amount), clamp01(g + amount), clamp01(b + amount), a];
}

export function toCss(color) {
  const [r, g, b, a = 1] = color;
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
}

function decodeEntities(text) {
  return text.replace(/&bl;/g, '[').replace(/&br;/g, ']').replace(/&amp;/g, '&');
}

// Transforme un message avec balises Kivy en segments { text, color|null }.
// Le serveur n'équilibre pas toujours les balises (une balise ouvrante par code §),
// on utilise donc une pile et on ignore ce qui reste ouvert à la fin.
export function parseMarkup(message) {
  const source = String(message ?? '');
  const segments = [];
  const stack = [];
  const re = /\[color=(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\]|\[\/color\]/g;
  let last = 0;
  let m;

  const push = (raw) => {
    if (!raw) return;
    // Retire les codes § résiduels (non convertis par le serveur) pour l'affichage
    const text = decodeEntities(raw).replace(/§[0-9a-fk-or]/gi, '');
    if (text) segments.push({ text, color: stack.length ? stack[stack.length - 1] : null });
  };

  while ((m = re.exec(source)) !== null) {
    push(source.slice(last, m.index));
    if (m[1]) stack.push(m[1]);
    else stack.pop();
    last = re.lastIndex;
  }
  push(source.slice(last));

  return segments.length ? segments : [{ text: '', color: null }];
}

// Normalise une entrée de run_data.log
export function parseLogEntry(entry) {
  const t = entry && typeof entry === 'object' && 'text' in entry ? entry.text : entry;

  if (Array.isArray(t) && t.length >= 3) {
    const type = String(t[1] ?? 'INFO').toUpperCase();
    const color = Array.isArray(t[3]) && t[3].length >= 3 ? t[3] : (TYPE_COLORS[type] || TYPE_COLORS.INFO);
    const message = String(t[2] ?? '');
    return { time: String(t[0] ?? '').trim(), type, color, message, segments: parseMarkup(message) };
  }

  const message = typeof t === 'string' ? t : JSON.stringify(entry);
  return { time: '', type: 'INFO', color: TYPE_COLORS.INFO, message, segments: parseMarkup(message) };
}

// Ligne locale (écho de commande, erreur réseau…)
export function makeLocalLine(type, message) {
  const color = TYPE_COLORS[type] || TYPE_COLORS.INFO;
  return { time: '', type, color, message, segments: [{ text: message, color: null }] };
}

// Signature d'une entrée (heure + type + message)
export function entrySignature(entry) {
  const t = entry && typeof entry === 'object' && 'text' in entry ? entry.text : entry;
  if (Array.isArray(t)) return `${t[0]}|${t[1]}|${t[2]}`;
  return typeof t === 'string' ? t : JSON.stringify(entry);
}

// Le serveur garde au plus 2000 lignes (max_log_size) et supprime les plus
// anciennes : les index se décalent à chaque nouvelle ligne, on ne peut donc pas
// dédoublonner avec l'index. On cherche à la place où se termine la fin de la
// liste déjà affichée à l'intérieur de la liste reçue.
//
// Retourne l'index de la première nouvelle entrée, ou -1 si les deux listes ne se
// recoupent pas (journal remis à zéro, serveur relancé…) : il faut alors tout réafficher.
export function findNewStart(prevSigs, curSigs) {
  if (!prevSigs.length) return 0;

  const tryTail = (tail) => {
    const k = tail.length;
    if (!k) return -1;
    for (let end = curSigs.length; end >= k; end--) {
      let ok = true;
      for (let i = 0; i < k; i++) {
        if (curSigs[end - k + i] !== tail[i]) { ok = false; break; }
      }
      if (ok) return end;
    }
    return -1;
  };

  const K = Math.min(prevSigs.length, 10);
  let end = tryTail(prevSigs.slice(-K));
  // La dernière ligne peut avoir été modifiée sur place (barre « Preparing spawn area »)
  if (end === -1 && prevSigs.length > 1) end = tryTail(prevSigs.slice(-K - 1, -1));
  return end;
}
