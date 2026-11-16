import { outputTitle, renderTemplate, slugify } from "./workflow.ts";
import type { DecisionOption, HumanField, Signal, TemplateStep, WorkflowTemplate } from "./types.ts";

export function bundleFiles(template: WorkflowTemplate): { path: string; content: string }[] {
// ---------- Small helpers ----------

// Step labels by 1-based position, set per workflow in buildDocs. Numeric step ids are used as they are, so file
// numbers match the "Session NN" numbers inside the prompts; other steps (usually reviews) take the previous label
// plus "b", e.g. "06b". If that would give duplicates, fall back to plain positions.
// Set at the start of each (synchronous) bundle build, so concurrent requests can't see each other's labels.
let stepLabels: string[] = [];
const pad = (n: number) => stepLabels[n] ?? String(n).padStart(2, "0");

function labelSteps(t: WorkflowTemplate): string[] {
  const labels = [""];
  let prev = "00";
  for (const s of t.steps) {
    const label = /^\d+$/.test(s.id) ? s.id.padStart(2, "0") : `${prev}b`;
    labels.push(label);
    prev = label;
  }
  const unique = new Set(labels.slice(1)).size === t.steps.length;
  return unique ? labels : ["", ...t.steps.map((_, i) => String(i + 1).padStart(2, "0"))];
}
const code = (s: string) => `\`${s}\``;
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const list = (items: string[], bullet = "-") => items.map((i) => `${bullet} ${i}`).join("\n");
const joinWords = (items: string[]) => (items.length < 3 ? items.join(" or ") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`);

/** A code fence long enough to wrap text that itself contains backtick fences. */
function fence(text: string): string {
  const longest = Math.max(2, ...[...text.matchAll(/`{3,}/g)].map((m) => m[0].length));
  const f = "`".repeat(longest + 1);
  return `${f}text\n${text.trim()}\n${f}`;
}

/** GitHub's heading anchor, for the table of contents in the single-file version. */
const anchor = (title: string) => "#" + title.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-");

/** How one document points at another: a file name in the folder version, a link in the single file. */
interface Refs {
  ref: (docPath: string) => string;
  link: (docPath: string, text: string) => string;
}

interface Doc {
  path: string;
  title: string;
  body: (r: Refs) => string;
}

// ---------- Fill-in markers ----------

/** "Scenario / constraints (optional)" -> "SCENARIO / CONSTRAINTS"; long labels are cut sensibly. */
function shortLabel(label: string): string {
  let s = oneLine(label.replace(/\([^)]*\)/g, " ")).replace(/[:.]+$/, "");
  if (s.length > 40) s = oneLine(s.split(/[:;—–]| - |,/)[0]);
  if (s.length > 40) {
    const words = s.split(" ");
    s = "";
    for (const w of words) {
      if ((s + " " + w).trim().length > 40) break;
      s = (s + " " + w).trim();
    }
  }
  return (s || oneLine(label)).toUpperCase();
}

function markerFor(t: WorkflowTemplate): Record<string, string> {
  const out: Record<string, string> = {};
  const used = new Set<string>();
  for (const v of t.variables) {
    let name = shortLabel(v.label);
    if (used.has(name)) name = `${name} (${v.key.toUpperCase()})`;
    used.add(name);
    out[v.key] = `[YOUR ${name}${v.required ? "" : " (OPTIONAL)"}]`;
  }
  return out;
}

// ---------- Texts ----------

// Copied from correctionMessage() in src/lib/agents.ts (the app's targeted-correction request); the file names are
// filled in and "below" becomes "attached" because the files are attached by hand here.
function correctionRequest(own: string, report: string): string {
  return `--- CORRECTION REQUEST ---
The task above has already been done once. ${own} (attached) is that output. A separate check then reviewed it, and its report, ${report} (attached), asks for revisions.

Make the targeted corrections ${report} requires, and nothing more:
1. Go through every correction it lists, one by one. For each flagged claim, either correct it to match what the source says, cite a source that does support it, or remove it. Check sources where that helps. Don't skip any.
2. Keep everything it did not flag as it is: same structure, numbering and wording. Do not add new claims.
3. Reply with the complete corrected ${own} and nothing else: no notes about what you changed before or after it.`;
}

// Copied from followUpMessage() in src/lib/agents.ts. The app inlines the files and the user's setup answers; here
// the setup lines carry fill-in markers and the files are attached. The app calls the answers file
// follow_up_answers.md; it is follow-up_answers.md here so one name works for both this prompt and the step's own.
function followUpPrompt(step: TemplateStep, setup: string[]): string {
  const own = step.output.file;
  return `# Follow-up research

${setup.length ? `The investigation:\n${setup.join("\n")}\n\n` : ""}${own} ("${step.label}") recommends investigating further before deciding. Research only its open questions; follow-up_answers.md lists them with anything the user added.

1. For each open question, find what reliable sources say and cite them with links. Use your web search and fetch tools.
2. Where the user has answered a question, treat the answer as their stated scenario (not verified evidence) and research what it implies.
3. Keep verified source statements, reasoned inference and assumptions clearly apart.
4. Say plainly when a question can't be settled by research and only the user can answer it.
5. Do not redo the rest of the investigation or make the final decision.

**Output:** \`follow-up_research.md\`, **600 words maximum**, titled **Follow-up Research**: one section per question with the finding, its sources and how confident it is, then a short **What this changes** section naming the parts of ${own} these findings affect.`;
}

const LOSE = [
  "**No enforced isolation.** In the app each step sees only the files it is meant to see. By hand, nothing stops you pasting the wrong file, or carrying on in an old chat. The workflow works because each step is kept apart, so be strict about it.",
  "**Verdicts aren't acted on automatically.** The app reads the verdict lines (gate results, recommendations), warns you, and offers the fix. By hand, you have to find those lines yourself and follow the instructions in each step file.",
  "**No run record or hashes.** The app saves one run file with the workflow, every prompt, every output, and integrity hashes. Here you only have the files you saved; nothing proves which prompt text or inputs produced them.",
  "**More copying.** You assemble each message yourself: fill in the markers, attach the right files, save each reply under the right name, and repeat for every step and every round.",
];

// ---------- Document builders ----------

interface Ctx {
  t: WorkflowTemplate;
  markers: Record<string, string>;
  pos: Map<string, number>; // step id -> 1-based position
  docPath: Map<string, string>; // step id -> file path in the bundle
  stepById: Map<string, TemplateStep>;
  vars: Record<string, string>; // first-round values for renderTemplate
  hasFillIn: boolean;
  loopOptions: { step: TemplateStep; option: DecisionOption }[];
  followUpSteps: TemplateStep[];
}

const NEXT_ROUND = "extras/next-round.md";
const FOLLOW_UP = "extras/follow-up-research.md";

function inputLines(c: Ctx, ids: string[], optional: boolean): string[] {
  return ids.map((id) => {
    const s = c.stepById.get(id)!;
    const extra = optional ? " (optional: include it if you want this step to see it)" : "";
    return `${code(s.output.file)} — ${outputTitle(s)}, from step ${pad(c.pos.get(id)!)}${extra}`;
  });
}

function readmeDoc(c: Ctx): Doc {
  const { t } = c;
  return {
    path: "README.md",
    title: t.title,
    body: (r) => {
      const out: string[] = [`# ${t.title}`];
      if (t.description?.trim()) out.push(t.description.trim());
      out.push(
        `This is a prompt bundle for the workflow ${code(t.id)} (version ${t.version}). It lets you follow the whole workflow by hand in any chat app, without running Workflow Runner.`,
      );

      if (t.intro?.length) {
        out.push(
          `## About this workflow\n\n${list(t.intro.map(oneLine))}\n\nIn these notes, “this guide” means this bundle, and “copy it back into this guide” means save the reply as the file the step names.`,
        );
      }

      const use: string[] = [];
      if (c.hasFillIn) use.push(`Open ${r.ref("00-fill-in.md")} and write down your answers. You'll need them in the prompts.`);
      use.push(
        `Go through the steps below in order. For each AI step, open a **fresh chat**, a new conversation in any AI tool. Never continue an earlier chat: keeping steps apart is the point of the workflow.`,
        `Attach or paste **only** the files that step lists, nothing else. Then paste the step's prompt. Replace each marker such as ${code("[YOUR …]")} with your own answer first.`,
        `Save each reply, complete and with nothing added, under the file name the step gives. Keep all saved files together in one folder, because later steps ask for them.`,
        `Review steps are done by you, with no AI. Their file is a worksheet; fill it in and save it under the name it gives.`,
      );      if (c.loopOptions.length || c.followUpSteps.length) {
        const bits = [
          c.loopOptions.length ? `${r.ref(NEXT_ROUND)} explains how to run another round` : "",
          c.followUpSteps.length ? `${r.ref(FOLLOW_UP)} has the prompt for a follow-up research session` : "",
        ].filter(Boolean);
        use.push(`If a step's result tells you more work is needed, ${bits.join(", and ")}.`);
      }
      out.push(`## How to use this bundle\n\n${use.map((u, i) => `${i + 1}. ${u}`).join("\n")}`);

      const rows = t.steps.map((s, i) => {
        const ins = [
          ...(s.inputs ?? []).map((id) => code(c.stepById.get(id)!.output.file)),
          ...(s.optionalInputs ?? []).map((id) => `${code(c.stepById.get(id)!.output.file)} (optional)`),
        ];
        const first = i === 0 && c.hasFillIn ? ["your fill-in answers"] : [];
        const inputs = [...first, ...ins].join(", ") || "none";
        return `| ${pad(i + 1)} | ${r.link(c.docPath.get(s.id)!, s.label)} | ${s.kind === "ai" ? "AI chat" : "You"} | ${inputs} → ${code(s.output.file)} |`;
      });
      out.push(`## Steps\n\n| # | Step | Who | Inputs → output |\n|---|---|---|---|\n${rows.join("\n")}`);

      out.push(`## What you lose without the app\n\n${list(LOSE)}`);
      out.push(`This bundle was exported from Workflow Runner, the app that runs these workflows for you. More about it: https://github.com/alexbakertech/workflow-runner`);
      return out.join("\n\n");
    },
  };
}

function fillInDoc(c: Ctx): Doc {
  const { t } = c;
  return {
    path: "00-fill-in.md",
    title: "Before you start: fill in your details",
    body: () => {
      const sections = t.variables.map((v, i) => {
        const label = oneLine(v.label.replace(/\s*\((optional|required)\)\s*$/i, ""));
        const parts = [`### ${i + 1}. ${label} (${v.required ? "required" : "optional"})`];
        if (v.help?.trim()) parts.push(oneLine(v.help));
        if (v.placeholder?.trim()) parts.push(`Example: *${oneLine(v.placeholder).replace(/^e\.g\.?,?\s*/i, "")}*`);
        parts.push(`Marker in the prompts: ${code(c.markers[v.key])}`);
        parts.push(`**Your answer:** ________________________________________`);
        return parts.join("\n\n");
      });
      const hasOptional = t.variables.some((v) => !v.required);
      return [
        `# Before you start: fill in your details`,
        `The prompts contain markers in square brackets, such as ${code(c.markers[t.variables[0].key])}. Write your answers below (or in your own notes). Before you paste a prompt into a chat, replace each marker, **including the square brackets**, with your answer.`,
        hasOptional
          ? `If you leave an optional item blank, also delete the sentence or paragraph around its marker so the prompt doesn't end up with a gap.`
          : "",
        `## Your details`,
        sections.join("\n\n"),
      ]
        .filter(Boolean)
        .join("\n\n");
    },
  };
}

function signalSection(c: Ctx, step: TemplateStep, sig: Signal, r: Refs): string {
  const idx = c.pos.get(step.id)!;
  const words = sig.match && /^[\w\s]+$/.test(sig.match) ? sig.match.trim() : "";
  const where = words
    ? `Find the line that contains “${words}”, followed by a colon or dash and the verdict.`
    : `Find the line that names “${sig.label}”, followed by a colon or dash and the verdict.`;
  const lines: string[] = [
    `### ${sig.label}`,
    `${where} It should be one of: ${sig.options.map((o) => `**${o}**`).join(", ")}. If you can't find one, ask the chat to state it, or judge from the report yourself.`,
  ];
  const next = c.t.steps[idx];
  const nextText = next ? `carry on with step ${pad(idx + 1)}` : "this is the final result. Any conditions it names still apply";
  const fixOn = sig.fix?.on ?? [];
  const bullets = sig.options.map((o) => {
    if (sig.fix && fixOn.includes(o)) {
      const target = c.stepById.get(sig.fix.step)!;
      const tpos = pad(c.pos.get(target.id)!);
      const own = (target.inputs ?? []).map((id) => c.stepById.get(id)!.output.file);
      const attach = `${code(target.output.file)} (step ${tpos}'s earlier output) and ${code(step.output.file)} (this report)`;
      const plus = own.length ? `, plus step ${tpos}'s own input files (${own.map(code).join(", ")})` : "";
      return `- **${o}**: the check found problems. Fix them before going on. Start a fresh chat, attach ${attach}${plus}, paste step ${tpos}'s prompt (${r.ref(c.docPath.get(target.id)!)}) followed by the correction request below, and ask it to correct only the flagged claims. Save the corrected reply over ${code(target.output.file)}, then run this step again with the corrected file. Or carry on without fixing, but keep the flag in mind, because later steps rely on this report.`;
    }
    if (sig.warnOn?.includes(o)) {
      if (sig.fix) return `- **${o}**: stop and read the report before going on. If the flagged claims can be corrected, follow the steps for ${joinWords(fixOn.map((x) => `**${x}**`))} above; otherwise decide whether to carry on, knowing that later steps rely on this report.`;
      const w = sig.warning ? ` ${oneLine(renderTemplate(sig.warning, c.vars))}` : "";
      return `- **${o}**: stop and read the report before going on.${w}`;
    }
    if (sig.followUp?.includes(o)) {
      const opts = [
        c.followUpSteps.includes(step) ? `a short follow-up research session (${r.ref(FOLLOW_UP)})` : "",
        c.loopOptions.length ? `a full new round (${r.ref(NEXT_ROUND)})` : "",
      ].filter(Boolean);
      return `- **${o}**: the reply says more research is needed. ${opts.length ? `You can do ${opts.join(" or ")}, or accept the result as it stands.` : "You can accept the result as it stands, or research the open questions yourself."}`;
    }
    return `- **${o}**: no action needed; ${nextText}.`;
  });
  lines.push(bullets.join("\n"));
  if (sig.fix && fixOn.length) {
    const target = c.stepById.get(sig.fix.step)!;
    lines.push(`Correction request to paste after step ${pad(c.pos.get(target.id)!)}'s prompt:\n\n${fence(correctionRequest(target.output.file, step.output.file))}`);
  }
  return lines.join("\n\n");
}

function aiStepDoc(c: Ctx, step: TemplateStep): Doc {
  const idx = c.pos.get(step.id)!;
  const title = `Step ${pad(idx)} — ${step.label}`;
  return {
    path: c.docPath.get(step.id)!,
    title,
    body: (r) => {
      const prompt = renderTemplate(step.prompt ?? "", { ...c.vars });
      const inputs = inputLines(c, step.inputs ?? [], false);
      const optional = inputLines(c, step.optionalInputs ?? [], true);
      const files = [...inputs, ...optional];
      const out: string[] = [`# ${title}`];
      if (step.description?.trim()) out.push(step.description.trim());
      out.push(
        `## Start a fresh chat\n\nOpen a new conversation in your AI tool. Don't continue an earlier chat, and don't give it anything this step doesn't list. If the prompt asks for sources, use a tool that can browse the web.`,
      );
      out.push(
        `## Attach or paste these files\n\n${
          files.length ? `${list(files)}\n\nAttach each file, or paste its full text, before the prompt.` : "None. This step starts from the prompt alone."
        }`,
      );
      const hasMarker = Object.values(c.markers).some((m) => prompt.includes(m));
      out.push(
        `## Prompt\n\n${fence(prompt)}${hasMarker ? `\n\nReplace the ${code("[YOUR …]")} markers with your answers from ${c.hasFillIn ? r.ref("00-fill-in.md") : "your notes"}.` : ""}`,
      );
      out.push(
        `## Save the reply as ${code(step.output.file)}\n\nSave the complete reply as ${code(step.output.file)} (${outputTitle(step)}), with nothing before or after it.` +
          (step.wordLimit ? ` The prompt asks for at most ${step.wordLimit} words; if the reply is much longer, ask the chat to shorten it.` : ""),
      );
      if (step.checklist?.length) {
        out.push(`## Check the reply\n\n${list(step.checklist.map((x) => `[ ] ${x}`))}`);
      }
      if (step.signals?.length) {
        out.push(`## What to look for\n\n${step.signals.map((s) => signalSection(c, step, s, r)).join("\n\n")}`);
      }
      return out.join("\n\n");
    },
  };
}

/** The text a review field contributes to the output, with fill-in markers. */
function fieldMarker(c: Ctx, f: HumanField, r: Refs): string {
  if (f.type === "decision") return f.options.map((o) => `- [ ] ${o.label}`).join("\n");
  if (f.type === "questions") {
    const src = c.stepById.get(f.fromStep);
    const n = Math.max(f.count ?? 3, 1);
    return Array.from(
      { length: n },
      (_, i) => `- Q${i + 1}: [QUESTION ${i + 1}${src ? ` FROM ${src.output.file.toUpperCase()}` : ""}]\n  - **Answer:** [YOUR ANSWER, OR "UNKNOWN"]`,
    ).join("\n");
  }
  if (f.questionsFrom) {
    const src = c.stepById.get(f.questionsFrom);
    return `Questions raised:\n[COPY THE QUESTIONS FROM ${src ? src.output.file : "THE FILE"}, NUMBERED]\n\nAnswer:\n\n[${shortLabel(f.label)}]`;
  }
  void r;
  return `- [${shortLabel(f.label)}: ONE POINT PER LINE, OR "None"]`;
}

function humanStepDoc(c: Ctx, step: TemplateStep): Doc {
  const idx = c.pos.get(step.id)!;
  const title = `Step ${pad(idx)} — ${step.label} (you do this one)`;
  return {
    path: c.docPath.get(step.id)!,
    title,
    body: (r) => {
      const fields = step.fields ?? [];
      const out: string[] = [`# ${title}`];
      if (step.description?.trim()) out.push(step.description.trim());
      if (!/\bno ai\b/i.test(step.description ?? "")) out.push(`This step is a worksheet for you to fill in yourself. No AI chat is involved.`);

      const ins = inputLines(c, step.inputs ?? [], false);
      const opt = inputLines(c, step.optionalInputs ?? [], true);
      if (ins.length || opt.length) out.push(`## Read these first\n\n${list([...ins, ...opt])}`);

      const parts = fields.map((f, i) => {
        const p = [`### ${i + 1}. ${oneLine(f.label)}`];
        if (f.help?.trim()) p.push(oneLine(f.help));
        if (f.type === "text") {
          if (f.questionsFrom) {
            const src = c.stepById.get(f.questionsFrom);
            p.push(`Copy the questions from ${src ? code(src.output.file) : "the file"} (the numbered list under its questions heading), then write your answers underneath them.`);
          }
          if (f.placeholder?.trim()) p.push(`Hint: *${oneLine(f.placeholder)}*`);
        } else if (f.type === "questions") {
          const src = c.stepById.get(f.fromStep);
          p.push(`Copy the questions from ${src ? code(src.output.file) : "the file"} and answer each one. Write "Unknown" for any you can't answer.`);
        } else {
          p.push(
            `Choose one:\n\n${f.options
              .map((o) => {
                const next = c.t.steps[idx];
                const effect =
                  o.effect === "continue"
                    ? next
                      ? `go on to step ${pad(idx + 1)} (${r.ref(c.docPath.get(next.id)!)})`
                      : "this finishes the workflow"
                    : o.effect === "loop"
                      ? `start another round (see ${r.ref(NEXT_ROUND)})`
                      : o.effect === "pause"
                        ? "stop for now and come back to this later"
                        : "end the workflow here";
                return `- **${oneLine(o.label)}**${o.description ? `: ${oneLine(o.description)}` : ""} Next: ${effect}.`;
              })
              .join("\n")}`,
          );
        }
        return p.join("\n\n");
      });
      out.push(`## Fill in each part\n\n${parts.join("\n\n")}`);

      const vars: Record<string, string> = { ...c.vars };
      for (const f of fields) vars[f.key] = fieldMarker(c, f, r);
      const body = step.outputTemplate
        ? renderTemplate(step.outputTemplate, vars).trim()
        : [`# ${step.label}`, ...fields.map((f) => `## ${f.label}\n${vars[f.key]}`)].join("\n\n");
      out.push(
        `## Save your answers as ${code(step.output.file)}\n\nCopy the text below into a new file, replace each marker in square brackets with your answer, tick one choice with an ${code("x")}, and save it as ${code(step.output.file)}.\n\n${fence(body)}`,
      );
      return out.join("\n\n");
    },
  };
}

/** Where a loop option sends carried files, as step ids. Default: the first AI step. */
function carryTargets(c: Ctx, o: DecisionOption): TemplateStep[] {
  const ids = o.carryInto?.length ? o.carryInto : [c.t.steps.find((s) => s.kind === "ai")?.id ?? ""];
  return ids.map((id) => c.stepById.get(id)).filter((s): s is TemplateStep => Boolean(s && s.kind === "ai"));
}

function nextRoundDoc(c: Ctx): Doc {
  return {
    path: NEXT_ROUND,
    title: "Next round: running the workflow again",
    body: (r) => {
      const out: string[] = [`# Next round: running the workflow again`];
      out.push(
        `Some choices in this workflow send you back to the start with everything learned so far. Each pass is a **round**. What you've done so far is round 1; the next is round 2, and so on.`,
      );
      out.push(
        `In a new round you repeat the steps from the beginning with the same fill-in answers. What changes is that the first steps also receive the previous round's files, so they build on that work instead of starting over, and their prompts have an extra paragraph that says so.`,
      );
      const many = c.loopOptions.length > 1;
      c.loopOptions.forEach(({ step, option }) => {
        const stepIdx = c.pos.get(step.id)!;
        const carry = option.carry?.length
          ? option.carry.filter((id) => c.stepById.has(id))
          : c.t.steps.slice(0, stepIdx).map((s) => s.id);
        const carried = carry.map((id) => c.stepById.get(id)!).filter(Boolean);
        const targets = carryTargets(c, option);
        const h = many ? "###" : "##";
        out.push(`${h} ${many ? `If you choose “${oneLine(option.label)}” in step ${pad(stepIdx)}` : "How to start the next round"}`);
        out.push(
          `1. Finish step ${pad(stepIdx)} (${r.ref(c.docPath.get(step.id)!)}) and choose “${oneLine(option.label)}”.\n2. Keep this round's files, renamed with a ${code("round-1_")} prefix so they can't be mistaken for the new round's files:\n\n${list(
            carried.map((s) => `${code(s.output.file)} → ${code("round-1_" + s.output.file)}`),
            "   -",
          )}\n\n3. Start again at the first step. Do every step as before, with fresh chats. Save the new replies under the normal file names.\n4. ${
            targets.length
              ? `${targets.map((s) => `Step ${pad(c.pos.get(s.id)!)}`).join(" and ")} also ${targets.length === 1 ? "receives" : "receive"} the carried files (listed first, before the usual files) and ${targets.length === 1 ? "uses" : "use"} the round-2 version of the prompt below.`
              : "No step receives them, so skip this."
          }\n5. For a third round, repeat this with ${code("round-2_")} as the prefix, and so on. Each round only carries the previous round's files.`,
        );
        const carriedFiles = carried.map((s) => "round-1_" + s.output.file);
        for (const s of targets) {
          const prompt = renderTemplate(s.prompt ?? "", { ...c.vars, round: "2", prevRound: "1", priorRound: "yes" });
          const regular = [...(s.inputs ?? [])].map((id) => c.stepById.get(id)!.output.file);
          out.push(
            `${h}# Round 2: step ${pad(c.pos.get(s.id)!)} — ${s.label}\n\nAttach or paste these files (carried files first): ${[...carriedFiles, ...regular].map(code).join(", ")}.\n\n${fence(prompt)}\n\nFor round 3, change ${code("round-1_")} to ${code("round-2_")} and ${code("round 2")} to ${code("round 3")} where they appear in the prompt. Save the reply as ${code(s.output.file)}, as usual.`,
          );
        }
      });
      return out.join("\n\n");
    },
  };
}

function followUpDoc(c: Ctx): Doc {
  return {
    path: FOLLOW_UP,
    title: "Follow-up research",
    body: (r) => {
      const out: string[] = [`# Follow-up research`];
      out.push(
        `Some steps end by recommending that you **investigate further**. Before you start a whole new round${c.loopOptions.length ? ` (see ${r.ref(NEXT_ROUND)})` : ""}, you can run one short research session on just the open questions, then repeat that step with the findings. Skip this if you'd rather accept the result as it stands.`,
      );
      const setup = c.t.variables.map((v) => `- ${oneLine(v.label.replace(/\s*\((optional|required)\)\s*$/i, ""))}: ${c.markers[v.key]}`);
      for (const s of c.followUpSteps) {
        const pos = pad(c.pos.get(s.id)!);
        const prev = `follow-up_previous_${s.output.file}`;
        out.push(`## After step ${pos} — ${s.label}`);
        out.push(`### 1. Write down your answers`);
        out.push(
          `Make a file ${code("follow-up_answers.md")} with the open questions from ${code(s.output.file)} (the numbered list under its questions heading) and your answers or any new facts:\n\n${fence(
            "# Follow-up: your answers\n\n## Open questions\n\n1. [COPY THE FIRST QUESTION]\n2. [COPY THE NEXT QUESTION]\n\n## Answers and new facts from the user\n\n[YOUR ANSWERS. WRITE “NONE” IF YOU HAVE NOTHING TO ADD]",
          )}`,
        );
        out.push(
          `### 2. Research the open questions\n\nStart a fresh chat in a tool that can browse the web. Attach ${code(s.output.file)} and ${code("follow-up_answers.md")}, then paste:\n\n${fence(followUpPrompt(s, setup))}\n\nSave the reply as ${code("follow-up_research.md")}.`,
        );
        const prompt = renderTemplate(s.prompt ?? "", { ...c.vars, followUp: "yes" });
        out.push(
          `### 3. Run step ${pos} again\n\nStart another fresh chat. Rename your earlier ${code(s.output.file)} to ${code(prev)}. Attach step ${pos}'s usual files (${
            (s.inputs ?? []).length ? (s.inputs ?? []).map((id) => code(c.stepById.get(id)!.output.file)).join(", ") : "none"
          }) plus ${code(prev)}, ${code("follow-up_answers.md")} and ${code("follow-up_research.md")}. Paste this version of the prompt, which tells the chat how to use the new files:\n\n${fence(prompt)}\n\nSave the new reply as ${code(s.output.file)}.`,
        );
        out.push(
          `You can skip the research session and do step ${pos} again with only ${code(prev)} and ${code("follow-up_answers.md")}, if your own answers are all that was missing. Doing this more than once rarely helps: if the step still says to investigate further, either accept its result or start a full new round.`,
        );
      }
      return out.join("\n\n");
    },
  };
}

// ---------- Assembling a bundle ----------

function buildDocs(t: WorkflowTemplate): { docs: Doc[]; ctx: Ctx } {
  const markers = markerFor(t);
  const vars: Record<string, string> = { ...markers, round: "1", prevRound: "", priorRound: "", followUp: "" };
  stepLabels = labelSteps(t);
  const pos = new Map<string, number>();
  const stepById = new Map<string, TemplateStep>();
  const docPath = new Map<string, string>();
  t.steps.forEach((s, i) => {
    pos.set(s.id, i + 1);
    stepById.set(s.id, s);
    docPath.set(s.id, `${pad(i + 1)}-${slugify(s.label)}.md`); // after labelSteps
  });
  const loopOptions: Ctx["loopOptions"] = [];
  for (const s of t.steps)
    for (const f of s.fields ?? []) if (f.type === "decision") for (const o of f.options) if (o.effect === "loop") loopOptions.push({ step: s, option: o });
  const followUpSteps = t.steps.filter((s) => s.kind === "ai" && s.signals?.some((g) => g.followUp?.length));
  const ctx: Ctx = { t, markers, pos, docPath, stepById, vars, hasFillIn: t.variables.length > 0, loopOptions, followUpSteps };

  const docs: Doc[] = [readmeDoc(ctx)];
  if (ctx.hasFillIn) docs.push(fillInDoc(ctx));
  for (const s of t.steps) docs.push(s.kind === "ai" ? aiStepDoc(ctx, s) : humanStepDoc(ctx, s));
  if (loopOptions.length) docs.push(nextRoundDoc(ctx));
  if (followUpSteps.length) docs.push(followUpDoc(ctx));
  return { docs, ctx };
}

const clean = (s: string) => s.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim() + "\n";

function exportWorkflow(t: WorkflowTemplate): { path: string; content: string }[] {
  const { docs } = buildDocs(t);
  const id = slugify(t.id);


  const folderRefs: Refs = {
    ref: (p) => code(p),
    link: (p, text) => `[${text}](${p})`,
  };
  const titleOf = new Map(docs.map((d) => [d.path, d.title]));
  const singleRefs: Refs = {
    ref: (p) => `“${titleOf.get(p) ?? p}”`,
    link: (p, text) => `[${text}](${anchor(titleOf.get(p) ?? p)})`,
  };

  const written: { path: string; content: string }[] = [];
  for (const d of docs) {
    written.push({ path: `${id}/${d.path}`, content: clean(d.body(folderRefs)) });
  }

  const toc = docs.map((d) => `- [${d.title}](${anchor(d.title)})`).join("\n");
  const single =
    `# ${t.title} — all in one file\n\nThis is the whole prompt bundle for ${code(t.id)} in a single document. Each section below is one file of the folder version. Save replies under the file names the steps give.\n\n## Contents\n\n${toc}\n\n` +
    docs.map((d) => `---\n\n${d.body(singleRefs)}`).join("\n\n");
  written.push({ path: `${id}.md`, content: clean(single) });
  return written;
}


return exportWorkflow(template);
}

export function singleFileBundle(t: WorkflowTemplate): { fileName: string; content: string } {
  const file = bundleFiles(t).at(-1)!;
  return { fileName: file.path, content: file.content };
}
