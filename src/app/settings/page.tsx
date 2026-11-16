"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CopyButton, Icon, TopBar, timeAgo, useToast } from "@/components/ui";
import { useProviders } from "@/components/useAgent";
import { PROVIDERS, REVISE_POLICIES, formatTokens, type ProviderStatus } from "@/lib/agents";

interface TokenInfo {
  token: string | null;
  source: "env" | "file" | "off";
  file: string;
}

export default function SettingsPage() {
  const toast = useToast();
  const { providers, settings, checking, refresh, saveSettings } = useProviders();
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    fetch("/api/auth/token")
      .then((r) => r.json())
      .then(setToken);
  }, []);

  const regenerate = async () => {
    if (!confirm("Make a new access token? Other devices will need to sign in again with the new one.")) return;
    const res = await fetch("/api/auth/token", { method: "POST" });
    const json = await res.json();
    if (!res.ok) return toast.show(json.error);
    setToken(json);
    setReveal(true);
    toast.show("New token saved. This device stays signed in.");
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const signInLink = token?.token && typeof window !== "undefined" ? `${window.location.origin}/?token=${token.token}` : "";

  return (
    <>
      <TopBar />
      <main className="page stack gap-32 fade-in">
        <section className="stack gap-8">
          <Link href="/" className="small muted">
            ← Back
          </Link>
          <h1>Settings</h1>
          <p className="muted" style={{ maxWidth: "64ch" }}>
            Connect agents to run workflow steps for you. Each step runs as a fresh session through the provider’s own
            tool, signed in with your own account. Copy/paste always works too.
          </p>
        </section>

        <section className="stack gap-12">
          <div className="runs-head">
            <h2>Agents</h2>
            <button className="btn sm" onClick={refresh} disabled={checking}>
              <Icon name="refresh" /> {checking ? "Checking…" : "Check again"}
            </button>
          </div>
          {!providers || !settings ? (
            <div className="skeleton" style={{ height: 220 }} />
          ) : (
            <div className="settings-grid">
              {PROVIDERS.map((meta) => {
                const st = providers.find((p) => p.id === meta.id)!;
                return (
                  <ProviderCard
                    key={meta.id}
                    status={st}
                    isDefault={settings.defaultProvider === meta.id}
                    model={settings.models[meta.id] ?? st.defaultModel ?? ""}
                    onDefault={() => saveSettings({ defaultProvider: meta.id })}
                    onModel={(m) => saveSettings({ models: { ...settings.models, [meta.id]: m } })}
                  />
                );
              })}
              <label className="check card card-pad">
                <input type="checkbox" checked={settings.autoAdvance} onChange={(e) => saveSettings({ autoAdvance: e.target.checked })} />
                <span>
                  Keep going automatically by default
                  <span className="tiny muted" style={{ display: "block" }}>
                    After an agent finishes a step, start the next AI step too. It always stops at review steps, at a
                    “Block” verdict, and on any failure. You can change this per run.
                  </span>
                </span>
              </label>
              <div className="card card-pad stack gap-12">
                <div className="stack gap-4">
                  <strong>When a source check says “Revise”</strong>
                  <span className="tiny muted">What a run that keeps going automatically does when a check flags claims to correct.</span>
                </div>
                <div className="choices" role="radiogroup">
                  {REVISE_POLICIES.map((p) => {
                    const selected = settings.onRevise === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`choice ${selected ? "selected" : ""}`}
                        onClick={() => saveSettings({ onRevise: p.id })}
                      >
                        <span className="radio" />
                        <span className="stack gap-4">
                          <strong>{p.label}</strong>
                          <span className="small muted">{p.help}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="stack gap-12">
          <h2>Access token</h2>
          {!token ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : token.source === "off" ? (
            <div className="callout warn">
              <Icon name="alert" />
              <div>
                The access check is off (<code className="mono">ACCESS_TOKEN=off</code>, or the dev server). That’s fine
                while the app only listens on this computer; if other devices can reach it, they can run agents on your
                accounts.
              </div>
            </div>
          ) : (
            <div className="card card-pad stack gap-12">
              <p className="muted small">
                Devices on your network sign in once with this token and stay signed in for a year.{" "}
                {token.source === "env" ? (
                  <>
                    It’s set by <code className="mono">ACCESS_TOKEN</code> in the environment.
                  </>
                ) : (
                  <>
                    It’s stored in <code className="mono">{token.file}</code>; edit or delete that file to change it.
                  </>
                )}
              </p>
              <div className="row gap-8">
                <span className="token-box" style={{ flex: 1, minWidth: 220 }}>
                  {reveal ? token.token : "••••-••••-••••-••••"}
                </span>
                <button className="btn sm" onClick={() => setReveal((r) => !r)}>
                  {reveal ? "Hide" : "Show"}
                </button>
                <CopyButton text={token.token ?? ""} label="Copy token" copiedLabel="Copied" />
              </div>
              <div className="row gap-8">
                <CopyButton text={signInLink} label="Copy sign-in link" copiedLabel="Link copied" />
                <span className="tiny muted" style={{ flex: 1, minWidth: 200 }}>
                  Opening the link signs a device in without typing. Treat it like the token.
                </span>
              </div>
              <div className="row gap-8">
                {token.source === "file" && (
                  <button className="btn sm ghost" onClick={regenerate}>
                    <Icon name="refresh" /> Make a new token
                  </button>
                )}
                <button className="btn sm ghost push-right" onClick={signOut}>
                  Sign out of this device
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
      {toast.node}
    </>
  );
}

function ProviderCard({
  status,
  isDefault,
  model,
  onDefault,
  onModel,
}: {
  status: ProviderStatus;
  isDefault: boolean;
  model: string;
  onDefault: () => void;
  onModel: (m: string) => void;
}) {
  const meta = PROVIDERS.find((p) => p.id === status.id)!;
  const ready = status.installed && status.signedIn;
  return (
    <div className="card card-pad stack gap-12">
      <div className="row gap-8">
        <h3 style={{ fontSize: 16 }}>{meta.name}</h3>
        <span className="chip">{meta.kind}</span>
        <span className={`chip ${ready ? "ok" : "warn"}`}>
          <span className="dot" /> {ready ? "Ready" : !status.installed ? "Not available" : status.id === "pi" ? "Not set up" : "Not signed in"}
        </span>
        {isDefault && ready && <span className="chip accent">Default</span>}
        <span className="tiny faint push-right" title={status.checkedAt}>
          checked {timeAgo(status.checkedAt)}
        </span>
      </div>
      <p className="muted small">{meta.blurb}</p>
      <div className="row gap-8 tiny muted">
        {status.version && <span>{status.version}</span>}
        {status.account && <span>· {status.account}</span>}
      </div>
      {status.problem && (
        <div className="callout warn">
          <Icon name="alert" />
          <div className="stack gap-8" style={{ flex: 1, minWidth: 0 }}>
            <span>{status.problem}</span>
            {status.fix?.map((cmd) => <Command key={cmd} text={cmd} />)}
          </div>
        </div>
      )}
      {ready && (
        <div className="row gap-8">
          {status.models.length > 0 && (
            <label className="row gap-8 small">
              <span className="muted">Default model</span>
              <select className="input sm select" value={model} onChange={(e) => onModel(e.target.value)}>
                {status.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.contextWindow ? ` · ${formatTokens(m.contextWindow)} context` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!isDefault && (
            <button className="btn sm ghost push-right" onClick={onDefault}>
              Make default
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Command({ text }: { text: string }) {
  const [cmd, note] = text.split(/\s{2,}#\s*/);
  return (
    <div className="stack gap-4">
      <div className="cmd">
        <code>{cmd}</code>
        <CopyButton text={cmd} label="Copy" copiedLabel="Copied" small />
      </div>
      {note && <span className="tiny">{note}</span>}
    </div>
  );
}

