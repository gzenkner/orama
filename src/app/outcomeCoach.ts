import type { Outcome, OutcomeCoachMessage, OutcomeCoachThread } from "./types";

export const DEFAULT_COACH_MODEL = "gemma3:12b";
export const COACH_MODEL_STORAGE_KEY = "orama_coach_model_v1";
export const OUTCOME_COACH_THREAD_VERSION = 3;

const browserAbortControllers = new Map<string, AbortController>();

type OllamaTagsResponse = {
  models?: Array<{ name?: string }>;
};

type OllamaChatResponse = {
  model?: string;
  message?: {
    content?: string;
  };
};

export type ModelListResponse = {
  models: string[];
  defaultModel: string;
};

export type WarmupResponse = {
  model: string;
  status: string;
};

export type OutcomeCoachTurnRequest = {
  requestId: string;
  model: string;
  outcome: {
    title: string;
    notes: string;
    startDate: string;
    endDate: string;
    daysOfWeek: number[];
  };
  currentDraft?: string;
  messages: Array<{
    role: OutcomeCoachMessage["role"];
    content: string;
  }>;
};

export type OutcomeCoachTurnResponse = {
  model: string;
  reply: string;
  draftDescription: string;
};

type OutcomeCoachPayload = {
  reply?: string;
  draftDescription?: string;
};

const COACH_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "draftDescription"],
  properties: {
    reply: { type: "string" },
    draftDescription: { type: "string" }
  }
} as const;

const BROWSER_COACH_SYSTEM_PROMPT = [
  "You are Orama's outcome coach.",
  "Talk like a direct teammate in a real chat.",
  "Use short sentences.",
  "Keep replies concise.",
  "Do not flatter the user.",
  "Do not hype them up.",
  "Do not say things like wow, amazing, or great experience.",
  "Do not use bullets in the chat unless the user asks for them.",
  "Do not sound like a framework or a questionnaire.",
  "Ask one focused follow-up at a time when needed.",
  "Do not rush to summarize after one or two answers.",
  "Do not ask 'does that feel right' too early.",
  "Keep guiding until you have enough detail to build a useful planning brief.",
  "Adapt immediately when the user asks for simpler, shorter, or more direct language.",
  "Read short or fragmentary answers in context.",
  "If the user says things like 'location wise', 'comp wise', or 'team wise', treat that as a constraint on the previous point, not as a brand new topic.",
  "If the user's meaning is directionally clear, make the reasonable interpretation and move forward.",
  "Do not get stuck on pedantic clarifications.",
  "Say the interpretation plainly, then ask the next useful question.",
  "Your job is not just to polish one sentence.",
  "Your job is to help the user turn an outcome into a comprehensive goal brief they can later break into months, weeks, and days.",
  "Pull out the finish line, why it matters, constraints, non-negotiables, strengths to lean on, gaps to close, proof to build, and the main goals that need to happen before the deadline.",
  "When the user is talking about a career move, role search, or project, help define the actual goals and proof needed to land it.",
  "For career outcomes, usually cover the target role, location or time-zone limits, compensation, company or work preferences, strengths to lean on, gaps to close, proof to build, and the search or interview goals.",
  "Once role and location are roughly clear, move quickly into proof, gaps, and the major goals needed to land the role.",
  "Example: if the user says 'I want a remote data engineer role, location wise' and then 'UTC +/- 2 hours', interpret that as a remote role with working-hours overlap close to UTC and move on.",
  "Maintain a working draft that gets richer as the conversation gets richer.",
  "The draftDescription should be something the user can save as the outcome description and later use for planning.",
  "The draftDescription should be more than a slogan. It should read like a practical goal brief.",
  "Use short labeled sections in the draftDescription when helpful.",
  "Return valid JSON only."
].join("\n");

function nowISO(): string {
  return new Date().toISOString();
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `coach_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function cleanText(value: string): string {
  return value.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

function buildMessage(role: OutcomeCoachMessage["role"], content: string): OutcomeCoachMessage {
  return {
    id: makeId(),
    role,
    content: cleanText(content),
    createdAt: nowISO()
  };
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

function normalizeOutcomeCoachPayload(payload: OutcomeCoachPayload): OutcomeCoachTurnResponse {
  const reply = cleanText(payload.reply ?? "");
  const draftDescription = cleanText(payload.draftDescription ?? "");

  if (!reply) {
    throw new Error("The model responded, but it did not return a usable reply.");
  }

  if (!draftDescription) {
    throw new Error("The model responded, but it did not return a usable outcome description.");
  }

  return {
    model: "",
    reply,
    draftDescription
  };
}

function buildCoachUserPrompt(request: OutcomeCoachTurnRequest): string {
  const transcript = request.messages
    .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content.trim()}`)
    .join("\n\n");

  return [
    "Outcome",
    `Title: ${request.outcome.title}`,
    `Date range: ${request.outcome.startDate} - ${request.outcome.endDate}`,
    `Active days: ${request.outcome.daysOfWeek.join(", ")}`,
    request.outcome.notes.trim() ? `Saved description:\n${request.outcome.notes.trim()}` : "",
    request.currentDraft?.trim() ? `Current working draft:\n${request.currentDraft.trim()}` : "",
    "Interpretation notes",
    "User replies may be short fragments that modify the previous point.",
    "Prefer a reasonable interpretation over a pedantic clarification when the user's direction is clear.",
    "",
    "Conversation",
    transcript
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as Window & typeof globalThis & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

function ollamaHost(): string {
  const configured = import.meta.env.VITE_OLLAMA_HOST as string | undefined;
  return (configured || "http://127.0.0.1:11434").replace(/\/$/, "");
}

export async function listBrowserModels(): Promise<ModelListResponse> {
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
    defaultModel: models.includes(DEFAULT_COACH_MODEL) ? DEFAULT_COACH_MODEL : models[0]
  };
}

export async function warmBrowserModel(model: string): Promise<WarmupResponse> {
  const response = await fetch(`${ollamaHost()}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: "Coach warmup. Reply only with READY.",
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

export async function runBrowserOutcomeCoachTurn(request: OutcomeCoachTurnRequest): Promise<OutcomeCoachTurnResponse> {
  const controller = new AbortController();
  browserAbortControllers.set(request.requestId, controller);

  try {
    const response = await fetch(`${ollamaHost()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: request.model,
        stream: false,
        keep_alive: "1h",
        format: COACH_RESPONSE_SCHEMA,
        options: {
          temperature: 0.35
        },
        messages: [
          { role: "system", content: BROWSER_COACH_SYSTEM_PROMPT },
          { role: "user", content: buildCoachUserPrompt(request) }
        ]
      })
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Stopped.");
      }
      throw error;
    });

    if (!response.ok) {
      throw new Error(`Could not reach the Ollama HTTP API (${response.status}).`);
    }

    const payload = (await response.json()) as OllamaChatResponse;
    const jsonBlock = extractJsonBlock(payload.message?.content || "");
    const parsed = JSON.parse(jsonBlock) as OutcomeCoachPayload;
    const normalized = normalizeOutcomeCoachPayload(parsed);

    return {
      ...normalized,
      model: payload.model || request.model
    };
  } finally {
    browserAbortControllers.delete(request.requestId);
  }
}

export function createOutcomeCoachThread(outcome: Outcome): OutcomeCoachThread {
  const intro = outcome.notes.trim()
    ? "What is still missing from this outcome?"
    : "What outcome are we working toward?";

  return {
    version: OUTCOME_COACH_THREAD_VERSION,
    outcomeId: outcome.id,
    messages: [buildMessage("assistant", intro)],
    pendingUserMessage: undefined,
    pendingRequestId: undefined,
    pendingModel: undefined,
    pendingSince: undefined,
    lastError: undefined,
    answers: {},
    activeTopicId: undefined,
    draftDescription: cleanText(outcome.notes),
    lastUpdatedAt: nowISO()
  };
}

export function startOutcomeCoachTurn(
  thread: OutcomeCoachThread,
  userInput: string,
  requestId: string,
  model: string
): OutcomeCoachThread {
  const startedAt = nowISO();
  return {
    ...thread,
    pendingUserMessage: buildMessage("user", userInput),
    pendingRequestId: requestId,
    pendingModel: model,
    pendingSince: startedAt,
    lastError: undefined,
    lastUpdatedAt: startedAt
  };
}

export function appendOutcomeCoachTurn(
  thread: OutcomeCoachThread,
  requestId: string,
  response: OutcomeCoachTurnResponse
): OutcomeCoachThread {
  if (!thread.pendingUserMessage || thread.pendingRequestId !== requestId) return thread;

  return {
    ...thread,
    messages: [...thread.messages, thread.pendingUserMessage, buildMessage("assistant", response.reply)],
    pendingUserMessage: undefined,
    pendingRequestId: undefined,
    pendingModel: undefined,
    pendingSince: undefined,
    lastError: undefined,
    appliedAt: undefined,
    draftDescription: cleanText(response.draftDescription),
    lastUpdatedAt: nowISO()
  };
}

export function failOutcomeCoachTurn(thread: OutcomeCoachThread, requestId: string, message: string): OutcomeCoachThread {
  if (thread.pendingRequestId !== requestId) return thread;

  return {
    ...thread,
    messages: thread.pendingUserMessage ? [...thread.messages, thread.pendingUserMessage] : thread.messages,
    pendingUserMessage: undefined,
    pendingRequestId: undefined,
    pendingModel: undefined,
    pendingSince: undefined,
    lastError: cleanText(message),
    lastUpdatedAt: nowISO()
  };
}

export function cancelBrowserOutcomeCoachTurn(requestId: string): void {
  const controller = browserAbortControllers.get(requestId);
  if (!controller) return;
  controller.abort();
  browserAbortControllers.delete(requestId);
}

export function markOutcomeCoachApplied(thread: OutcomeCoachThread): OutcomeCoachThread {
  const timestamp = nowISO();
  return {
    ...thread,
    appliedAt: timestamp,
    lastUpdatedAt: timestamp
  };
}
