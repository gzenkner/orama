import React from "react";
import type { AppTab, AppThemeMode, DayOfWeek, Outcome } from "./types";
import { actions, useAppState } from "./store";
import {
  ALL_DAYS_OF_WEEK,
  DAY_OF_WEEK_LABELS_SHORT,
  formatDaysOfWeek,
  formatShortDate,
  monthKeysInRange,
  normalizeDaysOfWeek,
  parseISODate,
  toISODate
} from "./date";
import { OUTCOME_THEME_ORDER, getOutcomeTheme, getOutcomeThemeStyle } from "./theme";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Input from "./ui/Input";
import Modal from "./ui/Modal";
import OramaLogo from "./ui/OramaLogo";
import { TAB_META } from "./ui/Tabs";
import Textarea from "./ui/Textarea";
import OverviewView from "./views/OverviewView";
import OverviewLandingView from "./views/OverviewLandingView";
import CoachView from "./views/CoachView";
import PlanView, { TimelineYardstick, usePlanNavigation } from "./views/PlanView";
import WizardView from "./views/WizardView";
import CalendarView from "./views/CalendarView";
import BackupView from "./views/BackupView";
import ArchiveView from "./views/ArchiveView";
import { cn } from "./ui/cn";

function firstOutcomeId(outcomes: Outcome[]): string | undefined {
  return outcomes[0]?.id;
}

function todayISO(): string {
  return toISODate(new Date());
}

function toggleDay(daysOfWeek: DayOfWeek[], day: DayOfWeek): DayOfWeek[] {
  if (daysOfWeek.includes(day)) {
    if (daysOfWeek.length === 1) return daysOfWeek;
    return daysOfWeek.filter((value) => value !== day);
  }
  return [...daysOfWeek, day].sort((a, b) => a - b) as DayOfWeek[];
}

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const theme = getOutcomeTheme(outcome.themeId);
  return (
    <span style={getOutcomeThemeStyle(outcome.themeId)} className="app-outcome-pill rounded-[0.55rem] px-3 py-1 text-xs font-semibold">
      {theme.label}
    </span>
  );
}

function ThemeToggle({ value }: { value: AppThemeMode }) {
  const items: AppThemeMode[] = ["white", "black"];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((mode) => {
        const active = mode === value;
        return (
          <button
            key={mode}
            type="button"
            className={cn(
              "rounded-[0.6rem] border px-3 py-2 text-sm font-semibold transition",
              active
                ? "app-tab app-tab-active"
                : "border-[color:var(--app-border)] bg-[color:var(--app-elevated)] text-[color:var(--app-muted)] hover:bg-[color:var(--app-nav-hover)]"
            )}
            aria-pressed={active}
            onClick={() => actions.setThemeMode(mode)}
          >
            {mode === "white" ? "White" : "Black"}
          </button>
        );
      })}
    </div>
  );
}

function WeekStartToggle() {
  const weekStartsOn = useAppState((s) => s.weekStartsOn);

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        className={cn(
          "rounded-[0.6rem] border px-3 py-2 text-sm font-semibold transition",
          weekStartsOn === 0
            ? "app-tab app-tab-active"
            : "border-[color:var(--app-border)] bg-[color:var(--app-elevated)] text-[color:var(--app-muted)] hover:bg-[color:var(--app-nav-hover)]"
        )}
        onClick={() => actions.setWeekStartsOn(0)}
      >
        Sunday
      </button>
      <button
        type="button"
        className={cn(
          "rounded-[0.6rem] border px-3 py-2 text-sm font-semibold transition",
          weekStartsOn === 1
            ? "app-tab app-tab-active"
            : "border-[color:var(--app-border)] bg-[color:var(--app-elevated)] text-[color:var(--app-muted)] hover:bg-[color:var(--app-nav-hover)]"
        )}
        onClick={() => actions.setWeekStartsOn(1)}
      >
        Monday
      </button>
    </div>
  );
}

function SettingsPanel({ compact = false }: { compact?: boolean }) {
  const themeMode = useAppState((s) => s.ui.themeMode);

  return (
    <Card className={cn("rounded-[0.85rem] p-4", compact ? "" : "app-fade-up")}>
      <div className="app-kicker">Settings</div>
      <div className="mt-3 grid gap-4">
        <div className="grid gap-2">
          <div className="text-sm font-semibold">Appearance</div>
          <div className="text-xs app-muted">Switch the shell between a paper-white workspace and a black canvas.</div>
          <ThemeToggle value={themeMode} />
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-semibold">Week start</div>
          <div className="text-xs app-muted">Controls both weekly grouping and the calendar layout.</div>
          <WeekStartToggle />
        </div>

        <div className="rounded-[0.6rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-3 py-2 text-xs app-muted">
          Each outcome keeps its own pastel accent so you can spot it quickly across the app.
        </div>
      </div>
    </Card>
  );
}

function WorkspaceNav({ onSelect }: { onSelect?: () => void }) {
  const activeTab = useAppState((s) => s.ui.activeTab);
  const archivedCount = useAppState((s) => s.archivedOutcomes.length);
  const keys = Object.keys(TAB_META) as AppTab[];
  const workspaceKeys = keys.filter((key) => key !== "archive" && key !== "overview");
  const celebrationActive = activeTab === "archive";

  return (
    <div className="grid gap-2">
      <div className="app-kicker">Workspace</div>
      <button
        type="button"
        className={cn("app-workspace-button app-workspace-button-celebration", celebrationActive ? "app-workspace-button-active" : "")}
        title={TAB_META.archive.hint}
        onClick={() => {
          actions.setActiveTab("archive");
          onSelect?.();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] app-subtle">Celebration</div>
            <div className="mt-1 truncate font-display text-[1.03rem] font-semibold">{TAB_META.archive.label}</div>
            <div className="mt-1 text-xs app-muted">Review finished targets and celebrate momentum.</div>
          </div>
          <span className="app-workspace-badge">{archivedCount}</span>
        </div>
      </button>

      <div className="max-h-[21rem] overflow-y-auto pr-1">
        <div className="grid gap-2">
          {workspaceKeys.map((key) => {
            const active = activeTab === key;
            const isStudio = key === "wizard";
            const isCoach = key === "coach";
            return (
              <button
                key={key}
                type="button"
                className={cn(
                  "w-full rounded-[0.65rem] border px-3 py-3 text-left transition",
                  active
                    ? "app-nav-active"
                    : "border-[color:var(--app-border)] bg-[color:var(--app-card)] hover:bg-[color:var(--app-nav-hover)]"
                )}
                title={TAB_META[key].hint}
                onClick={() => {
                  actions.setActiveTab(key);
                  onSelect?.();
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-3.5 w-3.5 shrink-0 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-elevated)]" />
                  <div className="min-w-0 flex-1 truncate text-[13px] font-semibold">{TAB_META[key].label}</div>
                  {isStudio ? <span className="app-workspace-badge app-workspace-badge-ai">AI</span> : null}
                  {isCoach ? <span className="app-workspace-badge app-workspace-badge-chat">Chat</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OutcomeList({ onSelect }: { onSelect?: () => void }) {
  const outcomes = useAppState((s) => s.outcomes);
  const archivedOutcomeIds = useAppState((s) => s.archivedOutcomes.map((outcome) => outcome.id));
  const selectedOutcomeId = useAppState((s) => s.selectedOutcomeId);
  const [draggedOutcomeId, setDraggedOutcomeId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{ id: string; position: "before" | "after" } | null>(null);
  const archivedOutcomeIdSet = React.useMemo(() => new Set(archivedOutcomeIds), [archivedOutcomeIds]);
  const visibleOutcomes = React.useMemo(
    () => outcomes.filter((outcome) => !archivedOutcomeIdSet.has(outcome.id)),
    [archivedOutcomeIdSet, outcomes]
  );

  React.useEffect(() => {
    if (!selectedOutcomeId && visibleOutcomes.length) actions.selectOutcome(firstOutcomeId(visibleOutcomes)!);
  }, [selectedOutcomeId, visibleOutcomes]);

  function clearDragState() {
    setDraggedOutcomeId(null);
    setDropTarget(null);
  }

  function updateDropTarget(e: React.DragEvent<HTMLDivElement>, targetId: string) {
    if (!draggedOutcomeId || draggedOutcomeId === targetId) {
      setDropTarget(null);
      return;
    }

    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const bounds = e.currentTarget.getBoundingClientRect();
    const position = e.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
    setDropTarget((prev) => (prev?.id === targetId && prev.position === position ? prev : { id: targetId, position }));
  }

  function dropOnOutcome(targetId: string) {
    if (!draggedOutcomeId || draggedOutcomeId === targetId || !dropTarget) {
      clearDragState();
      return;
    }

    actions.moveOutcome(draggedOutcomeId, targetId, dropTarget.position);
    clearDragState();
  }

  if (!visibleOutcomes.length) {
    return (
      <div className="rounded-[0.7rem] border border-dashed border-[color:var(--app-border)] px-4 py-5 text-sm app-muted">
        No active outcomes here. Your completed ones are now on the Victory Wall.
      </div>
    );
  }

  return (
    <div className="max-h-[14rem] overflow-y-auto pr-1">
      <div className="grid gap-2">
        {visibleOutcomes.map((outcome) => {
          const active = outcome.id === selectedOutcomeId;
          const theme = getOutcomeTheme(outcome.themeId);
          const showDropBefore = dropTarget?.id === outcome.id && dropTarget.position === "before";
          const showDropAfter = dropTarget?.id === outcome.id && dropTarget.position === "after";

          return (
            <div
              key={outcome.id}
              className={cn(
                "rounded-[0.75rem] transition",
                showDropBefore && "border-t-2 border-[color:var(--app-text)] pt-1.5",
                showDropAfter && "border-b-2 border-[color:var(--app-text)] pb-1.5"
              )}
              onDragOver={(e) => updateDropTarget(e, outcome.id)}
              onDrop={(e) => {
                e.preventDefault();
                dropOnOutcome(outcome.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null) && dropTarget?.id === outcome.id) {
                  setDropTarget(null);
                }
              }}
            >
              <button
                type="button"
                draggable
                className={cn(
                  "w-full rounded-[0.65rem] border px-3 py-3 text-left transition",
                  draggedOutcomeId === outcome.id && "opacity-55",
                  active
                    ? "app-nav-active"
                    : "border-[color:var(--app-border)] bg-[color:var(--app-card)] hover:bg-[color:var(--app-nav-hover)]"
                )}
                onDragStart={(e) => {
                  setDraggedOutcomeId(outcome.id);
                  setDropTarget(null);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", outcome.id);
                }}
                onDragEnd={clearDragState}
                onClick={() => {
                  actions.openOverview("outcome", outcome.id);
                  onSelect?.();
                }}
                title="Drag to reorder outcomes"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-3.5 w-3.5 shrink-0 rounded-full border"
                    style={{ borderColor: theme.border, background: theme.accent }}
                  />
                  <div className="min-w-0 flex-1 truncate text-[13px] font-semibold">{outcome.title}</div>
                  <div className="shrink-0 text-[8px] uppercase tracking-[0.18em] app-muted">Drag</div>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Sidebar({ onNewOutcome, onHide }: { onNewOutcome: () => void; onHide: () => void }) {
  return (
    <aside className="app-panel relative flex h-full min-h-0 w-full flex-col rounded-[0.95rem] p-5">
      <Button
        variant="ghost"
        size="sm"
        title="Collapse sidebar"
        aria-label="Collapse sidebar"
        onClick={onHide}
        className="absolute right-5 top-5 w-9 justify-center border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-0 hover:bg-[color:var(--app-card)]"
      >
        {"<"}
      </Button>

      <div className="grid gap-3 pr-16">
        <button
          type="button"
          className="justify-self-start rounded-[0.55rem] transition hover:opacity-85"
          title="Open overall progress"
          onClick={() => actions.openOverview("global")}
        >
          <OramaLogo />
        </button>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="pl-4 pr-1">
          <div className="flex items-center justify-between gap-3">
            <div className="app-kicker">Outcomes</div>
            <button
              type="button"
              title="Create new outcome"
              aria-label="Create new outcome"
              onClick={onNewOutcome}
              className="inline-flex h-9 w-9 items-center justify-center rounded-[0.65rem] text-2xl font-semibold leading-none text-[color:var(--app-muted)] transition hover:bg-[color:var(--app-nav-hover)] hover:text-[color:var(--app-text)]"
            >
              +
            </button>
          </div>
          <div className="mt-3">
            <OutcomeList />
          </div>
        </div>

        <div className="mt-4 min-h-0 shrink-0 border-t border-[color:var(--app-border)] pt-4">
          <WorkspaceNav />
        </div>
      </div>
    </aside>
  );
}

function SettingsView() {
  return (
    <div className="grid gap-4">
      <Card className="app-card-soft rounded-[0.95rem] p-5">
        <div className="app-kicker">Settings</div>
        <div className="font-display mt-2 text-lg font-semibold">Tune the workspace and planning defaults.</div>
        <div className="mt-2 text-sm leading-6 app-muted">
          Appearance changes update the whole app. Week start changes how planning weeks and the calendar line up. Backup and restore live here too.
        </div>
      </Card>

      <SettingsPanel compact />
      <BackupView />
    </div>
  );
}

function OutcomeModal({ open, onClose, outcome }: { open: boolean; onClose: () => void; outcome?: Outcome }) {
  const [title, setTitle] = React.useState(outcome?.title ?? "");
  const [notes, setNotes] = React.useState(outcome?.notes ?? "");
  const [startDate, setStartDate] = React.useState(outcome?.startDate ?? todayISO());
  const [endDate, setEndDate] = React.useState(outcome?.endDate ?? todayISO());
  const [daysOfWeek, setDaysOfWeek] = React.useState<DayOfWeek[]>(normalizeDaysOfWeek(outcome?.daysOfWeek));
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTitle(outcome?.title ?? "");
    setNotes(outcome?.notes ?? "");
    setStartDate(outcome?.startDate ?? todayISO());
    setEndDate(outcome?.endDate ?? todayISO());
    setDaysOfWeek(normalizeDaysOfWeek(outcome?.daysOfWeek));
    setError(null);
    setConfirmDelete(false);
  }, [open, outcome]);

  const isEdit = Boolean(outcome);

  const canSave = React.useMemo(() => {
    if (!title.trim()) return false;
    if (!daysOfWeek.length) return false;
    try {
      const start = parseISODate(startDate);
      const end = parseISODate(endDate);
      return start.getTime() <= end.getTime();
    } catch {
      return false;
    }
  }, [daysOfWeek.length, endDate, startDate, title]);

  function save() {
    if (!canSave) return;
    try {
      if (isEdit) {
        actions.updateOutcome(outcome!.id, { title: title.trim(), notes: notes.trim(), startDate, endDate, daysOfWeek });
      } else {
        actions.addOutcome({ title: title.trim(), notes: notes.trim(), startDate, endDate, daysOfWeek });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save outcome.");
    }
  }

  function removeOutcome() {
    if (!outcome) return;
    actions.deleteOutcome(outcome.id);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit outcome" : "Create a new outcome"}
      footer={
        <>
          {confirmDelete ? (
            <>
              <div className="flex-1 text-xs app-muted">Delete this outcome and all of its month, week, and day slices.</div>
              <Button onClick={() => setConfirmDelete(false)}>Keep outcome</Button>
              <Button variant="danger" onClick={removeOutcome}>
                Confirm delete
              </Button>
            </>
          ) : (
            <>
              {isEdit ? (
                <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              ) : null}
              <div className="flex-1" />
              <Button onClick={onClose}>Cancel</Button>
              <Button variant="primary" disabled={!canSave} onClick={save}>
                Save
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="grid gap-4">
        {confirmDelete ? (
          <Card className="rounded-[0.75rem] border border-red-300/40 bg-red-50/80 p-4">
            <div className="text-sm font-semibold text-red-700">Delete this outcome?</div>
            <div className="mt-2 text-sm leading-6 text-red-700/90">
              This removes the outcome itself and all connected monthly, weekly, and daily planning data.
            </div>
          </Card>
        ) : null}

        <div className="grid gap-2">
          <div className="app-kicker">Outcome title</div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Run a sub-4 hour marathon" />
        </div>

        <div className="grid gap-2">
          <div className="app-kicker">Notes</div>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What does success look like? Why does it matter?" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <div className="app-kicker">Start date</div>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <div className="app-kicker">End date</div>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="app-kicker">Planning days</div>
            <div className="text-xs app-muted">{formatDaysOfWeek(daysOfWeek)}</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {ALL_DAYS_OF_WEEK.map((day) => {
              const active = daysOfWeek.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  className={cn(
                    "rounded-[0.6rem] border px-2 py-3 text-sm font-semibold transition",
                    active
                      ? "border-[color:var(--outcome-border)] bg-[color:var(--outcome-soft)] text-[color:var(--outcome-ink)]"
                      : "border-[color:var(--app-border)] bg-[color:var(--app-input)] text-[color:var(--app-muted)] hover:bg-[color:var(--app-nav-hover)]"
                  )}
                  aria-pressed={active}
                  onClick={() => setDaysOfWeek((prev) => toggleDay(prev, day))}
                >
                  {DAY_OF_WEEK_LABELS_SHORT[day]}
                </button>
              );
            })}
          </div>

          <div className="text-xs app-muted">
            All 7 days are selected by default. Untick the days this outcome should ignore, like weekends for a work goal.
          </div>
        </div>

        <Card className="app-card-soft rounded-[0.75rem] p-4">
          <div className="text-sm font-semibold">How planning works here</div>
          <div className="mt-2 text-sm leading-6 app-muted">
            Define a time-bound outcome, give each month and week a focus, then keep daily commitments small enough to finish even on a busy day.
          </div>
        </Card>

        {error ? <div className="text-sm text-red-500">{error}</div> : null}
      </div>
    </Modal>
  );
}

function EmptyState({ onNewOutcome }: { onNewOutcome: () => void }) {
  const archivedCount = useAppState((s) => s.archivedOutcomes.length);

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <Card className="app-card-soft w-[min(760px,94vw)] rounded-[1rem] p-8">
        <div className="app-kicker">Start here</div>
        <div className="font-display mt-3 text-4xl font-semibold">Create a time-bound outcome</div>
        <div className="mt-3 max-w-2xl text-sm leading-7 app-muted">
          Give Orama one concrete finish line and a date range. The app will map every month, week, and active day so the work feels
          readable instead of sprawling.
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="primary" onClick={onNewOutcome}>
            Create your first outcome
          </Button>
          {archivedCount ? (
            <Button
              onClick={() => {
                actions.setActiveTab("archive");
              }}
            >
              Open Victory Wall ({archivedCount})
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function Main({ onNewOutcome }: { onNewOutcome: () => void }) {
  const outcomes = useAppState((s) => s.outcomes);
  const selectedOutcomeId = useAppState((s) => s.selectedOutcomeId);
  const weekStartsOn = useAppState((s) => s.weekStartsOn);
  const tab = useAppState((s) => s.ui.activeTab);
  const overviewScope = useAppState((s) => s.ui.overviewScope);
  const scrollTopByTab = useAppState((s) => s.ui.scrollTopByTab);
  const monthly = useAppState((s) => s.monthly);
  const weekly = useAppState((s) => s.weekly);
  const daily = useAppState((s) => s.daily);
  const [editOpen, setEditOpen] = React.useState(false);
  const [headerExpanded, setHeaderExpanded] = React.useState(false);
  const [yardstickExpanded, setYardstickExpanded] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const pendingPlanJumpRef = React.useRef<null | (() => void)>(null);

  const outcome = React.useMemo(() => outcomes.find((item) => item.id === selectedOutcomeId), [outcomes, selectedOutcomeId]);
  const planNavigation = usePlanNavigation(outcome, weekStartsOn);

  React.useEffect(() => {
    if (outcome) return;
    if (outcomes.length) actions.selectOutcome(firstOutcomeId(outcomes)!);
  }, [outcome, outcomes]);

  React.useEffect(() => {
    setHeaderExpanded(false);
    setYardstickExpanded(false);
  }, [outcome?.id]);

  React.useEffect(() => {
    if (tab !== "plan" || !pendingPlanJumpRef.current) return;

    let frame1 = 0;
    let frame2 = 0;
    const jump = pendingPlanJumpRef.current;
    pendingPlanJumpRef.current = null;

    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => jump());
    });

    return () => {
      if (frame1) cancelAnimationFrame(frame1);
      if (frame2) cancelAnimationFrame(frame2);
    };
  }, [tab]);

  React.useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = scrollTopByTab[tab] ?? 0;
  }, [scrollTopByTab, tab]);

  React.useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let frame = 0;
    const persistScroll = (tabKey: AppTab) => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        actions.setScrollTopForTab(tabKey, container.scrollTop);
      });
    };

    persistScroll(tab);

    const handleScroll = () => persistScroll(tab);
    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [tab]);

  const tabNeedsOutcome =
    tab === "coach" || tab === "plan" || tab === "wizard" || tab === "calendar" || (tab === "overview" && overviewScope === "outcome");

  if (!outcome && tabNeedsOutcome) {
    return <EmptyState onNewOutcome={onNewOutcome} />;
  }

  const months = outcome ? monthKeysInRange(outcome.startDate, outcome.endDate) : [];
  const hasNotes = outcome ? outcome.notes.trim().length > 0 : false;
  const showOutcomeHeader = Boolean(
    outcome && (tab === "plan" || tab === "wizard" || tab === "calendar" || (tab === "overview" && overviewScope === "outcome"))
  );

  function runPlanJump(jump: () => void) {
    if (tab === "plan") {
      requestAnimationFrame(() => jump());
      return;
    }
    pendingPlanJumpRef.current = jump;
    actions.setActiveTab("plan");
  }

  function markOutcomeDone() {
    if (!outcome) return;
    const shouldArchive = window.confirm(`Mark "${outcome.title}" as done and feature it in your Victory Wall?`);
    if (!shouldArchive) return;
    actions.completeOutcome(outcome.id);
    actions.setActiveTab("archive");
  }

  function openOutcomeHistory(outcomeId: string) {
    actions.openOverview("outcome", outcomeId);
  }

  function openOutcomeForEdit(outcomeId: string) {
    openOutcomeHistory(outcomeId);
    requestAnimationFrame(() => setEditOpen(true));
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {showOutcomeHeader && outcome ? (
        <div className="border-b border-[color:var(--app-border)] p-4 sm:p-6">
          <div className="app-card-soft rounded-[0.95rem] p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <OutcomeBadge outcome={outcome} />
                  <span className="app-pill rounded-[0.55rem] px-3 py-1 text-xs font-semibold">
                    {months.length} month{months.length === 1 ? "" : "s"}
                  </span>
                  <span className="app-pill rounded-[0.55rem] px-3 py-1 text-xs font-semibold" title="Active days">
                    {formatDaysOfWeek(outcome.daysOfWeek)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={headerExpanded ? "secondary" : "ghost"}
                    size="sm"
                    disabled={!hasNotes}
                    title={hasNotes ? "Show or hide outcome details" : "No outcome details"}
                    onClick={() => setHeaderExpanded((prev) => !prev)}
                  >
                    Details
                  </Button>
                  <Button
                    variant={yardstickExpanded ? "secondary" : "ghost"}
                    size="sm"
                    title="Show or hide the timeline"
                    onClick={() => setYardstickExpanded((prev) => !prev)}
                  >
                    Timeline
                  </Button>
                  <Button variant="primary" size="sm" title="Mark this outcome done and add it to Victory Wall" onClick={markOutcomeDone}>
                    Mark done
                  </Button>
                  <Button variant="ghost" size="sm" title="Edit outcome" onClick={() => setEditOpen(true)}>
                    Edit
                  </Button>
                </div>
              </div>

              <div className="min-w-0">
                <div className="font-display text-[1.55rem] font-semibold leading-tight sm:text-[1.9rem]">{outcome.title}</div>
                <div className="mt-1.5 text-sm app-muted">
                  {formatShortDate(outcome.startDate)} - {formatShortDate(outcome.endDate)}
                </div>
              </div>

              {headerExpanded && hasNotes ? (
                <div className="w-full rounded-[0.7rem] border border-[color:var(--outcome-border)] bg-[color:var(--outcome-soft)] p-4 text-[color:var(--outcome-ink)]">
                  <div
                    className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: "var(--outcome-ink)", opacity: 0.72 }}
                  >
                    Outcome description
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{outcome.notes}</div>
                </div>
              ) : null}

              {yardstickExpanded ? (
                <div className="pt-1">
                  <TimelineYardstick
                    outcome={outcome}
                    monthKeys={planNavigation.monthKeys}
                    weekStartsOn={weekStartsOn}
                    expandedMonths={planNavigation.expandedMonths}
                    expandedWeekKeys={planNavigation.expandedWeekKeys}
                    allExpanded={planNavigation.allExpanded}
                    monthly={monthly}
                    weekly={weekly}
                    daily={daily}
                    onToggleAll={planNavigation.toggleAll}
                    onJumpMonth={(monthKey) => runPlanJump(() => planNavigation.goToMonth(monthKey))}
                    onJumpWeek={(monthKey, weekStartISO) => runPlanJump(() => planNavigation.goToWeek(monthKey, weekStartISO))}
                    onJumpDay={(monthKey, weekStartISO, dateISO) => runPlanJump(() => planNavigation.goToDay(monthKey, weekStartISO, dateISO))}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div ref={scrollRef} className={cn("min-h-0 flex-1 overflow-auto", tab === "coach" ? "" : "p-4 sm:p-6")}>
        {tab === "overview" && overviewScope === "global" ? <OverviewLandingView /> : null}
        {tab === "overview" && overviewScope === "outcome" && outcome ? <OverviewView outcome={outcome} weekStartsOn={weekStartsOn} /> : null}
        {tab === "coach" && outcome ? <CoachView outcome={outcome} /> : null}
        {tab === "plan" && outcome ? <PlanView outcome={outcome} weekStartsOn={weekStartsOn} navigation={planNavigation} /> : null}
        {tab === "wizard" && outcome ? <WizardView outcome={outcome} weekStartsOn={weekStartsOn} /> : null}
        {tab === "calendar" && outcome ? <CalendarView outcome={outcome} weekStartsOn={weekStartsOn} /> : null}
        {tab === "archive" ? <ArchiveView onOpenOutcome={openOutcomeHistory} onEditOutcome={openOutcomeForEdit} /> : null}
        {tab === "settings" ? <SettingsView /> : null}
      </div>

      <OutcomeModal open={Boolean(outcome) && editOpen} onClose={() => setEditOpen(false)} outcome={outcome} />
    </div>
  );
}

function MobileHeader({ onNewOutcome }: { onNewOutcome: () => void }) {
  const outcomes = useAppState((s) => s.outcomes);
  const selectedOutcomeId = useAppState((s) => s.selectedOutcomeId);
  const [open, setOpen] = React.useState(false);
  const selected = outcomes.find((outcome) => outcome.id === selectedOutcomeId);

  return (
    <div className="app-panel rounded-[0.9rem] p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 rounded-[0.65rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-4 py-3 text-left"
          onClick={() => setOpen(true)}
        >
          <div className="truncate text-sm font-semibold">{selected ? selected.title : "Navigate"}</div>
          <div className="mt-1 text-xs app-muted">Open outcomes and page navigation</div>
        </button>

        <Button variant="primary" size="sm" onClick={onNewOutcome}>
          New
        </Button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Navigate Orama">
        <div className="grid gap-6">
          <div>
            <div className="app-kicker">Outcomes</div>
            <div className="mt-3">
              <OutcomeList onSelect={() => setOpen(false)} />
            </div>
          </div>

          <WorkspaceNav onSelect={() => setOpen(false)} />
        </div>
      </Modal>
    </div>
  );
}

export default function App() {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [sidebarHidden, setSidebarHidden] = React.useState(false);
  const outcomes = useAppState((s) => s.outcomes);
  const selectedOutcomeId = useAppState((s) => s.selectedOutcomeId);
  const themeMode = useAppState((s) => s.ui.themeMode);

  const selectedOutcome = outcomes.find((outcome) => outcome.id === selectedOutcomeId);
  const themeId = selectedOutcome?.themeId ?? OUTCOME_THEME_ORDER[0];

  return (
    <div className="app-shell h-dvh w-dvw" data-app-theme={themeMode} style={getOutcomeThemeStyle(themeId)}>
      <div
        className={cn(
          "relative grid h-full w-full grid-cols-1 gap-4 p-3 sm:p-4",
          sidebarHidden ? "sm:grid-cols-[minmax(0,1fr)]" : "sm:grid-cols-[300px_minmax(0,1fr)]"
        )}
      >
        {sidebarHidden ? (
          <div className="absolute left-4 top-4 z-20 hidden sm:flex">
            <Button
              variant="ghost"
              size="sm"
              title="Show sidebar"
              aria-label="Show sidebar"
              onClick={() => setSidebarHidden(false)}
              className="w-9 justify-center border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-0 hover:bg-[color:var(--app-card)]"
            >
              {">"}
            </Button>
          </div>
        ) : null}

        {!sidebarHidden ? (
          <div className="hidden min-h-0 sm:block">
            <Sidebar onNewOutcome={() => setCreateOpen(true)} onHide={() => setSidebarHidden(true)} />
          </div>
        ) : null}

        <div className="flex min-h-0 flex-col gap-4">
          <div className="sm:hidden">
            <MobileHeader onNewOutcome={() => setCreateOpen(true)} />
          </div>

          <main className="app-panel min-h-0 flex-1 overflow-hidden rounded-[1rem]">
            <div className="app-main-panel h-full rounded-[1rem]">
              <Main onNewOutcome={() => setCreateOpen(true)} />
            </div>
          </main>
        </div>
      </div>

      <OutcomeModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
