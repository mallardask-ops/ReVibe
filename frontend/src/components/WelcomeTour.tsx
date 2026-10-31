import * as React from "react";
import { FolderOpen, Keyboard, MessageSquareText, X } from "lucide-react";

const KEY = "vibedeck.tour-done";
const STEPS = [
  { icon: FolderOpen, title: "Pick a project", body: "Choose the folder under the message box. Vibe works in it, and you can start in a separate worktree for risky changes." },
  { icon: MessageSquareText, title: "Say what you want", body: "Plain words are enough. Start with / for commands or ! to run a shell command yourself. You can keep typing while Vibe works; messages queue up." },
  { icon: Keyboard, title: "Review and steer", body: "Changes shows every edit, ready to keep or undo. Any of your messages can rewind or fork the conversation. Press ? for shortcuts." },
];

/** Three short cards for someone opening ReVibe for the first time; never shown again once closed. */
export function WelcomeTour() {
  const [step, setStep] = React.useState<number | null>(() => {
    try { return localStorage.getItem(KEY) ? null : 0; } catch { return null; }
  });
  if (step === null) return null;
  const done = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* storage unavailable */ }
    setStep(null);
  };
  const s = STEPS[step];
  return (
    <section aria-label="Getting started" className="vd-reveal mx-5 mt-4 rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgb(0_0_0/0.12)]">
      <div className="flex items-start gap-3">
        <s.icon size={18} className="mt-0.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-text">{s.title}</h2>
          <p className="mt-1 text-sm text-text-muted">{s.body}</p>
        </div>
        <button type="button" onClick={done} aria-label="Close the tour" title="Close"
          className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-faint transition-colors hover:bg-surface-muted hover:text-text">
          <X size={14} />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-4 bg-primary" : "w-1.5 bg-border-strong"}`} />)}
        </div>
        <div className="flex-1" />
        {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="h-7 rounded-md px-2.5 text-xs text-text-muted transition-colors hover:bg-surface-muted hover:text-text">Back</button>}
        <button type="button" onClick={() => (step + 1 < STEPS.length ? setStep(step + 1) : done())}
          className="vd-send h-7 rounded-md px-3 text-xs font-medium">
          {step + 1 < STEPS.length ? "Next" : "Start"}
        </button>
      </div>
    </section>
  );
}
