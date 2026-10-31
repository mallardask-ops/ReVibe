import * as React from "react";
import { Dialog } from "./ui";

const mod = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform) ? "⌘" : "Ctrl";

export const SHORTCUTS: { group: string; items: [string[], string][] }[] = [
  { group: "Anywhere", items: [
    [[mod, "K"], "Command palette"],
    [[mod, "Shift", "O"], "New session"],
    [[mod, "B"], "Show or hide the sidebar"],
    [[mod, "Shift", "L"], "Switch between Work and Code"],
    [[mod, ","], "Settings"],
    [["?"], "This list"],
  ] },
  { group: "In a conversation", items: [
    [["Enter"], "Send, or queue while Vibe works"],
    [["Shift", "Enter"], "New line"],
    [["/"], "Commands, in an empty message box"],
    [["!"], "Run a shell command, at the start of a message"],
    [[mod, "."], "Stop the run"],
    [["Alt", "↑"], "Previous message of yours"],
    [["Alt", "↓"], "Next message of yours"],
  ] },
];

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

/**
 * App-wide keyboard shortcuts and the "?" list of them. Actions that need the
 * shell's state are passed in; the open conversation handles its own.
 */
export function Shortcuts({ onNewSession, onToggleSidebar, onSwitchLane, onSettings }: {
  onNewSession: () => void; onToggleSidebar: () => void; onSwitchLane: () => void; onSettings: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (m && e.shiftKey && key === "o") { e.preventDefault(); onNewSession(); }
      else if (m && !e.shiftKey && key === "b") { e.preventDefault(); onToggleSidebar(); }
      else if (m && e.shiftKey && key === "l") { e.preventDefault(); onSwitchLane(); }
      else if (m && key === ",") { e.preventDefault(); onSettings(); }
      else if (e.key === "?" && !m && !e.altKey && !typing(e.target)) { e.preventDefault(); setOpen(o => !o); }
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNewSession, onToggleSidebar, onSwitchLane, onSettings]);
  React.useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("vibedeck:shortcuts", show);
    return () => window.removeEventListener("vibedeck:shortcuts", show);
  }, []);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts" className="max-w-2xl">
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {SHORTCUTS.map(g => (
          <section key={g.group}>
            <h3 className="mb-2 text-xs font-medium text-text-faint">{g.group}</h3>
            <dl className="space-y-1.5">
              {g.items.map(([keys, label]) => (
                <div key={label} className="flex items-center justify-between gap-3 text-sm">
                  <dt className="text-text-muted">{label}</dt>
                  <dd className="flex shrink-0 gap-1">
                    {keys.map(k => <kbd key={k} className="min-w-[22px] rounded border border-border bg-surface-muted px-1.5 py-0.5 text-center font-mono text-[11px] text-text">{k}</kbd>)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
