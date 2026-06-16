import type { ActivityItem, Asset, BridgeNote } from "../types";

const notePrefix = "zeropath-note:";
const activityKey = "zeropath.activity";
const noteKey = "zeropath.notes";

const textEncoder = new TextEncoder();

export function shorten(value: string, lead = 6, tail = 4) {
  if (!value) return "";
  if (value.length <= lead + tail + 3) return value;
  return `${value.slice(0, lead)}...${value.slice(-tail)}`;
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function randomHex(bytes = 32) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function digestHex(input: string) {
  const bytes = await crypto.subtle.digest("SHA-256", textEncoder.encode(input));
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export async function buildNote(asset: Asset, amount: string, destination: string) {
  const createdAt = new Date().toISOString();
  const secret = randomHex();
  const nullifier = await digestHex(`${secret}:1`);
  const commitment = await digestHex(
    JSON.stringify({ secret, nullifier, amount, destination, asset })
  );

  const note: BridgeNote = {
    version: 1,
    asset,
    amount,
    destination,
    secret,
    nullifier,
    commitment,
    createdAt,
  };

  return {
    note,
    encoded: encodeNote(note),
  };
}

export function encodeNote(note: BridgeNote) {
  return `${notePrefix}${btoa(JSON.stringify(note))}`;
}

export function decodeNote(noteString: string): BridgeNote {
  const trimmed = noteString.trim();
  const payload = trimmed.startsWith(notePrefix)
    ? trimmed.slice(notePrefix.length)
    : trimmed;

  const parsed = JSON.parse(atob(payload)) as BridgeNote;
  if (parsed.version !== 1 || !parsed.secret || !parsed.nullifier || !parsed.commitment) {
    throw new Error("Invalid ZeroPath note");
  }
  return parsed;
}

export function loadActivity(): ActivityItem[] {
  try {
    const raw = localStorage.getItem(activityKey);
    return raw ? (JSON.parse(raw) as ActivityItem[]) : [];
  } catch {
    return [];
  }
}

export function saveActivity(items: ActivityItem[]) {
  localStorage.setItem(activityKey, JSON.stringify(items.slice(0, 40)));
}

export function prependActivity(item: ActivityItem) {
  const next = [item, ...loadActivity()];
  saveActivity(next);
  return next;
}

export function loadNotes(): BridgeNote[] {
  try {
    const raw = localStorage.getItem(noteKey);
    return raw ? (JSON.parse(raw) as BridgeNote[]) : [];
  } catch {
    return [];
  }
}

export function saveNote(note: BridgeNote) {
  const notes = loadNotes().filter((stored) => stored.commitment !== note.commitment);
  notes.unshift(note);
  localStorage.setItem(noteKey, JSON.stringify(notes.slice(0, 12)));
}

export function makeTxHash(prefix: "eth" | "stellar") {
  return `${prefix}_${randomHex(16)}`;
}
