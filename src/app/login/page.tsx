"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";

export default function LoginPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", { method: "POST", body: JSON.stringify({ token }) });
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get("next");
      // Only follow same-site paths.
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return;
    }
    setBusy(false);
    setError((await res.json().catch(() => ({}))).error ?? "That didn’t work.");
  };

  return (
    <main className="page stack gap-24" style={{ maxWidth: 440, paddingTop: 80 }}>
      <div className="row gap-8">
        <span className="brand-mark">W</span>
        <strong>Workflow Runner</strong>
      </div>
      <form className="card card-pad stack gap-16" onSubmit={submit}>
        <div className="stack gap-4">
          <h1 style={{ fontSize: 22 }}>Enter the access token</h1>
          <p className="muted small">
            The app prints it when it starts. It’s also in <code className="mono">data/access-token.txt</code> on the
            machine running the app (with Docker: <code className="mono">docker logs workflow-runner</code>). This device
            stays signed in for a year.
          </p>
        </div>
        <input
          className="input token-box"
          autoFocus
          autoComplete="current-password"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="xxxx-xxxx-xxxx-xxxx"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          aria-label="Access token"
        />
        {error && (
          <div className="callout danger" role="alert">
            <Icon name="alert" />
            <div>{error}</div>
          </div>
        )}
        <button className="btn primary big" disabled={busy || !token.trim()}>
          <Icon name="key" /> {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
