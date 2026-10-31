/**
 * Alerts for a run that finished, a run that failed, and Vibe asking for the
 * user: a sound from the system's sound theme and a desktop notification,
 * each switchable per event. Preferences are per viewer, in localStorage.
 */
import * as React from "react";
import { notificationsEnabled, notificationsSupported } from "./notifications";

export type AlertEvent = "done" | "failed" | "attention";

export const ALERT_EVENTS: { id: AlertEvent; label: string; hint: string }[] = [
  { id: "done", label: "Run finished", hint: "Vibe finished working on your request." },
  { id: "failed", label: "Run failed", hint: "A run stopped with an error." },
  { id: "attention", label: "Needs you", hint: "An approval or a question is waiting." },
];

export interface AlertPrefs {
  /** sound theme id from /api/sounds, or "off" */
  theme: string;
  volume: number;
  sound: Record<AlertEvent, boolean>;
  notify: Record<AlertEvent, boolean>;
  /** play sounds while VibeDeck is the focused window too */
  soundWhenFocused: boolean;
}

const KEY = "vibedeck.alerts";
const DEFAULTS: AlertPrefs = {
  theme: "ocean", volume: 0.6,
  sound: { done: true, failed: true, attention: true },
  notify: { done: true, failed: true, attention: true },
  soundWhenFocused: true,
};

let prefs: AlertPrefs = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved) return { ...DEFAULTS, ...saved, sound: { ...DEFAULTS.sound, ...saved.sound }, notify: { ...DEFAULTS.notify, ...saved.notify } };
  } catch { /* storage unavailable */ }
  return DEFAULTS;
})();
const listeners = new Set<() => void>();

export function setAlertPrefs(next: AlertPrefs): void {
  prefs = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  listeners.forEach(l => l());
}

export const useAlertPrefs = () => React.useSyncExternalStore(
  l => { listeners.add(l); return () => { listeners.delete(l); }; }, () => prefs);

export interface SoundTheme { id: string; name: string; description: string; events: AlertEvent[] }

let themes: Promise<SoundTheme[]> | null = null;
export function getSoundThemes(): Promise<SoundTheme[]> {
  themes ??= fetch("/api/sounds").then(r => (r.ok ? r.json() : { themes: [] })).then(d => d.themes as SoundTheme[]).catch(() => []);
  return themes;
}

/** Play one event's sound with the chosen theme (or a given one, for previews). */
export async function playSound(event: AlertEvent, theme = prefs.theme, volume = prefs.volume): Promise<void> {
  if (theme === "off") return;
  // fall back to an installed theme when the chosen one is missing
  const installed = await getSoundThemes();
  const use = installed.find(t => t.id === theme) ?? installed[0];
  if (!use?.events.includes(event)) return;
  try {
    const audio = new Audio(`/api/sounds/${use.id}/${event}`);
    audio.volume = Math.min(1, Math.max(0, volume));
    await audio.play();
  } catch { /* autoplay blocked or no audio device */ }
}

/**
 * Sound and notification for an event. The notification shows only while
 * VibeDeck is in the background; clicking it opens the session.
 */
export function alert(event: AlertEvent, message: { title: string; body?: string; sessionId?: string }): void {
  const focused = document.hasFocus();
  if (prefs.sound[event] && (prefs.soundWhenFocused || !focused)) void playSound(event);
  if (focused || !prefs.notify[event] || !notificationsEnabled()) return;
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    // one notification per session and event replaces the previous one
    const n = new Notification(message.title, {
      body: message.body, silent: true, tag: message.sessionId ? `${message.sessionId}:${event}` : undefined,
    });
    n.onclick = () => {
      window.focus();
      if (message.sessionId) window.dispatchEvent(new CustomEvent("vibedeck:navigate", { detail: `/sessions/${message.sessionId}` }));
      n.close();
    };
  } catch { /* notifications are best-effort */ }
}

/** The first line of a reply, short enough for a notification. */
export function excerpt(text: string, max = 140): string {
  const line = text.replace(/[`*_#>]/g, "").split("\n").map(l => l.trim()).find(Boolean) || "";
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
