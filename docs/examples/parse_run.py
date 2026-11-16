#!/usr/bin/env python3
"""Read a Workflow Runner run file (*.run.json): verify its hashes and summarize every round.

Standard library only. Python 3.8+.

    python parse_run.py my-run.run.json           # readable summary
    python parse_run.py my-run.run.json --json    # the same summary as JSON, for other tools

See run-format.md for what each field means.
"""
import hashlib
import json
import sys


# ---------- Verification ----------

def stable_stringify(value):
    """JSON with object keys sorted and no whitespace, as the app hashes it.

    Matches JavaScript's JSON.stringify for the values found in run files (strings, integers, booleans,
    null, arrays, objects). Floats would need JavaScript number formatting; run files don't contain any.
    """
    if isinstance(value, dict):
        items = sorted(value.items(), key=lambda kv: kv[0])
        return "{" + ",".join(json.dumps(k, ensure_ascii=False) + ":" + stable_stringify(v) for k, v in items) + "}"
    if isinstance(value, list):
        return "[" + ",".join(stable_stringify(v) for v in value) + "]"
    return json.dumps(value, ensure_ascii=False)


def sha256(text):
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


def verify(run):
    """(workflow fingerprint ok, content seal ok or None if the run has no seal)."""
    template_ok = sha256(stable_stringify(run["template"]["definition"])) == run["template"]["hash"]
    seal = run.get("integrity")
    if not seal:
        return template_ok, None
    rest = {k: v for k, v in run.items() if k not in ("integrity", "importVerification")}
    return template_ok, sha256(stable_stringify(rest)) == seal["contentHash"]


# ---------- Reading ----------

def detect_signal(text, signal):
    """Same rule as the app: '<match> … : <option>' on one line; heading lines win over body text."""
    import re

    options = sorted(signal["options"], key=len, reverse=True)
    prefix = "(?:%s)[^\\n]{0,40}?" % signal["match"] if signal.get("match") else ""
    pattern = re.compile(prefix + r"[:\-—–]\s*[*_`]*\s*(" + "|".join(map(re.escape, options)) + r")\b", re.I)
    fallback = None
    for line in text.split("\n"):
        m = pattern.search(line)
        if not m:
            continue
        value = next((o for o in signal["options"] if o.lower() == m.group(1).lower()), m.group(1))
        if line.lstrip().startswith("#"):
            return value
        fallback = fallback or value
    return fallback


def summarize_round(definition, round_no, steps, follow_ups, carry_over, current, run):
    defs = {s["id"]: s for s in definition["steps"]}
    done = [s for s in steps if s.get("status") == "done" and s.get("response", "").strip()]

    signals = {}
    for s in done:
        for sig in defs[s["id"]].get("signals", []):
            # The stored value includes one the user picked by hand; detection is the fallback.
            value = (s.get("signals") or {}).get(sig["key"]) or detect_signal(s["response"], sig)
            if value:
                signals["%s.%s" % (s["id"], sig["key"])] = value

    featured = [s for s in done if defs[s["id"]].get("feature")]
    outcome = featured[-1] if featured else None
    reviews = [
        {"step": s["id"], "label": s["label"], "fields": s.get("fields", {})}
        for s in done
        if s["kind"] == "human"
    ]
    return {
        "round": round_no,
        "current": current,
        "status": run["status"] if current else "continued in the next round",
        "carriedIn": [f["name"] for f in (carry_over or {}).get("files", [])],
        "steps": [{"id": s["id"], "label": s["label"], "status": s["status"], "file": s["outputFile"]} for s in steps],
        "signals": signals,
        "outcome": {"step": outcome["id"], "file": outcome["outputFile"], "markdown": outcome["response"]} if outcome else None,
        "reviews": reviews,
        "followUps": [
            {"n": f["n"], "kind": f.get("kind", "research"), "step": f["stepId"], "status": f["status"], "answers": f["answers"]}
            for f in (follow_ups or [])
        ],
    }


def summarize(run):
    definition = run["template"]["definition"]
    template_ok, content_ok = verify(run)
    rounds = [
        summarize_round(definition, r["round"], r["steps"], r.get("followUps"), r.get("carryOver"), False, run)
        for r in run.get("rounds", [])
    ]
    rounds.append(
        summarize_round(definition, run.get("round", 1), run["steps"], run.get("followUps"), run.get("carryOver"), True, run)
    )
    return {
        "id": run["id"],
        "title": run["title"],
        "workflow": run["tag"],
        "status": run["status"],
        "variables": run["variables"],
        "verification": {"workflowFingerprint": template_ok, "contentSeal": content_ok},
        "rounds": rounds,
    }


# ---------- Output ----------

def print_summary(s):
    ok = lambda v: "valid" if v else ("not sealed" if v is None else "MISMATCH")
    print(s["title"])
    print("  workflow:", s["workflow"], " status:", s["status"])
    print("  fingerprint:", ok(s["verification"]["workflowFingerprint"]), " seal:", ok(s["verification"]["contentSeal"]))
    for k, v in s["variables"].items():
        if v.strip():
            print("  %s: %s" % (k, v))
    for r in s["rounds"]:
        print("\nRound %d%s" % (r["round"], " (current)" if r["current"] else ""))
        if r["carriedIn"]:
            print("  carried in:", ", ".join(r["carriedIn"]))
        print("  steps:", ", ".join("%s %s" % (st["id"], st["status"]) for st in r["steps"]))
        for k, v in r["signals"].items():
            print("  signal %s = %s" % (k, v))
        for f in r["followUps"]:
            print("  follow-up %d (%s on %s): %s" % (f["n"], f["kind"], f["step"], f["status"]))
        if r["outcome"]:
            print("  outcome (%s):" % r["outcome"]["file"])
            for line in r["outcome"]["markdown"].strip().split("\n"):
                print("    " + line)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    # Reports contain characters like "—"; don't let a non-UTF-8 console mangle them.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    with open(sys.argv[1], encoding="utf-8") as fh:
        data = json.load(fh)
    if data.get("format") != "workflow-run":
        sys.exit("Not a run file (expected \"format\": \"workflow-run\").")
    summary = summarize(data)
    if "--json" in sys.argv:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    else:
        print_summary(summary)
