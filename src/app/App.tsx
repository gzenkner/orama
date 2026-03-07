import React from "react";
import type { AppTab, Outcome } from "./types";
import { actions, useAppState } from "./store";
import { formatShortDate, monthKeysInRange, parseISODate, toISODate } from "./date";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Input from "./ui/Input";
import Modal from "./ui/Modal";
import Tabs, { type TabKey } from "./ui/Tabs";
import Textarea from "./ui/Textarea";
import OverviewView from "./views/OverviewView";
import PlanView from "./views/PlanView";
import CalendarView from "./views/CalendarView";
import BackupView from "./views/BackupView";

function firstOutcomeId(outcomes: Outcome[]): string | undefined {
  return outcomes[0]?.id;
}

function todayISO(): string {
  return toISODate(new Date());
}

function Sidebar({ onNewOutcome }: { onNewOutcome: () => void }) {
  const outcomes = useAppState((s) => s.outcomes);
  const selectedOutcomeId = useAppState((s) => s.selectedOutcomeId);
  const weekStartsOn = useAppState((s) => s.weekStartsOn);

  React.useEffect(() => {
    if (!selectedOutcomeId && outcomes.length) actions.selectOutcome(firstOutcomeId(outcomes)!);
  }, [outcomes, selectedOutcomeId]);

  return (
    <div className="flex h-full w-full flex-col gap-4 border-r border-zinc-900 bg-zinc-950/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Goals</div>
          <div className="text-xs text-zinc-400">Outcome → monthly → weekly → daily</div>
        </div>
        <Button variant="primary" size="sm" onClick={onNewOutcome}>
          New
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium text-zinc-400">Outcomes</div>
        {outcomes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-3 text-sm text-zinc-400">
            Create your first outcome.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {outcomes.map((o) => {
              const active = o.id === selectedOutcomeId;
              return (
                <button
                  key={o.id}
                  className={[
                    "rounded-2xl border p-3 text-left transition",
                    active ? "border-zinc-700 bg-zinc-900" : "border-zinc-900 bg-transparent hover:bg-zinc-950"
                  ].join(" ")}
                  onClick={() => actions.selectOutcome(o.id)}
                >
                  <div className="truncate text-sm font-medium">{o.title}</div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {formatShortDate(o.startDate)} → {formatShortDate(o.endDate)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <Card className="p-3">
          <div className="text-xs font-medium text-zinc-400">Week start</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              className={[
                "rounded-xl border px-3 py-2 text-sm transition",
                weekStartsOn === 0 ? "border-zinc-700 bg-zinc-900" : "border-zinc-800 hover:bg-zinc-900"
              ].join(" ")}
              onClick={() => actions.setWeekStartsOn(0)}
            >
              Sunday
            </button>
            <button
              className={[
                "rounded-xl border px-3 py-2 text-sm transition",
                weekStartsOn === 1 ? "border-zinc-700 bg-zinc-900" : "border-zinc-800 hover:bg-zinc-900"
              ].join(" ")}
              onClick={() => actions.setWeekStartsOn(1)}
            >
              Monday
            </button>
          </div>
          <div className="mt-2 text-xs text-zinc-500">Applies to weekly grouping + calendar layout.</div>
        </Card>
      </div>
    </div>
  );
}

function OutcomeModal({ open, onClose, outcome }: { open: boolean; onClose: () => void; outcome?: Outcome }) {
  const [title, setTitle] = React.useState(outcome?.title ?? "");
  const [notes, setNotes] = React.useState(outcome?.notes ?? "");
  const [startDate, setStartDate] = React.useState(outcome?.startDate ?? todayISO());
  const [endDate, setEndDate] = React.useState(outcome?.endDate ?? todayISO());
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTitle(outcome?.title ?? "");
    setNotes(outcome?.notes ?? "");
    setStartDate(outcome?.startDate ?? todayISO());
    setEndDate(outcome?.endDate ?? todayISO());
    setError(null);
  }, [open, outcome]);

  const isEdit = Boolean(outcome);

  const canSave = React.useMemo(() => {
    if (!title.trim()) return false;
    try {
      const s = parseISODate(startDate);
      const e = parseISODate(endDate);
      return s.getTime() <= e.getTime();
    } catch {
      return false;
    }
  }, [title, startDate, endDate]);

  function save() {
    if (!canSave) return;
    try {
      if (isEdit) {
        actions.updateOutcome(outcome!.id, { title: title.trim(), notes: notes.trim(), startDate, endDate });
      } else {
        actions.addOutcome({ title: title.trim(), notes: notes.trim(), startDate, endDate });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save outcome.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit outcome" : "Create a new outcome"}
      footer={
        <>
          {isEdit ? (
            <Button
              variant="danger"
              onClick={() => {
                if (!outcome) return;
                const ok = confirm(`Delete outcome “${outcome.title}”? This removes all slices too.`);
                if (!ok) return;
                actions.deleteOutcome(outcome.id);
                onClose();
              }}
            >
              Delete
            </Button>
          ) : null}
          <div className="flex-1" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!canSave} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <div className="text-xs font-medium text-zinc-400">Outcome title</div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Run a sub-4 hour marathon" />
        </div>

        <div className="grid gap-2">
          <div className="text-xs font-medium text-zinc-400">Notes (optional)</div>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What does success look like? Why does it matter?" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <div className="text-xs font-medium text-zinc-400">Start date</div>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <div className="text-xs font-medium text-zinc-400">End date</div>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <Card className="p-4">
          <div className="text-sm font-semibold">How planning works here</div>
          <div className="mt-1 text-sm text-zinc-300">
            You define a time-bound outcome, then fill in a goal for each month in the range, a goal for each calendar week
            inside those months, and a daily commitment for each day.
          </div>
          <div className="mt-3 text-xs text-zinc-500">
            Tip: keep daily commitments tiny—something you can do even on busy days.
          </div>
        </Card>

        {error ? <div className="text-sm text-red-300">{error}</div> : null}
      </div>
    </Modal>
  );
}

function Main({ onNewOutcome }: { onNewOutcome: () => void }) {
  const outcomes = useAppState((s) => s.outcomes);
  const selectedOutcomeId = useAppState((s) => s.selectedOutcomeId);
  const weekStartsOn = useAppState((s) => s.weekStartsOn);
  const tab = useAppState((s) => s.ui.activeTab);
  const scrollTopByTab = useAppState((s) => s.ui.scrollTopByTab);
  const [editOpen, setEditOpen] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const outcome = React.useMemo(() => outcomes.find((o) => o.id === selectedOutcomeId), [outcomes, selectedOutcomeId]);

  React.useEffect(() => {
    if (outcome) return;
    if (outcomes.length) actions.selectOutcome(firstOutcomeId(outcomes)!);
  }, [outcomes, outcome]);

  React.useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = scrollTopByTab[tab] ?? 0;
  }, [tab, scrollTopByTab]);

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

  if (!outcome) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <Card className="w-[min(720px,92vw)] p-6">
          <div className="text-lg font-semibold">Create a time-bound outcome</div>
          <div className="mt-2 text-sm text-zinc-300">
            Start with an outcome and a date range. The app will show every month, week, and day in that range so you can plan
            in “daily slices”.
          </div>
          <div className="mt-5 flex gap-2">
            <Button variant="primary" onClick={onNewOutcome}>
              Create your first outcome
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const months = monthKeysInRange(outcome.startDate, outcome.endDate);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-col gap-3 border-b border-zinc-900 bg-zinc-950/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-base font-semibold">{outcome.title}</div>
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300">
              {months.length} month{months.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-1 text-sm text-zinc-400">
            {formatShortDate(outcome.startDate)} → {formatShortDate(outcome.endDate)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={tab} onChange={(next: TabKey) => actions.setActiveTab(next)} />
          <Button onClick={() => setEditOpen(true)}>Edit</Button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-4">
        {tab === "overview" ? <OverviewView outcome={outcome} weekStartsOn={weekStartsOn} /> : null}
        {tab === "plan" ? <PlanView outcome={outcome} weekStartsOn={weekStartsOn} /> : null}
        {tab === "calendar" ? <CalendarView outcome={outcome} weekStartsOn={weekStartsOn} /> : null}
        {tab === "backup" ? <BackupView /> : null}
      </div>

      <OutcomeModal open={editOpen} onClose={() => setEditOpen(false)} outcome={outcome} />
    </div>
  );
}

export default function App() {
  const [createOpen, setCreateOpen] = React.useState(false);
  return (
    <div className="h-dvh w-dvw">
      <div className="grid h-full w-full grid-cols-1 lg:grid-cols-[320px_1fr]">
        <div className="hidden lg:block">
          <Sidebar onNewOutcome={() => setCreateOpen(true)} />
        </div>
        <div className="block lg:hidden">
          <MobileHeader onNewOutcome={() => setCreateOpen(true)} />
        </div>
        <Main onNewOutcome={() => setCreateOpen(true)} />
      </div>

      <OutcomeModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function MobileHeader({ onNewOutcome }: { onNewOutcome: () => void }) {
  const outcomes = useAppState((s) => s.outcomes);
  const selectedOutcomeId = useAppState((s) => s.selectedOutcomeId);
  const weekStartsOn = useAppState((s) => s.weekStartsOn);
  const [open, setOpen] = React.useState(false);

  const selected = outcomes.find((o) => o.id === selectedOutcomeId);

  return (
    <div className="sticky top-0 z-10 border-b border-zinc-900 bg-zinc-950/80 p-3 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <button
          className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-left"
          onClick={() => setOpen(true)}
        >
          <div className="truncate text-sm font-medium">{selected ? selected.title : "Outcomes"}</div>
          <div className="text-xs text-zinc-400">Tap to switch</div>
        </button>
        <Button variant="primary" size="sm" onClick={onNewOutcome}>
          New
        </Button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Select an outcome">
        <div className="grid gap-3">
          {outcomes.length === 0 ? (
            <div className="text-sm text-zinc-400">No outcomes yet.</div>
          ) : (
            outcomes.map((o) => (
              <button
                key={o.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-left hover:bg-zinc-900"
                onClick={() => {
                  actions.selectOutcome(o.id);
                  setOpen(false);
                }}
              >
                <div className="truncate text-sm font-medium">{o.title}</div>
                <div className="mt-1 text-xs text-zinc-400">
                  {formatShortDate(o.startDate)} → {formatShortDate(o.endDate)}
                </div>
              </button>
            ))
          )}

          <Card className="p-3">
            <div className="text-xs font-medium text-zinc-400">Week start</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                className={[
                  "rounded-xl border px-3 py-2 text-sm transition",
                  weekStartsOn === 0 ? "border-zinc-700 bg-zinc-900" : "border-zinc-800 hover:bg-zinc-900"
                ].join(" ")}
                onClick={() => actions.setWeekStartsOn(0)}
              >
                Sunday
              </button>
              <button
                className={[
                  "rounded-xl border px-3 py-2 text-sm transition",
                  weekStartsOn === 1 ? "border-zinc-700 bg-zinc-900" : "border-zinc-800 hover:bg-zinc-900"
                ].join(" ")}
                onClick={() => actions.setWeekStartsOn(1)}
              >
                Monday
              </button>
            </div>
          </Card>
        </div>
      </Modal>
    </div>
  );
}
