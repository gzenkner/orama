import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { formatDaysOfWeek, formatMonthLabel, formatShortDate, monthKeysInRange } from "../date";
import { MONTHLY_WIZARD_CONTEXT } from "../prompts/monthlyWizardContext";
import { actions, useAppState } from "../store";
import type { Outcome, WeekStartsOn } from "../types";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Textarea from "../ui/Textarea";
import { cn } from "../ui/cn";

const DEFAULT_MODEL = "gemma3:12b";
const BROWSER_LOG_KEY = "orama_monthly_wizard_log_v1";
const BROWSER_LOG_PATH = "browser-storage://orama_monthly_wizard_log_v1";

type WizardTarget = {
  id: string;
  label: string;
  currentValue?: string | null;
};

type MonthlyWizardRequest = {
  model: string;
  context: string;
  months: WizardTarget[];
  extraContext?: string;
};

type MonthlyMilestone = {
  id: string;
  title: string;
  rationale: string;
};

type ModelListResponse = {
  models: string[];
  defaultModel: string;
};

type WarmupResponse = {
  model: string;
  status: string;
};

type MonthlyWizardResponse = {
  model: string;
  summary: string;
  milestones: MonthlyMilestone[];
  logPath?: string | null;
  logWarning?: string | null;
};

type WizardLogResponse = {
  path?: string | null;
  status: string;
  warning?: string | null;
};

type OllamaTagsResponse = {
  models?: Array<{ name?: string }>;
};

type OllamaChatResponse = {
  model?: string;
  message?: {
    content?: string;
  };
};

type MonthlyPayload = {
  summary?: string;
  milestones?: Array<{
    id?: string;
    title?: string;
    rationale?: string;
  }>;
};

type Props = {
  outcome: Outcome;
  weekStartsOn: WeekStartsOn;
};

const MONTHLY_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "milestones"],
  properties: {
    summary: { type: "string" },
    milestones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "rationale"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          rationale: { type: "string" }
        }
      }
    }
  }
} as const;

const BROWSER_SYSTEM_PROMPT = [
  "You are Orama's monthly milestone planner.",
  "Break one outcome into one strong milestone for each target month.",
  "Sequence the milestones so earlier months set up later months and the final month points at the finish line.",
  "Keep milestone titles short, concrete, and distinct.",
  "Avoid vague filler like 'make progress', 'stay consistent', or 'maintain momentum' unless the milestone names the real work.",
  "Respect the provided month IDs exactly and keep their order.",
  "Return valid JSON only."
].join("\n");

function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as Window & typeof globalThis & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

function ollamaHost(): string {
  const configured = import.meta.env.VITE_OLLAMA_HOST as string | undefined;
  return (configured || "http://127.0.0.1:11434").replace(/\/$/, "");
}

function compactText(value: string, limit: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit).trimEnd()}...`;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function buildPlanningContext(outcome: Outcome, months: WizardTarget[]): string {
  const existing = months
    .filter((month) => month.currentValue?.trim())
    .map((month) => `- ${month.label}: ${month.currentValue?.trim()}`)
    .join("\n");

  return [
    MONTHLY_WIZARD_CONTEXT,
    "",
    "Outcome",
    `Title: ${outcome.title}`,
    `Date range: ${formatShortDate(outcome.startDate)} - ${formatShortDate(outcome.endDate)}`,
    `Cadence: ${formatDaysOfWeek(outcome.daysOfWeek)}`,
    outcome.notes.trim() ? `Notes: ${compactText(outcome.notes, 700)}` : "",
    existing ? `Existing monthly titles:\n${existing}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function buildMonthlyUserPrompt(request: MonthlyWizardRequest): string {
  const sections = [
    "Planning context:",
    request.context.trim(),
    "",
    "Target months:",
    JSON.stringify(request.months, null, 2)
  ];

  if (request.extraContext?.trim()) {
    sections.push("");
    sections.push("Extra guidance:");
    sections.push(request.extraContext.trim());
  }

  return sections.join("\n");
}

function extractJsonBlock(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("The Ollama response was empty.");

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    const pairs: Array<[string, string]> = [
      ["{", "}"],
      ["[", "]"]
    ];

    for (const [open, close] of pairs) {
      const start = trimmed.indexOf(open);
      if (start < 0) continue;

      let depth = 0;
      for (let index = start; index < trimmed.length; index += 1) {
        const char = trimmed[index];
        if (char === open) depth += 1;
        if (char === close) depth -= 1;
        if (depth === 0) {
          const candidate = trimmed.slice(start, index + 1);
          try {
            JSON.parse(candidate);
            return candidate;
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error("The Ollama response was not valid JSON.");
}

function normalizeMonthlyPayload(payload: MonthlyPayload, months: WizardTarget[]): MonthlyWizardResponse {
  const payloadMap = new Map(
    (payload.milestones || [])
      .filter((item): item is { id: string; title?: string; rationale?: string } => typeof item.id === "string")
      .map((item) => [item.id, item])
  );

  const milestones = months
    .map((month) => {
      const item = payloadMap.get(month.id);
      const title = item?.title?.trim() || "";
      if (!title) return null;
      return {
        id: month.id,
        title,
        rationale: item?.rationale?.trim() || ""
      };
    })
    .filter((item): item is MonthlyMilestone => Boolean(item));

  if (!milestones.length) {
    throw new Error("The model responded, but it did not return any usable monthly milestones.");
  }

  return {
    model: "",
    summary: payload.summary?.trim() || "I mapped the outcome into monthly milestones.",
    milestones
  };
}

async function listBrowserModels(): Promise<ModelListResponse> {
  const response = await fetch(`${ollamaHost()}/api/tags`);
  if (!response.ok) {
    throw new Error(`Could not load models from the Ollama HTTP API (${response.status}).`);
  }

  const payload = (await response.json()) as OllamaTagsResponse;
  const models = (payload.models || [])
    .map((entry) => entry.name?.trim() || "")
    .filter(Boolean);

  if (!models.length) {
    throw new Error("The Ollama HTTP API did not return any installed models.");
  }

  return {
    models,
    defaultModel: models.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : models[0]
  };
}

async function warmBrowserModel(model: string): Promise<WarmupResponse> {
  const response = await fetch(`${ollamaHost()}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: "Planning assistant warmup. Reply only with READY.",
      stream: false,
      keep_alive: "1h"
    })
  });

  if (!response.ok) {
    throw new Error(`Could not warm ${model} through the Ollama HTTP API (${response.status}).`);
  }

  return {
    model,
    status: "ready"
  };
}

async function runBrowserMonthlyPlan(request: MonthlyWizardRequest): Promise<MonthlyWizardResponse> {
  const response = await fetch(`${ollamaHost()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: request.model,
      stream: false,
      keep_alive: "1h",
      format: MONTHLY_PLAN_SCHEMA,
      options: {
        temperature: 0.2
      },
      messages: [
        { role: "system", content: BROWSER_SYSTEM_PROMPT },
        { role: "user", content: buildMonthlyUserPrompt(request) }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Could not reach the Ollama HTTP API (${response.status}).`);
  }

  const payload = (await response.json()) as OllamaChatResponse;
  const jsonBlock = extractJsonBlock(payload.message?.content || "");
  const parsed = JSON.parse(jsonBlock) as MonthlyPayload;
  const normalized = normalizeMonthlyPayload(parsed, request.months);

  return {
    ...normalized,
    model: payload.model || request.model
  };
}

function appendBrowserLog(kind: string, content: string): string {
  const raw = localStorage.getItem(BROWSER_LOG_KEY);
  const entries = raw ? (JSON.parse(raw) as Array<{ ts: string; kind: string; content: string }>) : [];
  entries.unshift({
    ts: new Date().toISOString(),
    kind,
    content
  });
  localStorage.setItem(BROWSER_LOG_KEY, JSON.stringify(entries.slice(0, 50)));
  return BROWSER_LOG_PATH;
}

function buildGenerationLog(outcome: Outcome, model: string, summary: string, milestones: MonthlyMilestone[], extraContext: string): string {
  return [
    `outcome: ${outcome.title}`,
    `model: ${model}`,
    `range: ${formatShortDate(outcome.startDate)} - ${formatShortDate(outcome.endDate)}`,
    `cadence: ${formatDaysOfWeek(outcome.daysOfWeek)}`,
    `summary: ${summary}`,
    extraContext.trim() ? `extra guidance: ${extraContext.trim()}` : "",
    "",
    "milestones:",
    ...milestones.map((milestone) =>
      milestone.rationale
        ? `- ${milestone.id}: ${milestone.title} | ${milestone.rationale}`
        : `- ${milestone.id}: ${milestone.title}`
    )
  ]
    .filter(Boolean)
    .join("\n");
}

function buildApplyLog(outcome: Outcome, milestones: MonthlyMilestone[]): string {
  return [
    `outcome: ${outcome.title}`,
    `applied: ${milestones.length} ${pluralize(milestones.length, "milestone", "milestones")}`,
    "",
    "milestones:",
    ...milestones.map((milestone) => `- ${milestone.id}: ${milestone.title}`)
  ].join("\n");
}

function ThinkingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 rounded-full bg-current animate-bounce"
          style={{ animationDelay: `${index * 0.14}s`, animationDuration: "0.9s" }}
        />
      ))}
    </span>
  );
}

function MonthCard({
  label,
  currentValue,
  draft,
  onChange
}: {
  label: string;
  currentValue?: string | null;
  draft: MonthlyMilestone;
  onChange: (next: string) => void;
}) {
  return (
    <Card className="rounded-[0.95rem] border border-[color:var(--app-border)] p-3">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        {currentValue?.trim() ? (
          <div className="mt-1 text-[11px] app-muted">Current in plan: {currentValue.trim()}</div>
        ) : (
          <div className="mt-1 text-[11px] app-muted">No monthly milestone set yet.</div>
        )}
      </div>

      <div className="mt-2.5">
        <Input value={draft.title} onChange={(event) => onChange(event.target.value)} placeholder={`Milestone for ${label}`} />
      </div>

      {draft.rationale ? <div className="mt-2.5 text-sm leading-6 app-muted">{draft.rationale}</div> : null}
    </Card>
  );
}

export default function WizardView({ outcome }: Props) {
  const monthly = useAppState((state) => state.monthly);
  const monthKeys = monthKeysInRange(outcome.startDate, outcome.endDate);
  const monthTargets = monthKeys.map((monthKey) => ({
    id: monthKey,
    label: formatMonthLabel(monthKey),
    currentValue: monthly[`${outcome.id}:${monthKey}`]?.title ?? ""
  }));

  const [models, setModels] = React.useState<string[]>([]);
  const [selectedModel, setSelectedModel] = React.useState("");
  const [modelStatus, setModelStatus] = React.useState("Loading local models...");
  const [modelError, setModelError] = React.useState("");
  const [extraContext, setExtraContext] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [draftById, setDraftById] = React.useState<Record<string, MonthlyMilestone>>({});
  const [assistantMessage, setAssistantMessage] = React.useState("");
  const [activityMessage, setActivityMessage] = React.useState("");
  const [runError, setRunError] = React.useState("");
  const [logPath, setLogPath] = React.useState("");
  const [logWarning, setLogWarning] = React.useState("");
  const [loadingModels, setLoadingModels] = React.useState(true);
  const [warmingModel, setWarmingModel] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [applying, setApplying] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      setLoadingModels(true);
      setModelError("");

      try {
        const response = isTauriRuntime()
          ? await invoke<ModelListResponse>("list_ollama_models")
          : await listBrowserModels();

        if (cancelled) return;

        const modelsFromResponse = response.models || [];
        const defaultModel =
          modelsFromResponse.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : response.defaultModel || modelsFromResponse[0] || DEFAULT_MODEL;

        setModels(modelsFromResponse);
        setSelectedModel(defaultModel);
        setModelStatus(
          modelsFromResponse.length
            ? `${defaultModel} selected. ${modelsFromResponse.length} local ${pluralize(modelsFromResponse.length, "model", "models")} available.`
            : "No local models were returned."
        );
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Could not load models.";
        setModelError(message);
        setModelStatus("Could not load models.");
      } finally {
        if (!cancelled) setLoadingModels(false);
      }
    }

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    setSummary("");
    setDraftById({});
    setActivityMessage("");
    setRunError("");
    setLogPath("");
    setLogWarning("");
    setAssistantMessage(
      `I can suggest ${monthTargets.length} monthly ${pluralize(monthTargets.length, "milestone", "milestones")} for ${outcome.title}.`
    );
  }, [monthTargets.length, outcome.id, outcome.title]);

  React.useEffect(() => {
    if (!selectedModel) return;

    let cancelled = false;

    async function warmModel() {
      setWarmingModel(true);

      try {
        const response = isTauriRuntime()
          ? await invoke<WarmupResponse>("warm_planning_model", { model: selectedModel })
          : await warmBrowserModel(selectedModel);

        if (cancelled) return;

        setModelError("");
        if (response.status === "starting") {
          setModelStatus(`Warming ${selectedModel} through Ollama...`);
        } else {
          setModelStatus(`${selectedModel} is ready through Ollama.`);
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : `Could not warm ${selectedModel}.`;
        setModelError(message);
        setModelStatus(message);
      } finally {
        if (!cancelled) setWarmingModel(false);
      }
    }

    void warmModel();

    return () => {
      cancelled = true;
    };
  }, [selectedModel]);

  async function handleGenerate() {
    if (!selectedModel) {
      setRunError("Select an Ollama model before generating monthly milestones.");
      return;
    }

    const request: MonthlyWizardRequest = {
      model: selectedModel,
      context: buildPlanningContext(outcome, monthTargets),
      months: monthTargets,
      extraContext: extraContext.trim() || undefined
    };

    setGenerating(true);
    setRunError("");
    setLogWarning("");
    setActivityMessage("");

    try {
      let response: MonthlyWizardResponse;
      if (isTauriRuntime()) {
        response = await invoke<MonthlyWizardResponse>("wizard_monthly_plan", { request });
      } else {
        response = await runBrowserMonthlyPlan(request);
        response.logPath = appendBrowserLog(
          "monthly_generate",
          buildGenerationLog(outcome, response.model, response.summary, response.milestones, extraContext)
        );
      }

      const nextDraftById = response.milestones.reduce<Record<string, MonthlyMilestone>>((acc, milestone) => {
        acc[milestone.id] = milestone;
        return acc;
      }, {});

      setSummary(response.summary);
      setDraftById(nextDraftById);
      setAssistantMessage(
        `I drafted ${response.milestones.length} monthly ${pluralize(
          response.milestones.length,
          "milestone",
          "milestones"
        )} for ${outcome.title}. Review them below or apply them as-is.`
      );
      setLogPath(response.logPath || "");
      setLogWarning(response.logWarning || "");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not generate monthly milestones.";
      setRunError(message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleApply() {
    const milestonesToApply = monthTargets
      .map((month) => draftById[month.id])
      .filter((milestone): milestone is MonthlyMilestone => Boolean(milestone?.title?.trim()))
      .map((milestone) => ({
        ...milestone,
        title: milestone.title.trim()
      }));

    if (!milestonesToApply.length) {
      setActivityMessage("There was nothing to write into the plan.");
      return;
    }

    setApplying(true);
    setRunError("");

    try {
      for (const milestone of milestonesToApply) {
        actions.setMonthlyTitle(outcome.id, milestone.id, milestone.title);
      }

      let nextLogPath = logPath;
      let nextWarning = "";

      if (isTauriRuntime()) {
        const response = await invoke<WizardLogResponse>("append_wizard_log", {
          kind: "monthly_apply",
          content: buildApplyLog(outcome, milestonesToApply)
        });
        nextLogPath = response.path || nextLogPath;
        nextWarning = response.warning || "";
      } else {
        nextLogPath = appendBrowserLog("monthly_apply", buildApplyLog(outcome, milestonesToApply));
      }

      setLogPath(nextLogPath);
      setLogWarning(nextWarning);
      setActivityMessage(
        nextWarning
          ? `I wrote ${milestonesToApply.length} monthly ${pluralize(
              milestonesToApply.length,
              "milestone",
              "milestones"
            )} into ${outcome.title}, but I could not append the log: ${nextWarning}`
          : `I wrote ${milestonesToApply.length} monthly ${pluralize(
              milestonesToApply.length,
              "milestone",
              "milestones"
            )} into ${outcome.title}.${nextLogPath ? ` Logged at ${nextLogPath}.` : ""}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not apply the monthly milestones.";
      setRunError(message);
    } finally {
      setApplying(false);
    }
  }

  const canGenerate = Boolean(selectedModel) && !generating && !applying && !loadingModels;
  const hasDrafts = Object.keys(draftById).length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 border-b border-[color:var(--app-border)] bg-[color:var(--app-panel)]/92 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{outcome.title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] app-muted">
              <span className="rounded-full border border-[color:var(--outcome-border)] bg-[color:var(--outcome-soft)] px-2.5 py-1 text-[color:var(--outcome-ink)]">
                {formatShortDate(outcome.startDate)} - {formatShortDate(outcome.endDate)}
              </span>
              <span className="rounded-full border border-[color:var(--app-border)] px-2.5 py-1">
                {monthTargets.length} {pluralize(monthTargets.length, "month", "months")}
              </span>
              <span className="rounded-full border border-[color:var(--app-border)] px-2.5 py-1">{formatDaysOfWeek(outcome.daysOfWeek)}</span>
            </div>
          </div>

          <div className="w-full max-w-[220px] shrink-0">
            <label className="sr-only" htmlFor="wizard-model-select">
              Model
            </label>
            <select
              id="wizard-model-select"
              className="app-input h-10 w-full rounded-[0.7rem] px-3 text-sm focus:outline-none"
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
              disabled={!models.length}
            >
              {models.length ? null : <option value="">{loadingModels ? "Loading models..." : "No models"}</option>}
              {models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto grid min-h-full w-full max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-[76px] lg:self-start">
            <Card className="rounded-[1rem] border border-[color:var(--app-border)] p-4">
              <div className="text-sm font-semibold">Monthly planner</div>
              <div className="mt-1 text-sm app-muted">{assistantMessage}</div>

              <div className="mt-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] app-muted">Model</div>
                <div className="mt-2 text-xs app-muted">
                  {modelStatus}
                  {warmingModel ? (
                    <span className="ml-2 inline-flex align-middle">
                      <ThinkingDots />
                    </span>
                  ) : null}
                </div>
                {logPath ? <div className="mt-1 text-[11px] app-muted">Latest log: {logPath}</div> : null}
              </div>

              <div className="mt-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] app-muted">Additional guidance</div>
                <div className="mt-1 text-xs app-muted">Optional steering for the monthly breakdown.</div>
                <div className="mt-2">
                  <Textarea
                    value={extraContext}
                    onChange={(event) => setExtraContext(event.target.value)}
                    placeholder="Example: keep the first month lightweight, front-load setup work, and make the last month clearly outcome-facing."
                    rows={5}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                <Button variant="primary" onClick={() => void handleGenerate()} disabled={!canGenerate}>
                  {generating ? (
                    <span className="inline-flex items-center gap-2">
                      Suggesting
                      <ThinkingDots />
                    </span>
                  ) : (
                    "Suggest monthly milestones"
                  )}
                </Button>
                {hasDrafts ? (
                  <Button variant="secondary" onClick={() => void handleApply()} disabled={applying || generating}>
                    {applying ? (
                      <span className="inline-flex items-center gap-2">
                        Writing
                        <ThinkingDots />
                      </span>
                    ) : (
                      "Apply to plan"
                    )}
                  </Button>
                ) : null}
              </div>

              {summary ? (
                <div className="mt-4 rounded-[0.85rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-3 py-2 text-sm leading-6">
                  {summary}
                </div>
              ) : null}

              {activityMessage ? (
                <div className="mt-3 rounded-[0.85rem] border border-[color:var(--outcome-border)] bg-[color:var(--outcome-soft)] px-3 py-2 text-sm text-[color:var(--outcome-ink)]">
                  {activityMessage}
                </div>
              ) : null}

              {runError ? (
                <div className="mt-3 rounded-[0.85rem] border border-[#d07a7a] bg-[#fff4f4] px-3 py-2 text-sm text-[#7a2f2f]">
                  {runError}
                </div>
              ) : null}

              {modelError ? (
                <div className="mt-3 rounded-[0.85rem] border border-[#d0a05b] bg-[#fff8ec] px-3 py-2 text-sm text-[#7a5421]">
                  {modelError}
                </div>
              ) : null}

              {logWarning ? (
                <div className="mt-3 rounded-[0.85rem] border border-[#d0a05b] bg-[#fff8ec] px-3 py-2 text-sm text-[#7a5421]">
                  {logWarning}
                </div>
              ) : null}
            </Card>
          </aside>

          <section className="min-w-0">
            {generating ? (
              <div className="mb-3 rounded-[0.95rem] border border-[color:var(--app-border)] bg-[color:var(--app-card)] px-4 py-3">
                <div className="flex items-center gap-3 text-sm">
                  <ThinkingDots />
                  <span>Generating monthly milestones...</span>
                </div>
              </div>
            ) : null}

            {hasDrafts ? (
              <div className="grid gap-3 md:grid-cols-2">
                {monthTargets.map((month) => {
                  const draft = draftById[month.id] ?? {
                    id: month.id,
                    title: "",
                    rationale: ""
                  };

                  return (
                    <MonthCard
                      key={month.id}
                      label={month.label}
                      currentValue={month.currentValue}
                      draft={draft}
                      onChange={(next) =>
                        setDraftById((prev) => ({
                          ...prev,
                          [month.id]: {
                            ...draft,
                            title: next
                          }
                        }))
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {monthTargets.map((month) => (
                  <Card key={month.id} className="rounded-[0.95rem] border border-dashed border-[color:var(--app-border)] p-3">
                    <div className="text-sm font-semibold">{month.label}</div>
                    <div className="mt-2 text-sm app-muted">
                      {month.currentValue?.trim() ? `Current in plan: ${month.currentValue.trim()}` : "No milestone suggested yet."}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
