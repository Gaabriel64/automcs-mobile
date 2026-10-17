// Console rendering, identical to the auto-mcs desktop one.
//
// Sources on the auto-mcs side:
//  - ServerObject.update_log (source/core/server/manager.py): every log line is sent
//    as { text: [time, TYPE, message, [r,g,b,a]] }
//    (colors as floats 0..1, like in Kivy).
//  - views/server/manager/console.py: the message takes the type color;
//    time and type are drawn in pills (background = type color brightened by
//    -0.2 for the time, type color for the type, text = color - 0.65).
//  - Minecraft color codes (§a, §c...) are already converted by the server
//    into Kivy tags [color=#RRGGBB]...[/color]; the characters [ ] & of the message
//    are escaped (&bl; &br; &amp;), see kivy.utils.escape_markup.

// Colors per type when the server does not send the color (values from update_log)
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

// Equivalent of constants.brighten_color: additive shift per RGB channel (alpha unchanged)
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

// Turns a message with Kivy tags into segments { text, color|null }.
// The server does not always balance tags (one opening tag per § code),
// so a stack is used and whatever stays open at the end is ignored.
export function parseMarkup(message) {
  const source = String(message ?? '');
  const segments = [];
  const stack = [];
  const re = /\[color=(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\]|\[\/color\]/g;
  let last = 0;
  let m;

  const push = (raw) => {
    if (!raw) return;
    // Remove leftover § codes (not converted by the server) for display
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

// Normalizes an entry of run_data.log
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

// Local line (command echo, network error...)
export function makeLocalLine(type, message) {
  const color = TYPE_COLORS[type] || TYPE_COLORS.INFO;
  return { time: '', type, color, message, segments: [{ text: message, color: null }] };
}

// Signature of an entry (time + type + message)
export function entrySignature(entry) {
  const t = entry && typeof entry === 'object' && 'text' in entry ? entry.text : entry;
  if (Array.isArray(t)) return `${t[0]}|${t[1]}|${t[2]}`;
  return typeof t === 'string' ? t : JSON.stringify(entry);
}

// The server keeps at most 2000 lines (max_log_size) and drops the oldest ones:
// indexes shift with every new line, so the index cannot be used to deduplicate.
// Instead, look for where the end of the already displayed list sits inside the
// received list.
//
// Returns the index of the first new entry, or -1 if the two lists do not overlap
// (log reset, server restarted...): everything must then be displayed again.
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
  // The last line may have been modified in place ("Preparing spawn area" bar)
  if (end === -1 && prevSigs.length > 1) end = tryTail(prevSigs.slice(-K - 1, -1));
  return end;
}
