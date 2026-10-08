import type { Action, Bindings, Settings } from "./types";

export const SETTINGS_KEY = "3tris-settings-v1";
export const SETTINGS_VERSION = 3;

export const DEFAULT_BINDINGS: Bindings = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  soft: ["ArrowDown", "KeyS"],
  hard: ["Space"],
  rotCCW: ["KeyZ"],
  rotCW: ["KeyX", "ArrowUp", "KeyW"],
  rot180: ["KeyQ"],
  hold: ["KeyC", "ShiftLeft", "ShiftRight"],
  restart: ["KeyR"],
  pause: ["Escape"],
};

export const DEFAULT_SETTINGS: Settings = {
  bindings: DEFAULT_BINDINGS,
  dasMs: 133,
  arrMs: 16,
  sdf: 32,
  sdfInf: false,
  fullscreen: false,
  screenShake: true,
  reducedMotion: false,
  ghostOpacity: 0.22,
  gridVisible: true,
  showNext: true,
  nextCount: 5,
  master: 0.8,
  music: 0.28,
  sfx: 0.72,
  palette: "standard",
};

export const HANDLING_PRESETS = [
  { id: "relaxed", label: "Relaxed", dasMs: 183, arrMs: 33, sdf: 16, sdfInf: false },
  { id: "current", label: "Current", dasMs: 133, arrMs: 16, sdf: 32, sdfInf: false },
  { id: "instant", label: "Instant", dasMs: 100, arrMs: 0, sdf: 40, sdfInf: true },
] as const;

export const ACTION_LABELS: Record<Action, string> = {
  left: "Move left",
  right: "Move right",
  soft: "Soft drop",
  hard: "Hard drop",
  rotCCW: "Rotate CCW",
  rotCW: "Rotate CW",
  hold: "Hold",
  restart: "Restart",
  pause: "Pause",
  rot180: "Rotate 180",
};

function mergeBindings(raw: unknown): Bindings {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_BINDINGS };
  (Object.keys(DEFAULT_BINDINGS) as Action[]).forEach((k) => {
    const v = src[k];
    if (Array.isArray(v) && v.every((c) => typeof c === "string")) {
      out[k] = v as string[];
    }
  });
  return out;
}

type StoredSettings = Partial<Settings> & { version?: number };

function migrate(parsed: StoredSettings): Settings {
  const version = typeof parsed.version === "number" ? parsed.version : 1;
  const rest: Partial<Settings> = { ...parsed };
  delete (rest as StoredSettings).version;
  const merged: Settings = {
    ...DEFAULT_SETTINGS,
    ...rest,
    bindings: mergeBindings(parsed.bindings),
  };
  // v1 shipped DAS 110 / ARR 0 (sonic). A held direction teleported the
  // piece to the wall. Promote those exact stock values to the new handling.
  if (version < 2) {
    if (parsed.arrMs === 0 || parsed.arrMs == null) merged.arrMs = DEFAULT_SETTINGS.arrMs;
    if (parsed.dasMs === 110 || parsed.dasMs == null) merged.dasMs = DEFAULT_SETTINGS.dasMs;
  }
  if (!merged.palette) merged.palette = "standard";
  if (version < 3) merged.bindings = appendMissingDefaults(merged.bindings);
  return merged;
}

function appendMissingDefaults(bindings: Bindings): Bindings {
  const used = new Set<string>();
  (Object.keys(bindings) as Action[]).forEach((k) => bindings[k].forEach((c) => used.add(c)));
  const out: Bindings = { ...bindings };
  (Object.keys(DEFAULT_BINDINGS) as Action[]).forEach((k) => {
    const have = new Set(out[k] ?? []);
    const extra = DEFAULT_BINDINGS[k].filter((c) => !have.has(c) && !used.has(c));
    extra.forEach((c) => used.add(c));
    out[k] = [...(out[k] ?? []), ...extra];
  });
  return out;
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS } };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS } };
    const parsed = JSON.parse(raw) as StoredSettings;
    const merged = migrate(parsed);
    const version = typeof parsed.version === "number" ? parsed.version : 1;
    if (version < SETTINGS_VERSION) saveSettings(merged);
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS } };
  }
}

export function saveSettings(s: Settings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, version: SETTINGS_VERSION }));
  } catch {
    /* private mode / quota */
  }
}

export function codeLabel(code: string): string {
  const map: Record<string, string> = {
    ArrowLeft: "←",
    ArrowRight: "→",
    ArrowDown: "↓",
    ArrowUp: "↑",
    Space: "SPACE",
    ShiftLeft: "SHIFT",
    ShiftRight: "RSHIFT",
    ControlLeft: "CTRL",
    ControlRight: "RCTRL",
    AltLeft: "ALT",
    AltRight: "RALT",
    MetaLeft: "META",
    MetaRight: "RMETA",
    Enter: "ENTER",
    Escape: "ESC",
    Tab: "TAB",
    Backspace: "BKSP",
    Minus: "−",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Semicolon: ";",
    Quote: "'",
    Backquote: "`",
    Backslash: "\\",
    Comma: ",",
    Period: ".",
    Slash: "/",
  };
  if (map[code]) return map[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code.replace(/^Numpad/, "N").toUpperCase();
}

export function codesLabel(codes: string[]): string {
  return codes.map(codeLabel).join("  /  ");
}
