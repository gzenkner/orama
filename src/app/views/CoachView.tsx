import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { actions, getAppState, useAppState } from "../store";
import {
  appendOutcomeCoachTurn,
  cancelBrowserOutcomeCoachTurn,
  COACH_MODEL_STORAGE_KEY,
  createOutcomeCoachThread,
  DEFAULT_COACH_MODEL,
  failOutcomeCoachTurn,
  isTauriRuntime,
  listBrowserModels,
  markOutcomeCoachApplied,
  OUTCOME_COACH_THREAD_VERSION,
  runBrowserOutcomeCoachTurn,
  startOutcomeCoachTurn,
  warmBrowserModel,
  type ModelListResponse,
  type OutcomeCoachTurnRequest,
  type OutcomeCoachTurnResponse,
  type WarmupResponse
} from "../outcomeCoach";
import type { Outcome, OutcomeCoachMessage, OutcomeCoachThread } from "../types";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Textarea from "../ui/Textarea";
import { cn } from "../ui/cn";

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function normalizeCompare(value: string): string {
  return value.trim().replace(/\r\n/g, "\n");
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

function MessageBubble({ message }: { message: OutcomeCoachMessage }) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={cn("flex", isAssistant ? "justify-start" : "justify-end")}>
      <div className={cn("app-chat-bubble max-w-[min(44rem,88%)] px-4 py-3", isAssistant ? "app-chat-bubble-assistant" : "app-chat-bubble-user")}>
        <div className="whitespace-pre-wrap text-[1.02rem] leading-7 sm:text-[1.08rem]">{message.content}</div>
      </div>
    </div>
  );
}

function LoadingBubble() {
  return (
    <div className="flex justify-start">
      <div className="app-chat-bubble app-chat-bubble-assistant inline-flex items-center px-4 py-4">
        <ThinkingDots className="text-[color:var(--app-subtle)]" />
      </div>
    </div>
  );
}

function makeRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `coach_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export default function CoachView({ outcome }: { outcome: Outcome }) {
  const coachThreads = useAppState((s) => s.coachThreads);
  const rawStoredThread = coachThreads[outcome.id];
  const storedThread = rawStoredThread?.version === OUTCOME_COACH_THREAD_VERSION ? rawStoredThread : undefined;
  const seededThread = React.useMemo(
    () => createOutcomeCoachThread(outcome),
    [outcome.daysOfWeek, outcome.endDate, outcome.id, outcome.notes, outcome.startDate, outcome.title]
  );
  const thread = storedThread ?? seededThread;
  const currentDraft = thread.draftDescription.trim();
  const savedDescription = outcome.notes.trim();
  const draftAlreadyApplied = normalizeCompare(savedDescription) === normalizeCompare(currentDraft);
  const [composer, setComposer] = React.useState("");
  const [models, setModels] = React.useState<string[]>([]);
  const [selectedModel, setSelectedModel] = React.useState("");
  const [loadingModels, setLoadingModels] = React.useState(true);
  const [warmingModel, setWarmingModel] = React.useState(false);
  const [modelError, setModelError] = React.useState("");
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const mountedRef = React.useRef(true);
  const sending = Boolean(thread.pendingRequestId);
  const visibleMessages = thread.pendingUserMessage ? [...thread.messages, thread.pendingUserMessage] : thread.messages;

  React.useEffect(() => {
    if (storedThread) return;
    actions.setOutcomeCoachThread(outcome.id, seededThread);
  }, [outcome.id, seededThread, storedThread]);

  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    setComposer("");
  }, [outcome.id]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [outcome.id, thread.messages.length, thread.pendingUserMessage?.id]);

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

        const savedModel = typeof window === "undefined" ? "" : localStorage.getItem(COACH_MODEL_STORAGE_KEY) || "";
        const modelsFromResponse = response.models || [];
        const fallbackModel =
          modelsFromResponse.includes(DEFAULT_COACH_MODEL) ? DEFAULT_COACH_MODEL : response.defaultModel || modelsFromResponse[0] || "";
        const nextModel = savedModel && modelsFromResponse.includes(savedModel) ? savedModel : fallbackModel;

        setModels(modelsFromResponse);
        setSelectedModel(nextModel);
      } catch (error) {
        if (cancelled) return;
        setModelError(error instanceof Error ? error.message : "Could not load models.");
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
    if (!selectedModel) return;

    if (typeof window !== "undefined") {
      localStorage.setItem(COACH_MODEL_STORAGE_KEY, selectedModel);
    }

    let cancelled = false;

    async function warmModel() {
      setWarmingModel(true);

      try {
        if (isTauriRuntime()) {
          await invoke<WarmupResponse>("warm_planning_model", { model: selectedModel });
        } else {
          await warmBrowserModel(selectedModel);
        }
        if (cancelled) return;
        setModelError("");
      } catch (error) {
        if (cancelled) return;
        setModelError(error instanceof Error ? error.message : `Could not warm ${selectedModel}.`);
      } finally {
        if (!cancelled) setWarmingModel(false);
      }
    }

    void warmModel();

    return () => {
      cancelled = true;
    };
  }, [selectedModel]);

  function persist(nextThread: OutcomeCoachThread) {
    actions.setOutcomeCoachThread(outcome.id, nextThread);
  }

  async function handleSend() {
    const userInput = composer.trim();
    if (!userInput || !selectedModel || sending) return;

    const requestId = makeRequestId();
    const startedThread = startOutcomeCoachTurn(thread, userInput, requestId, selectedModel);
    persist(startedThread);
    setComposer("");

    const request: OutcomeCoachTurnRequest = {
      requestId,
      model: selectedModel,
      outcome: {
        title: outcome.title,
        notes: outcome.notes,
        startDate: outcome.startDate,
        endDate: outcome.endDate,
        daysOfWeek: outcome.daysOfWeek
      },
      currentDraft: startedThread.draftDescription,
      messages: [...startedThread.messages, startedThread.pendingUserMessage]
        .filter((message): message is OutcomeCoachMessage => Boolean(message))
        .map((message) => ({
          role: message.role,
          content: message.content
        }))
    };

    try {
      const response = isTauriRuntime()
        ? await invoke<OutcomeCoachTurnResponse>("coach_outcome_chat", { request })
        : await runBrowserOutcomeCoachTurn(request);

      if (mountedRef.current) setModelError("");
      const latestThread = getAppState().coachThreads[outcome.id] ?? startedThread;
      persist(appendOutcomeCoachTurn(latestThread, requestId, response));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not get a reply from the selected model.";
      const latestThread = getAppState().coachThreads[outcome.id] ?? startedThread;
      persist(failOutcomeCoachTurn(latestThread, requestId, message));
    }
  }

  async function handleStop() {
    const requestId = thread.pendingRequestId;
    if (!requestId) return;

    try {
      if (isTauriRuntime()) {
        await invoke<string>("cancel_coach_outcome_chat", { requestId });
      } else {
        cancelBrowserOutcomeCoachTurn(requestId);
      }

      const latestThread = getAppState().coachThreads[outcome.id] ?? thread;
      persist(failOutcomeCoachTurn(latestThread, requestId, "Stopped."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not stop the coach.";
      const latestThread = getAppState().coachThreads[outcome.id] ?? thread;
      persist(failOutcomeCoachTurn(latestThread, requestId, message));
    }
  }

  function handleApply() {
    if (!currentDraft) return;
    actions.updateOutcome(outcome.id, { notes: currentDraft });
    persist(markOutcomeCoachApplied(thread));
  }

  function handleReset() {
    actions.resetOutcomeCoachThread(outcome.id);
    setComposer("");
  }

  return (
    <Card className="overflow-hidden rounded-[1rem]">
      <div className="flex min-h-[42rem] flex-col">
        <div className="border-b border-[color:var(--app-border)] px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="app-kicker">Coach</div>
              <div className="mt-1 truncate text-lg font-semibold">{outcome.title}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                className="app-input h-10 min-w-[15rem] rounded-[0.7rem] px-3 text-sm focus:outline-none"
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
                disabled={loadingModels || sending || !models.length}
              >
                {models.length ? null : <option value="">{loadingModels ? "Loading models..." : "No models"}</option>}
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>

              {warmingModel ? (
                <div className="inline-flex h-10 items-center rounded-[0.7rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-3 text-sm app-muted">
                  <ThinkingDots />
                </div>
              ) : null}

              {thread.appliedAt ? (
                <div className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] app-subtle">
                  Applied {formatTimestamp(thread.appliedAt)}
                </div>
              ) : null}

              {sending ? (
                <Button variant="ghost" size="sm" onClick={() => void handleStop()}>
                  Stop
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={handleReset} disabled={sending}>
                Reset
              </Button>
              <Button variant="primary" size="sm" onClick={handleApply} disabled={!currentDraft || draftAlreadyApplied || sending}>
                {draftAlreadyApplied ? "Applied" : "Apply to outcome"}
              </Button>
            </div>
          </div>

          {modelError ? <div className="mt-3 text-sm text-[#7a5421]">{modelError}</div> : null}
        </div>

        <div ref={viewportRef} className="app-chat-thread min-h-0 flex-1 overflow-auto px-5 py-6">
          <div className="mx-auto grid w-full max-w-3xl gap-4">
            {visibleMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {sending ? <LoadingBubble /> : null}
          </div>
        </div>

        <div className="border-t border-[color:var(--app-border)] px-5 py-4">
          <div className="mx-auto max-w-3xl">
            <Textarea
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              className="min-h-[8rem] resize-none rounded-[0.9rem] px-4 py-3 text-[1.02rem] leading-7 sm:text-[1.08rem]"
              placeholder={selectedModel ? "Reply here..." : "Select a model first."}
              disabled={!selectedModel || loadingModels || sending}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm app-muted">
                {thread.lastError ? (
                  <span className={thread.lastError === "Stopped." ? undefined : "text-[#7a2f2f]"}>{thread.lastError}</span>
                ) : (
                  "Nothing writes back until you apply it."
                )}
              </div>
              <Button variant="primary" onClick={() => void handleSend()} disabled={!composer.trim() || !selectedModel || loadingModels || sending}>
                {sending ? (
                  <span className="inline-flex items-center gap-2">
                    Thinking
                    <ThinkingDots />
                  </span>
                ) : (
                  "Send"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
