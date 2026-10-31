import * as React from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import {
  getApiKeyStatus, patchConfig, removeApiKey, setApiKey,
  listSessions, deleteSession, getSubagentSettings, saveSubagentSettings, type SubagentSettings,
} from "@/lib/api";
import { Select, Badge, Button, Input } from "@/components/ui";
import { useVibeModels } from "@/components/Pickers";
import { ProvidersSection } from "@/components/ProvidersSection";
import { VibeReleaseNotes } from "@/components/VibeReleaseNotes";
import { WorktreesCard } from "@/components/WorktreesCard";
import { THEMES, getTheme, setTheme, type ThemeId } from "@/lib/theme";
import { BACKDROPS, setBackdrop, useBackdrop } from "@/lib/backdrop";
import { ALERT_EVENTS, getSoundThemes, playSound, setAlertPrefs, useAlertPrefs, type AlertPrefs, type SoundTheme } from "@/lib/alerts";
import {
  notificationsEnabled, setNotificationsEnabled, notificationsSupported,
} from "@/lib/notifications";
import {
  Bell, Bot, Boxes, Check, Info, Monitor, Palette, Play, Plug, SlidersHorizontal,
} from "lucide-react";
import { cn, modelLabel } from "@/lib/utils";
import type { ApiKeyStatus } from "@/lib/types";
import type { DesktopSettings } from "@/lib/windowControls";

const AGENTS = [
  { value: "ask", label: "Ask: asks before actions that need approval" },
  { value: "plan", label: "Plan: reads and plans, no edits" },
  { value: "accept-edits", label: "Accept edits: edits freely, asks for risky commands" },
  { value: "auto-approve", label: "Full auto: approves every tool action" },
];
const REASONING = [
  { value: "", label: "Model default" }, { value: "off", label: "Off" }, { value: "low", label: "Low" },
  { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "max", label: "Max" },
];

// Sections in the order people reach for them: everyday defaults and looks
// first, accounts and models next, then the machine and the app itself.
const SECTIONS = [
  { id: "general", label: "General", icon: SlidersHorizontal, description: "What new conversations start with." },
  { id: "appearance", label: "Appearance", icon: Palette, description: "Theme, background and size." },
  { id: "notifications", label: "Notifications", icon: Bell, description: "Sounds and desktop alerts for your runs." },
  { id: "providers", label: "Providers", icon: Plug, description: "Connect AI services and manage credentials." },
  { id: "models", label: "Models", icon: Boxes, description: "Models from connected providers." },
  { id: "agents", label: "Agents", icon: Bot, description: "Subagents, skills and connections." },
  { id: "desktop", label: "Desktop", icon: Monitor, description: "The window, the tray and worktrees on disk." },
  { id: "about", label: "About", icon: Info, description: "Versions, privacy and data." },
] as const;
type SectionId = typeof SECTIONS[number]["id"];

function keyStatusLabel(s: ApiKeyStatus | null): { text: string; tone: "success" | "warning" | "danger" } {
  if (!s) return { text: "…", tone: "warning" };
  if (s.present) return { text: "Key available", tone: "success" };
  return { text: "Not configured", tone: s.source === "disabled" ? "warning" : "danger" };
}

function keySourceLabel(source: ApiKeyStatus["source"]): string {
  switch (source) {
    case "env": return "environment";
    case "keyring": return "system keyring";
    case "file": return "saved file";
    default: return "";
  }
}

// ---------------------------------------------------------------- layout

/** A titled block of settings; rows inside are separated by hairlines. */
function Group({ title, description, children, className }: {
  title: string; description?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface", className)}>
      <header className="px-4 pt-3.5 pb-2">
        <h4 className="text-sm font-medium text-text">{title}</h4>
        {description && <p className="mt-0.5 text-xs text-text-faint">{description}</p>}
      </header>
      <div className="divide-y divide-border border-t border-border">{children}</div>
    </section>
  );
}

/** One setting: its name and a line of help on the left, the control on the right (or below when wide). */
function Field({ label, hint, children, stacked = false }: {
  label: string; hint?: React.ReactNode; children: React.ReactNode; stacked?: boolean;
}) {
  return (
    <div className={cn("px-4 py-3", stacked ? "space-y-2.5" : "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6")}>
      <div className="min-w-0">
        <div className="text-sm text-text">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-text-faint">{hint}</div>}
      </div>
      <div className={cn(stacked ? "" : "shrink-0 sm:w-72 sm:flex sm:justify-end")}>{children}</div>
    </div>
  );
}

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40", on ? "bg-primary" : "bg-surface-muted")}>
      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

/** A row of choices shown as chips. */
function Chips<T extends string>({ value, options, onChange, label }: {
  value: T; options: { id: T; name: string; description?: string }[]; onChange: (id: T) => void; label: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} title={o.description}
          onClick={() => onChange(o.id)}
          className={cn("inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs transition-colors",
            value === o.id ? "border-primary text-text ring-1 ring-primary" : "border-border text-text-muted hover:border-border-strong hover:text-text")}>
          {o.name}
          {value === o.id && <Check size={11} className="text-primary" />}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- page

export function SettingsView() {
  const { health, config } = useOutletContext<any>();
  const [params] = useSearchParams();
  const asked = params.get("section");
  // "config" was the old name of the general section
  const section: SectionId = asked === "config" ? "general" : SECTIONS.some(s => s.id === asked) ? asked as SectionId : "general";
  const current = SECTIONS.find(s => s.id === section)!;
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [section]);

  return (
    <div className="h-full flex flex-col settings-page">
      <header className="shrink-0 border-b border-border px-6 py-5">
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-text-muted mt-1">Make ReVibe work the way you do.</p>
      </header>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-5 py-6 lg:px-8 lg:py-8 grid grid-cols-1 lg:grid-cols-[184px_minmax(0,1fr)] gap-6 lg:gap-10">
          <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:flex-col lg:self-start lg:sticky lg:top-8">
            {SECTIONS.map(item => (
              <Link key={item.id} to={`/settings?section=${item.id}`} aria-current={section === item.id ? "page" : undefined}
                className={cn("flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary",
                  section === item.id ? "bg-surface-muted text-text font-medium" : "text-text-muted hover:text-text hover:bg-surface-muted/60")}>
                <item.icon size={16} />{item.label}
              </Link>
            ))}
          </nav>
          <section className="min-w-0 space-y-5" aria-label={`${current.label} settings`}>
            <div>
              <h3 className="text-base font-semibold">{current.label}</h3>
              <p className="mt-1 text-sm text-text-muted">{current.description}</p>
            </div>
            {section === "general" && <GeneralSection config={config} />}
            {section === "appearance" && <AppearanceSection />}
            {section === "notifications" && <NotificationsSection />}
            {section === "providers" && <><ProvidersSection mode="providers" /><StudioKey /></>}
            {section === "models" && <ProvidersSection mode="models" />}
            {section === "agents" && <AgentsSection />}
            {section === "desktop" && <DesktopSection />}
            {section === "about" && <AboutSection health={health} />}
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- general

/** Defaults for new conversations; each change saves on its own. */
function GeneralSection({ config }: { config: any }) {
  const { models } = useVibeModels();
  const [values, setValues] = React.useState({ model: "mistral-large-4", agent: "accept-edits", reasoning: "" });
  const [status, setStatus] = React.useState<{ field: string; error?: string } | null>(null);
  React.useEffect(() => {
    if (config) setValues({ model: config.defaultModel, agent: config.defaultAgent, reasoning: config.defaultReasoning || "" });
  }, [config]);
  const save = async (field: "model" | "agent" | "reasoning", value: string) => {
    setValues(v => ({ ...v, [field]: value }));
    try {
      await patchConfig(field === "model" ? { defaultModel: value } : field === "agent" ? { defaultAgent: value } : { defaultReasoning: value || null });
      window.dispatchEvent(new Event("vibedeck:config"));
      setStatus({ field });
      window.setTimeout(() => setStatus(s => (s?.field === field && !s.error ? null : s)), 1600);
    } catch (e) { setStatus({ field, error: String(e) }); }
  };
  const note = (field: string) => status?.field === field
    ? status.error ? <span role="alert" className="text-danger">{status.error}</span> : <span className="text-success">Saved</span>
    : null;
  const modelOptions = models.length
    ? models.map(m => ({ value: m.id, label: modelLabel(m.id, m.name) }))
    : [{ value: values.model, label: modelLabel(values.model) }];
  return (
    <>
      <Group title="New conversations" description="Any of these can be changed inside a conversation.">
        <Field label="Start in" hint="The lane ReVibe opens with.">
          <DefaultLaneSelect />
        </Field>
        <Field label="Model" hint={note("model") || "Any registered model can be picked per session."}>
          <Select aria-label="Default model" value={values.model} onChange={v => void save("model", v)} options={modelOptions} className="w-full" />
        </Field>
        <Field label="Agent mode" hint={note("agent") || "For Code sessions. Work sessions start in Ask."}>
          <Select aria-label="Default agent mode" value={values.agent} onChange={v => void save("agent", v)} options={AGENTS} className="w-full" />
        </Field>
        <Field label="Thinking" hint={note("reasoning") || "How long the model reasons before answering."}>
          <Select aria-label="Default reasoning" value={values.reasoning} onChange={v => void save("reasoning", v)} options={REASONING} className="w-full" />
        </Field>
      </Group>
    </>
  );
}

function DefaultLaneSelect() {
  const [lane, setLane] = React.useState<string>(
    () => localStorage.getItem("vibedeck.lane") || "code");
  const change = (v: string) => {
    setLane(v);
    try { localStorage.setItem("vibedeck.lane", v); } catch { /* ignore */ }
    // AppShell listens and switches the live lane
    window.dispatchEvent(new CustomEvent("vibedeck:lane", { detail: v }));
  };
  return (
    <Select
      aria-label="Default lane"
      value={lane}
      onChange={change}
      options={[
        { value: "code", label: "Code: build and edit with tools" },
        { value: "work", label: "Work: ask anything, quick answers" },
      ]}
      className="w-full"
    />
  );
}

// ---------------------------------------------------------------- appearance

function AppearanceSection() {
  const background = useBackdrop();
  return (
    <Group title="Look and feel">
      <Field label="Theme" stacked><ThemePicker /></Field>
      <Field label="Background" stacked
        hint="Animated, behind the app. It calms down once a chat has messages and livens up while the model works.">
        <Chips label="Background" value={background} onChange={setBackdrop}
          options={BACKDROPS.map(b => ({ id: b.id, name: b.name, description: b.description }))} />
      </Field>
      <Field label="App zoom" hint="Scales the window and embedded pages. Kept for the next launch."><ZoomControl /></Field>
    </Group>
  );
}

function ThemePicker() {
  const [theme, setThemeState] = React.useState<ThemeId>(getTheme());
  const pick = (id: ThemeId) => {
    setTheme(id);
    setThemeState(id);
  };
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {THEMES.map((t) => {
        const active = t.id === theme;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t.id)}
            title={t.description}
            aria-pressed={active}
            className={cn(
              "relative rounded-lg border p-2.5 text-left transition-colors",
              active ? "border-primary ring-1 ring-primary" : "border-border hover:border-border-strong",
            )}
          >
            <span
              className="block h-9 rounded-md border border-black/10 dark:border-white/10 mb-2"
              style={{
                background: `linear-gradient(135deg, ${t.swatch.bg} 55%, ${t.swatch.surface} 55%)`,
              }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full ml-1.5 mt-1.5"
                style={{ background: t.swatch.primary }}
              />
            </span>
            <span className="flex items-center gap-1 text-xs text-text">
              {t.name}
              {active && <Check size={11} className="text-primary shrink-0" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ZoomControl() {
  const desktop = window.vibedeck;
  const [factor, setFactor] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => { void desktop?.getZoom().then(setFactor).catch(() => setError("Could not read zoom settings.")); }, [desktop]);
  const change = async (value: string) => {
    if (!desktop || busy) return;
    setBusy(true); setError("");
    try { setFactor(await desktop.setZoom(Number(value))); }
    catch { setError("Could not save zoom. Try again."); }
    finally { setBusy(false); }
  };
  return <div className="w-full">
    <Select aria-label="App zoom" className="w-full" disabled={!desktop || busy} value={String(factor)} onChange={value => void change(value)}
      options={[.75, .9, 1, 1.1, 1.25, 1.5].map(value => ({ value: String(value), label: `${Math.round(value * 100)}%${value === 1 ? " (default)" : ""}` }))} />
    {!desktop && <p className="mt-1 text-xs text-text-faint">Available in the desktop app.</p>}
    {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
  </div>;
}

// ---------------------------------------------------------------- notifications

function NotificationsSection() {
  const prefs = useAlertPrefs();
  const [themes, setThemes] = React.useState<SoundTheme[] | null>(null);
  React.useEffect(() => { void getSoundThemes().then(setThemes); }, []);
  const [desktopOn, setDesktopOn] = React.useState(notificationsEnabled());
  const supported = notificationsSupported();
  const set = (patch: Partial<AlertPrefs>) => setAlertPrefs({ ...prefs, ...patch });
  // a saved theme that is no longer installed plays the first installed one
  const theme = prefs.theme === "off" ? "off" : themes?.some(t => t.id === prefs.theme) ? prefs.theme : themes?.[0]?.id ?? prefs.theme;
  const soundsOn = theme !== "off" && !!themes?.length;
  return (
    <>
      <Group title="Sounds" description={themes && !themes.length
        ? "No sound theme is installed on this computer (ocean-sound-theme or sound-theme-freedesktop)."
        : "From the sound themes installed on this computer."}>
        <Field label="Sound theme" stacked>
          <Chips label="Sound theme" value={theme} onChange={id => { set({ theme: id }); if (id !== "off") void playSound("done", id); }}
            options={[{ id: "off", name: "Off", description: "No sounds." }, ...(themes || []).map(t => ({ id: t.id, name: t.name, description: t.description }))]} />
        </Field>
        <Field label="Volume">
          <input type="range" min={0} max={1} step={0.05} value={prefs.volume} aria-label="Sound volume" disabled={!soundsOn}
            onChange={e => set({ volume: Number(e.target.value) })}
            onPointerUp={() => void playSound("done")} onKeyUp={() => void playSound("done")}
            className="w-full accent-primary disabled:opacity-40" />
        </Field>
        <Field label="Also while ReVibe is focused" hint="Off: sounds only when you are in another window.">
          <Switch on={prefs.soundWhenFocused} disabled={!soundsOn} label="Play sounds while ReVibe is focused"
            onChange={on => set({ soundWhenFocused: on })} />
        </Field>
      </Group>

      <Group title="Desktop notifications" description="Shown while ReVibe is in the background. Clicking one opens its session.">
        <Field label="Show notifications" hint={supported ? undefined : "This window cannot show notifications."}>
          <Switch on={desktopOn} disabled={!supported} label="Desktop notifications"
            onChange={on => { setNotificationsEnabled(on); setDesktopOn(on); }} />
        </Field>
      </Group>

      <Group title="Per event">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 px-4 py-2 text-[11px] text-text-faint">
          <span>Event</span><span className="w-6" /><span className="w-9 text-center">Sound</span><span className="w-[72px] text-center">Notification</span>
        </div>
        {ALERT_EVENTS.map(ev => (
          <div key={ev.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 px-4 py-2.5">
            <div className="min-w-0">
              <div className="text-sm text-text">{ev.label}</div>
              <div className="truncate text-xs text-text-faint">{ev.hint}</div>
            </div>
            <button type="button" disabled={!soundsOn} onClick={() => void playSound(ev.id, theme)} aria-label={`Play the ${ev.label.toLowerCase()} sound`} title="Play"
              className="grid h-6 w-6 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface-muted hover:text-text disabled:opacity-30">
              <Play size={12} fill="currentColor" />
            </button>
            <Switch on={prefs.sound[ev.id]} disabled={!soundsOn} label={`Sound for ${ev.label.toLowerCase()}`}
              onChange={on => set({ sound: { ...prefs.sound, [ev.id]: on } })} />
            <span className="flex w-[72px] justify-center">
              <Switch on={prefs.notify[ev.id]} disabled={!desktopOn} label={`Notification for ${ev.label.toLowerCase()}`}
                onChange={on => set({ notify: { ...prefs.notify, [ev.id]: on } })} />
            </span>
          </div>
        ))}
      </Group>
    </>
  );
}

// ---------------------------------------------------------------- providers: the Studio key

function StudioKey() {
  const [keyStatus, setKeyStatus] = React.useState<ApiKeyStatus | null>(null);
  const [keyInput, setKeyInput] = React.useState("");
  const [keyBusy, setKeyBusy] = React.useState(false);
  const [keyMsg, setKeyMsg] = React.useState<{ text: string; danger?: boolean } | null>(null);
  const [swapping, setSwapping] = React.useState(false);
  React.useEffect(() => { getApiKeyStatus().then(setKeyStatus).catch(() => setKeyMsg({ text: "Could not check the Studio API key. Reopen Settings to retry.", danger: true })); }, []);

  const saveKey = async () => {
    const key = keyInput.trim();
    if (!key || keyBusy) return;
    const wasPresent = keyStatus?.present;
    setKeyBusy(true);
    setKeyMsg(null);
    try {
      setKeyStatus(await setApiKey(key));
      setKeyInput("");
      setSwapping(false);
      setKeyMsg({ text: wasPresent ? "Key updated." : "API key saved." });
    } catch (e) {
      setKeyMsg({ text: `Failed to save key: ${e}`, danger: true });
    } finally {
      setKeyBusy(false);
    }
  };
  const removeKey = async () => {
    if (keyBusy) return;
    setKeyBusy(true);
    setKeyMsg(null);
    try {
      setKeyStatus(await removeApiKey());
      setKeyMsg({ text: "Studio API key removed. Your browser and CLI accounts are unchanged." });
    } catch (e) {
      setKeyMsg({ text: `Failed to remove key: ${e}`, danger: true });
    } finally {
      setKeyBusy(false);
    }
  };
  const ksl = keyStatusLabel(keyStatus);
  return (
    <Group title="Mistral Studio API key" description="Used by the Studio playground and direct API chat. The vibe CLI keeps its own login in the system keyring.">
      <div className="space-y-3 px-4 py-3">
        {keyStatus?.present && !swapping ? (
          <>
            <div className="flex items-center justify-between gap-3 rounded-md bg-surface-muted px-3 py-2">
              <div className="min-w-0">
                <div className="text-[11px] text-text-faint">API key · {keySourceLabel(keyStatus.source)}</div>
                <div className="font-mono text-sm text-text truncate">{keyStatus.fingerprint || "••••"}</div>
              </div>
              <Badge tone={ksl.tone}>{ksl.text}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { setSwapping(true); setKeyMsg(null); }}>Swap key</Button>
              <Button variant="outline" size="sm" onClick={removeKey} disabled={keyBusy}>Remove API key</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-text-faint">
              {keyStatus?.present
                ? "Paste a different key to replace the current one."
                : <>Add your Mistral API key. It is stored in <code className="font-mono">{keyStatus?.file || "~/.config/vibedeck/env"}</code> (0600).</>}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveKey(); }}
                placeholder={keyStatus?.present ? "Paste a new key…" : "Paste your Mistral API key…"}
                className="font-mono h-8" autoComplete="off" autoFocus={swapping} />
              <Button variant="primary" size="sm" onClick={saveKey} disabled={!keyInput.trim() || keyBusy}>
                {keyStatus?.present ? "Save new key" : "Save API key"}
              </Button>
              {keyStatus?.present && (
                <Button variant="outline" size="sm" onClick={() => { setSwapping(false); setKeyInput(""); setKeyMsg(null); }}>Cancel</Button>
              )}
            </div>
          </>
        )}
        {keyMsg && <div className={`text-xs ${keyMsg.danger ? "text-danger" : "text-success"}`}>{keyMsg.text}</div>}
      </div>
    </Group>
  );
}

// ---------------------------------------------------------------- agents

function AgentsSection() {
  return (
    <>
      <Subagents />
      <Group title="Skills and connections" description="Local skills and MCP servers are shared with the Vibe CLI. Web services use your Mistral workspace account.">
        <Field label="Skills" hint="Installed, imported and registry skills."><Link to="/skills" className="text-sm text-primary hover:underline">Open Skills</Link></Field>
        <Field label="MCP servers" hint="Servers and connectors Vibe sessions can use."><Link to="/mcp" className="text-sm text-primary hover:underline">Open MCP</Link></Field>
        <Field label="Web connectors" hint="Services in your Mistral web workspace."><Link to="/workspace/connectors" className="text-sm text-primary hover:underline">Open connectors</Link></Field>
      </Group>
    </>
  );
}

function Subagents() {
  const [settings, setSettings] = React.useState<SubagentSettings | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    let closed = false;
    setError("");
    getSubagentSettings().then(value => { if (!closed) setSettings(value); })
      .catch(error => {
        if (closed) return;
        if (error.code === "invalid_agent_settings") {
          setSettings({ policy: "off", quality: "balanced", max_workers: 2 });
          setSaved(false);
          setError("Subagent settings could not be read. Review these safe defaults and save to repair them.");
        } else setError("Could not load subagent settings.");
      });
    return () => { closed = true; };
  }, [revision]);
  // each change saves at once, like the rest of Settings
  const change = async (next: SubagentSettings) => {
    setSettings(next); setBusy(true); setError(""); setSaved(false);
    try { setSettings(await saveSubagentSettings(next)); setSaved(true); window.setTimeout(() => setSaved(false), 1600); }
    catch { setError("Could not save subagent settings. Try again."); }
    finally { setBusy(false); }
  };
  return (
    <Group title="Subagents" description="Workers the main agent can hand parts of a task to. Shared with the CLI; any configured model can be a worker.">
      {error && <div className="flex items-center gap-2 px-4 py-2"><p role="alert" className="text-xs text-danger">{error}</p>{!settings && <Button variant="ghost" size="sm" onClick={() => setRevision(n => n + 1)}>Retry</Button>}</div>}
      {settings && <>
        <Field label="Delegation" hint={saved ? <span className="text-success">Saved</span> : "When the main agent hands work to subagents."}>
          <Select aria-label="Subagent delegation" disabled={busy} value={settings.policy} className="w-full"
            options={[{ value: "requested", label: "When I ask" }, { value: "auto", label: "Automatic for substantial work" }, { value: "off", label: "Off" }]}
            onChange={value => void change({ ...settings, policy: value as SubagentSettings["policy"] })} />
        </Field>
        <Field label="Worker quality" hint="Fast is cheaper; Strong picks the most capable models.">
          <Select aria-label="Subagent quality" disabled={busy} value={settings.quality} className="w-full"
            options={[{ value: "fast", label: "Fast" }, { value: "balanced", label: "Balanced" }, { value: "strong", label: "Strong" }]}
            onChange={value => void change({ ...settings, quality: value as SubagentSettings["quality"] })} />
        </Field>
        <Field label="Workers per batch" hint="At most two run at once, and only one of them edits.">
          <Select aria-label="Subagent worker limit" disabled={busy} value={String(settings.max_workers)} className="w-full"
            options={[1, 2, 3].map(n => ({ value: String(n), label: String(n) }))}
            onChange={value => void change({ ...settings, max_workers: Number(value) })} />
        </Field>
        <p className="px-4 py-3 text-xs text-text-faint">
          You can name workers in a message, like “Use DeepSeek and Z.ai subagents with strong models and high thinking.” Named providers and models override the automatic choice, which goes by model names, not benchmarks. Only registered models are used.
        </p>
      </>}
    </Group>
  );
}

// ---------------------------------------------------------------- desktop

function DesktopSection() {
  return (
    <>
      <Group title="Window">
        <TrayControl />
      </Group>
      <WorktreesCard />
    </>
  );
}

function TrayControl() {
  const desktop = window.vibedeck?.desktop;
  const [settings, setSettings] = React.useState<DesktopSettings | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => { void desktop?.get().then(setSettings).catch(() => setError("Could not read desktop settings.")); }, [desktop]);
  const toggle = async (closeToTray: boolean) => {
    if (busy || !desktop) return;
    setBusy(true); setError("");
    try { setSettings(await desktop.set({ closeToTray })); }
    catch { setError("Could not save this setting. Try again."); }
    finally { setBusy(false); }
  };
  const available = !!settings?.tray;
  const hint = error ? <span role="alert" className="text-danger">{error}</span>
    : !desktop ? "Available in the desktop app."
    : settings && !available ? "Your desktop has no system tray, so closing the window quits ReVibe."
    : "Closing the window hides ReVibe to the tray icon. Quit from the tray menu.";
  return (
    <Field label="Keep running in the tray" hint={hint}>
      <Switch on={!!settings?.closeToTray} disabled={busy || !available} label="Keep running in the tray" onChange={on => void toggle(on)} />
    </Field>
  );
}

// ---------------------------------------------------------------- about

function AboutSection({ health }: { health: any }) {
  const [notesOpen, setNotesOpen] = React.useState(false);
  const state = (ok: boolean | undefined, yes: string, no: string, tone: "danger" | "warning" = "danger") =>
    <Badge tone={ok ? "success" : tone}>{ok ? yes : no}</Badge>;
  return (
    <>
      <Group title="Versions">
        <Field label="ReVibe"><span className="font-mono text-xs text-text-muted">{health?.version || "—"}</span></Field>
        <Field label="Vibe" hint={health?.vibe?.outdated
          ? <>Update with <code className="font-mono">{health.vibe.upgradeCommand}</code>.</> : undefined}>
          <span className="flex items-center gap-2">
            {health?.vibe?.outdated && <Badge tone="warning">{health.vibe.recommended} available</Badge>}
            <span className="font-mono text-xs text-text-muted">{health?.vibe?.version || "—"}</span>
            <button type="button" onClick={() => setNotesOpen(true)} className="text-xs text-primary hover:underline">What’s new</button>
          </span>
        </Field>
        <VibeReleaseNotes open={notesOpen} onClose={() => setNotesOpen(false)} />
      </Group>

      <Group title="Status">
        <Field label="Sidecar">{state(health?.ok, "connected", "offline")}</Field>
        <Field label="vibe CLI">{state(health?.vibe_cli, "installed", "missing")}</Field>
        <Field label="app-server">{state(health?.app_server, "available", "missing")}</Field>
        <Field label="API key">{state(health?.api_key, `present${health?.api_key_source ? ` · ${health.api_key_source}` : ""}`, "missing", "warning")}</Field>
      </Group>

      <Group title="Privacy">
        <ul className="list-disc space-y-1 py-3 pl-8 pr-4 text-xs text-text-muted">
          <li>The sidecar listens on 127.0.0.1. Local processes can access its API.</li>
          <li>Model calls use your configured providers. Usage sign-in contacts Mistral and your identity provider.</li>
          <li>API keys live in the keyring or local env file. Usage cookies stay in a separate desktop profile.</li>
          <li>The local audit log records selected control actions. Conversations stay in the shared Vibe store.</li>
        </ul>
      </Group>

      <Group title="Danger zone" className="border-danger/30">
        <Field label="Delete all sessions" hint="Removes every session and its local history. Cannot be undone.">
          <DeleteAllSessions />
        </Field>
      </Group>
    </>
  );
}

function DeleteAllSessions() {
  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState("");
  const run = async () => {
    setBusy(true); setError("");
    try {
      const { sessions } = await listSessions();
      const results = await Promise.allSettled(sessions.map((s) => deleteSession(s.id)));
      const failed = results.filter(result => result.status === "rejected").length;
      window.dispatchEvent(new Event("vibedeck:sessions"));
      if (failed) { setError(`${failed} session(s) could not be deleted. Retry to remove the remaining sessions.`); return; }
      setDone(true);
      setTimeout(() => { setDone(false); setConfirming(false); }, 2500);
    } catch { setError("Could not load sessions. Nothing was deleted. Try again."); } finally {
      setBusy(false);
    }
  };
  if (done) return <Badge tone="success">deleted</Badge>;
  if (confirming) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {error && <p role="alert" className="w-full text-xs text-danger">{error}</p>}
        <Button variant="danger" size="sm" disabled={busy} onClick={run}>
          {busy ? "Deleting…" : "Confirm delete"}
        </Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }
  return (
    <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
      Delete all
    </Button>
  );
}
