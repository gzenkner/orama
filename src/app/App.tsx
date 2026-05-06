import React from "react";
import type { AppTab, AppThemeMode, DayOfWeek, Outcome } from "./types";
import { actions, useAppState } from "./store";
import {
  ALL_DAYS_OF_WEEK,
  DAY_OF_WEEK_LABELS_SHORT,
  dateISOsInRange,
  formatDaysOfWeek,
  formatShortDate,
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
import PlanningAssistantView from "./views/PlanningAssistantView";
import PlanView, { TimelineYardstick, usePlanNavigation } from "./views/PlanView";
import CalendarView from "./views/CalendarView";
import BackupView from "./views/BackupView";
import ArchiveView from "./views/ArchiveView";
import TemplatesView from "./views/TemplatesView";
import { cn } from "./ui/cn";
import { requestPortalExit, requestPortalLogout } from "./portalBridge";
import { syncRemoteStateNow } from "./remoteStateSync";
import { trafficLightSurfaceClass, trafficLightVar, type TrafficLightTone } from "./ui/trafficLight";
import {
  ACTIVE_OUTCOME_LIMIT_EXPLANATION,
  activeOutcomeCount,
  MAX_ACTIVE_OUTCOMES,
  OUTCOME_TITLE_MAX_CHARACTERS,
  OUTCOME_TITLE_TRUNCATION_PARAM,
  normalizeOutcomeTitle,
  outcomeDurationCategory
} from "./rules";
import {
  firstOutstandingPlanningTarget,
  summarizePlanningActions,
  type PlanningActionCount,
  type PlanningActionDimension
} from "./planningActions";

function firstOutcomeId(outcomes: Outcome[]): string | undefined {
  return outcomes[0]?.id;
}

function sidebarOutcomeTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length <= OUTCOME_TITLE_TRUNCATION_PARAM) return trimmed;
  return `${trimmed.slice(0, OUTCOME_TITLE_TRUNCATION_PARAM - 3).trimEnd()}...`;
}

function todayISO(): string {
  return toISODate(new Date());
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function consistencyTone(progressPercent: number, targetPercent: number): TrafficLightTone {
  if (progressPercent >= targetPercent) return "green";
  if (progressPercent >= targetPercent - 10) return "amber";
  return "red";
}

function planningCoverageTone(progressPercent: number): TrafficLightTone {
  if (progressPercent >= 95) return "green";
  if (progressPercent >= 90) return "amber";
  return "red";
}

function HeaderMetricRing({
  value,
  label,
  progress,
  tone,
  strokeColor,
  textColor,
  trackColor,
  labelColor
}: {
  value: string;
  label: string;
  progress: number;
  tone: TrafficLightTone;
  strokeColor?: string;
  textColor?: string;
  trackColor?: string;
  labelColor?: string;
}) {
  const clamped = clamp01(progress);
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  const resolvedStrokeColor = strokeColor ?? trafficLightVar(tone, "fill");
  const resolvedTextColor = textColor ?? trafficLightVar(tone, "text");
  const resolvedTrackColor = trackColor ?? "var(--app-border)";
  const resolvedLabelColor = labelColor;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2">
      <div className="relative h-12 w-12 shrink-0 sm:h-[4.25rem] sm:w-[4.25rem]">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
          <circle cx="32" cy="32" r={radius} fill="none" stroke={resolvedTrackColor} strokeWidth="5" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke={resolvedStrokeColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div
          className="font-display absolute inset-0 flex items-center justify-center text-[0.82rem] font-semibold leading-none sm:text-[1.05rem]"
          style={{ color: resolvedTextColor }}
        >
          {value}
        </div>
      </div>
      <div className="app-kicker text-center" style={resolvedLabelColor ? { color: resolvedLabelColor } : undefined}>
        {label}
      </div>
    </div>
  );
}

function HeaderProgressRing({ progress, targetPercent }: { progress: number; targetPercent: number }) {
  const progressPercent = Math.round(clamp01(progress) * 100);
  return <HeaderMetricRing value={`${progressPercent}%`} label="Consistency" progress={progress} tone={consistencyTone(progressPercent, targetPercent)} />;
}

type SidebarUtilityKind = "back" | "logout" | "collapse" | "expand";
type SidebarUtilityTone = "default" | "danger";

async function navigateBackFromOrama() {
  if (await requestPortalExit()) return;
  if (typeof window === "undefined") return;
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  window.location.assign("../");
}

async function logoutFromOrama() {
  if (await requestPortalLogout()) return;
  if (typeof window === "undefined") return;
  window.location.assign("../");
}

function SidebarUtilityIcon({ kind }: { kind: SidebarUtilityKind }) {
  const commonProps = {
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-[1.05rem] w-[1.05rem]"
  };

  if (kind === "back") {
    return (
      <svg {...commonProps} aria-hidden="true">
        <path d="M11.75 4.75 6.5 10l5.25 5.25" />
        <path d="M7 10h7" />
      </svg>
    );
  }

  if (kind === "logout") {
    return (
      <svg {...commonProps} aria-hidden="true">
        <path d="M7 5.25H5.75a1.5 1.5 0 0 0-1.5 1.5v6.5a1.5 1.5 0 0 0 1.5 1.5H7" />
        <path d="M10 14.25 14.25 10 10 5.75" />
        <path d="M14 10H7.75" />
      </svg>
    );
  }

  if (kind === "expand") {
    return (
      <svg {...commonProps} aria-hidden="true">
        <path d="M7.75 4.75 13 10l-5.25 5.25" />
      </svg>
    );
  }

  return (
    <svg {...commonProps} aria-hidden="true">
      <path d="M12.25 4.75 7 10l5.25 5.25" />
    </svg>
  );
}

function SidebarUtilityButton({
  label,
  kind,
  onClick,
  compact = false,
  tone = "default",
  className,
  title
}: {
  label: string;
  kind: SidebarUtilityKind;
  onClick: () => void;
  compact?: boolean;
  tone?: SidebarUtilityTone;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      aria-label={label}
      data-tone={tone}
      onClick={onClick}
      className={cn("app-sidebar-utility-button", compact && "app-sidebar-utility-button-compact", className)}
    >
      <span className="app-sidebar-utility-icon">
        <SidebarUtilityIcon kind={kind} />
      </span>
      {compact ? <span className="sr-only">{label}</span> : <span className="app-sidebar-utility-label">{label}</span>}
    </button>
  );
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

function OutcomeLengthTile({ months }: { months: number }) {
  const category = outcomeDurationCategory(months);

  return (
    <span className="app-outcome-pill rounded-[0.55rem] px-3 py-1 text-xs font-semibold" title={`${category.label} outcome: ${months} calendar ${months === 1 ? "month" : "months"}`}>
      {category.label}
    </span>
  );
}

function planningActionTone(outstanding: number, total: number): TrafficLightTone {
  if (!total || outstanding === 0) return "green";
  if (outstanding < total) return "amber";
  return "red";
}

function ActionRequiredIcon({ className = "" }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full", className)}>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      >
        <path d="M12 5.75v7" />
        <circle cx="12" cy="18" r="1.8" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

function PlanningActionBadge({
  outstanding,
  total,
  compact = false,
  showIcon = true
}: {
  outstanding: number;
  total: number;
  compact?: boolean;
  showIcon?: boolean;
}) {
  const tone = planningActionTone(outstanding, total);
  const label = String(outstanding);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-[0.65rem] border font-bold uppercase tracking-[0.13em]",
        compact ? "px-2 py-1 text-[9px]" : "px-2.5 py-1.5 text-[10px]",
        trafficLightSurfaceClass(tone)
      )}
      title={`${outstanding} of ${total} planning items remaining`}
    >
      {showIcon ? (
        <ActionRequiredIcon className={cn(compact ? "h-4 w-4" : "h-[18px] w-[18px]", tone === "green" ? "bg-[color:var(--app-signal-green-fill)] text-white" : tone === "amber" ? "bg-[color:var(--app-signal-amber-fill)] text-white" : "bg-[color:var(--app-signal-red-fill)] text-white")} />
      ) : null}
      <span>{label}</span>
    </span>
  );
}

function PlanningMetricRing({ count, label, onClick }: { count: PlanningActionCount; label: string; onClick: () => void }) {
  const progress = count.total ? count.populated / count.total : 1;
  const progressPercent = Math.round(clamp01(progress) * 100);
  const tone = planningCoverageTone(progressPercent);

  return (
    <button
      type="button"
      className="outcome-header-metric-button"
      onClick={onClick}
      title={`Open the first ${label.toLowerCase()} item on the Future page`}
    >
      <HeaderMetricRing
        value={String(count.outstanding)}
        label={label}
        progress={progress}
        tone={tone}
        strokeColor={trafficLightVar("green", "fill")}
        trackColor={trafficLightVar("red", "fill")}
        labelColor={trafficLightVar(tone, "text")}
      />
    </button>
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
  const [syncing, setSyncing] = React.useState(false);
  const [syncMessage, setSyncMessage] = React.useState<string | null>(null);
  const [syncError, setSyncError] = React.useState<string | null>(null);

  async function forceSyncNow() {
    setSyncing(true);
    setSyncMessage(null);
    setSyncError(null);

    try {
      await syncRemoteStateNow();
      setSyncMessage("Synced to Supabase.");
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Could not sync to Supabase.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card className={cn("app-settings-panel rounded-[0.85rem] p-4", compact ? "" : "app-fade-up")}>
      <div className="app-kicker">Settings</div>
      <div className="app-settings-grid mt-3 grid gap-4">
        <div className="app-settings-section grid gap-2">
          <div className="text-sm font-semibold">Appearance</div>
          <div className="text-xs app-muted">Switch the shell between a paper-white workspace and a black canvas.</div>
          <ThemeToggle value={themeMode} />
        </div>

        <div className="app-settings-section grid gap-2">
          <div className="text-sm font-semibold">Week start</div>
          <div className="text-xs app-muted">Controls both weekly grouping and the calendar layout.</div>
          <WeekStartToggle />
        </div>

        <div className="app-settings-section grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Cloud sync</div>
              <div className="mt-1 text-xs app-muted">Push the current local workspace state to Supabase now.</div>
            </div>
            <Button variant="secondary" size="sm" className="h-8 rounded-[0.55rem] px-3 text-[12px]" disabled={syncing} onClick={forceSyncNow}>
              {syncing ? "Syncing..." : "Force sync"}
            </Button>
          </div>
          {syncMessage ? <div className="text-xs app-muted">{syncMessage}</div> : null}
          {syncError ? <div className="text-xs text-red-500">{syncError}</div> : null}
        </div>

        <div className="app-settings-note rounded-[0.6rem] border border-[color:var(--app-border)] bg-[color:var(--app-elevated)] px-3 py-2 text-xs app-muted">
          Each outcome keeps its own pastel accent so you can spot it quickly across the app.
        </div>
      </div>
    </Card>
  );
}

function WorkspaceIcon({ tab }: { tab: AppTab }) {
  const commonProps = {
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-[1.4rem] w-[1.4rem]"
  };

  if (tab === "calendar") {
    return (
      <svg {...commonProps} aria-hidden="true">
        <rect x="3" y="4.5" width="14" height="12" rx="2" />
        <path d="M6.5 3.5v3" />
        <path d="M13.5 3.5v3" />
        <path d="M3 8.5h14" />
      </svg>
    );
  }

  if (tab === "plan") {
    return (
      <svg {...commonProps} aria-hidden="true">
        <path d="M4 5.5h12" />
        <path d="M4 10h8" />
        <path d="M4 14.5h6" />
        <path d="M14 9l1.5 1.5L18 7.5" />
      </svg>
    );
  }

  if (tab === "assistant") {
    return (
      <svg {...commonProps} aria-hidden="true">
        <path d="M10 3.5l1.2 2.7 2.8.3-2.1 2 0.6 2.9-2.5-1.5-2.5 1.5 0.6-2.9-2.1-2 2.8-.3L10 3.5z" />
        <path d="M14.5 12.5l0.5 1.1 1.2 0.2-0.9 0.9 0.2 1.2-1-0.6-1 0.6 0.2-1.2-0.9-0.9 1.2-0.2 0.5-1.1z" />
      </svg>
    );
  }

  if (tab === "settings") {
    return (
      <svg {...commonProps} aria-hidden="true">
        <circle cx="10" cy="10" r="2.3" />
        <path d="M10 3.8l1 0.4 0.4 1.4 1.5 0.6 1.2-0.7 1 1-0.7 1.2 0.6 1.5 1.4 0.4 0.4 1-0.4 1-1.4 0.4-0.6 1.5 0.7 1.2-1 1-1.2-0.7-1.5 0.6-0.4 1.4-1 0.4-1-0.4-0.4-1.4-1.5-0.6-1.2 0.7-1-1 0.7-1.2-0.6-1.5-1.4-0.4-0.4-1 0.4-1 1.4-0.4 0.6-1.5-0.7-1.2 1-1 1.2 0.7 1.5-0.6 0.4-1.4 1-0.4z" />
      </svg>
    );
  }

  if (tab === "templates") {
    return (
      <svg {...commonProps} aria-hidden="true">
        <path d="M3.5 6.4v8.1c0 1 0.8 1.8 1.8 1.8h9.4c1 0 1.8-0.8 1.8-1.8V7.8c0-1-0.8-1.8-1.8-1.8h-4.8L8.5 4.2H5.3c-1 0-1.8 0.8-1.8 1.8v0.4z" />
        <path d="M6.6 10h6.8" />
        <path d="M6.6 12.7h4.8" />
      </svg>
    );
  }

  if (tab === "archive") {
    return (
      <svg {...commonProps} aria-hidden="true">
        <path d="M10 4.5l1.6 3.2 3.5 0.5-2.5 2.4 0.6 3.4-3.2-1.7-3.2 1.7 0.6-3.4-2.5-2.4 3.5-0.5L10 4.5z" />
      </svg>
    );
  }

  return null;
}

function WorkspaceThumbnail({ tab }: { tab: AppTab }) {
  const srcByTab: Partial<Record<AppTab, string>> = {
    assistant: "./workspace-icons/assistant.png",
    plan: "./workspace-icons/plan.png",
    calendar: "./workspace-icons/calendar.png",
    archive: "./workspace-icons/victory-wall.png",
    settings: "./workspace-icons/settings.png"
  };

  const src = srcByTab[tab];
  if (!src) {
    return (
      <span className="app-workspace-thumbnail app-workspace-thumbnail-inline-icon">
        <WorkspaceIcon tab={tab} />
      </span>
    );
  }

  return (
    <img src={src} alt="" className="app-workspace-thumbnail" aria-hidden="true" />
  );
}

function CollapsedBrandMark() {
  return (
    <div className="app-sidebar-brand-mark app-sidebar-brand-mark-compact" aria-hidden="true">
      <img
        src={`${import.meta.env.BASE_URL}orama-logo-v6-o.png`}
        alt=""
        className="h-8 w-8 object-contain"
      />
    </div>
  );
}

function WorkspaceNav({ onSelect, compact = false }: { onSelect?: () => void; compact?: boolean }) {
  const activeTab = useAppState((s) => s.ui.activeTab);
  const keys = Object.keys(TAB_META) as AppTab[];
  const workspaceKeys = keys.filter((key) => key !== "archive" && key !== "overview" && key !== "plan" && key !== "calendar");
  const celebrationActive = activeTab === "archive";

  return (
    <div className={cn("app-workspace-nav", compact ? "app-workspace-nav-compact" : "app-workspace-nav-full")}>
      {!compact ? (
        <div className="app-workspace-nav-head">
          <div className="app-kicker">Workspace</div>
          <div className="app-workspace-nav-copy">Planning tools, calendar, archive, and settings.</div>
        </div>
      ) : null}
      <button
        type="button"
        className={cn(
          "app-workspace-nav-card",
          compact && "app-workspace-nav-card-compact",
          celebrationActive && "app-workspace-nav-card-active"
        )}
        title={TAB_META.archive.hint}
        onClick={() => {
          actions.setActiveTab("archive");
          onSelect?.();
        }}
      >
        <WorkspaceThumbnail tab="archive" />
        <div className="app-workspace-nav-label-group">
          <div className="app-workspace-nav-label">{TAB_META.archive.label}</div>
          {!compact ? <div className="app-workspace-nav-hint">{TAB_META.archive.hint}</div> : null}
        </div>
      </button>

      <div className="app-workspace-nav-list">
          {workspaceKeys.map((key) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                className={cn(
                  "app-workspace-nav-card",
                  compact && "app-workspace-nav-card-compact",
                  active && "app-workspace-nav-card-active"
                )}
                title={TAB_META[key].hint}
                onClick={() => {
                  actions.setActiveTab(key);
                  onSelect?.();
                }}
              >
                <WorkspaceThumbnail tab={key} />
                <div className="app-workspace-nav-label-group">
                  <div className="app-workspace-nav-label">{TAB_META[key].label}</div>
                  {!compact ? <div className="app-workspace-nav-hint">{TAB_META[key].hint}</div> : null}
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}

function OutcomeList({ onSelect, maxItems }: { onSelect?: () => void; maxItems?: number }) {
  const outcomes = useAppState((s) => s.outcomes);
  const archivedOutcomeIds = useAppState((s) => s.archivedOutcomes.map((outcome) => outcome.id));
  const selectedOutcomeId = useAppState((s) => s.selectedOutcomeId);
  const weekStartsOn = useAppState((s) => s.weekStartsOn);
  const yearly = useAppState((s) => s.yearly);
  const monthly = useAppState((s) => s.monthly);
  const weekly = useAppState((s) => s.weekly);
  const [draggedOutcomeId, setDraggedOutcomeId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{ id: string; position: "before" | "after" } | null>(null);
  const archivedOutcomeIdSet = React.useMemo(() => new Set(archivedOutcomeIds), [archivedOutcomeIds]);
  const visibleOutcomes = React.useMemo(
    () => outcomes.filter((outcome) => !archivedOutcomeIdSet.has(outcome.id)),
    [archivedOutcomeIdSet, outcomes]
  );
  const renderedOutcomes = React.useMemo(
    () => (typeof maxItems === "number" ? visibleOutcomes.slice(0, maxItems) : visibleOutcomes),
    [maxItems, visibleOutcomes]
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
      <div className="app-sidebar-empty-state rounded-[0.85rem] border border-dashed border-[color:var(--app-border)] px-4 py-5 text-sm app-muted">
        No active outcomes here. Your completed ones are now on the Victory Wall.
      </div>
    );
  }

  return (
    <div className="app-sidebar-list-grid">
      {renderedOutcomes.map((outcome) => {
          const active = outcome.id === selectedOutcomeId;
          const showDropBefore = dropTarget?.id === outcome.id && dropTarget.position === "before";
          const showDropAfter = dropTarget?.id === outcome.id && dropTarget.position === "after";
          const planningActions = summarizePlanningActions(outcome, { yearly, monthly, weekly }, weekStartsOn);
          const displayTitle = sidebarOutcomeTitle(outcome.title);

          return (
            <div
              key={outcome.id}
              style={getOutcomeThemeStyle(outcome.themeId)}
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
                  "app-sidebar-list-button app-sidebar-outcome-button w-full rounded-[0.8rem] border px-3 py-3 text-left transition",
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
                title={`${outcome.title} - drag to reorder outcomes`}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-3.5 w-3.5 shrink-0 rounded-full border border-[color:var(--outcome-border)] bg-[color:var(--outcome-accent)]" />
                  <div className="min-w-0 flex-1 truncate text-[13px] font-semibold">{displayTitle}</div>
                  <PlanningActionBadge outstanding={planningActions.outstanding} total={planningActions.total} compact showIcon={false} />
                </div>
              </button>
            </div>
          );
        })}
    </div>
  );
}

function Sidebar({ onNewOutcome, onHide }: { onNewOutcome: () => void; onHide: () => void }) {
  const outcomes = useAppState((s) => s.outcomes);
  const archivedOutcomeIds = useAppState((s) => s.archivedOutcomes.map((outcome) => outcome.id));
  const [expandedPanel, setExpandedPanel] = React.useState<"outcomes" | "workspace">("outcomes");
  const visibleOutcomes = React.useMemo(() => {
    const archivedOutcomeIdSet = new Set(archivedOutcomeIds);
    return outcomes.filter((outcome) => !archivedOutcomeIdSet.has(outcome.id));
  }, [archivedOutcomeIds, outcomes]);
  const visibleOutcomeCount = visibleOutcomes.length;

  const outcomesViewportStyle = React.useMemo(
    () =>
      ({
        "--app-sidebar-visible-rows": String(Math.max(1, Math.min(visibleOutcomeCount, 6)))
      }) as React.CSSProperties,
    [visibleOutcomeCount]
  );
  const outcomeLimitReached = visibleOutcomeCount >= MAX_ACTIVE_OUTCOMES;
  const outcomesExpanded = expandedPanel === "outcomes";
  const workspaceExpanded = expandedPanel === "workspace";

  function openGlobalOverview() {
    actions.setScrollTopForTab("overview", 0);
    actions.openOverview("global");
  }

  return (
    <aside className="app-panel app-sidebar flex h-full min-h-0 w-full flex-col rounded-none border-r border-[color:var(--app-border)]">
      <div className="app-sidebar-layout">
        <div className="grid gap-3">
          <div className="app-sidebar-toolbar">
            <div className="app-sidebar-toolbar-group">
              <SidebarUtilityButton label="Back" kind="back" onClick={navigateBackFromOrama} />
              <SidebarUtilityButton label="Logout" kind="logout" tone="danger" onClick={logoutFromOrama} />
            </div>

            <button
              type="button"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              onClick={onHide}
              className="app-sidebar-icon-button"
            >
              <SidebarUtilityIcon kind="collapse" />
            </button>
          </div>

          <button
            type="button"
            className="app-sidebar-overview-card"
            title="Open overall progress"
            onClick={openGlobalOverview}
          >
            <OramaLogo className="app-sidebar-overview-logo" />
          </button>
        </div>

        <div className="app-sidebar-accordion">
          <section
            className="app-sidebar-card app-sidebar-panel"
            data-expanded={outcomesExpanded}
            data-panel="outcomes"
          >
            <button
              type="button"
              className="app-sidebar-panel-toggle"
              aria-expanded={outcomesExpanded}
              onClick={() => setExpandedPanel(outcomesExpanded ? "workspace" : "outcomes")}
            >
              <span className="min-w-0">
                <span className="text-sm font-semibold">Outcomes</span>
                <span className="mt-0.5 block text-[11px] leading-4 app-muted">
                  {visibleOutcomeCount}/{MAX_ACTIVE_OUTCOMES} active. Fewer outcomes make targets easier to hit.
                </span>
              </span>

              <span className="app-sidebar-panel-trailing">
                <button
                  type="button"
                  title={outcomeLimitReached ? ACTIVE_OUTCOME_LIMIT_EXPLANATION : "Create new outcome"}
                  aria-label="Create new outcome"
                  disabled={outcomeLimitReached}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (outcomeLimitReached) return;
                    onNewOutcome();
                  }}
                  className={cn("app-sidebar-panel-action-button", outcomeLimitReached && "cursor-not-allowed opacity-45")}
                >
                  <span className="app-sidebar-icon-button-glyph">+</span>
                </button>
                <span className="app-sidebar-panel-chevron" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6.5 8 3.5 4 3.5-4" />
                  </svg>
                </span>
              </span>
            </button>

            <div className="app-sidebar-panel-body">
              <div className="app-sidebar-panel-body-inner">
                <div className="app-sidebar-panel-shell">
                  <div className="app-sidebar-outcomes-window" style={outcomesViewportStyle}>
                    <div className="app-sidebar-scroll">
                      <OutcomeList />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            className="app-sidebar-card app-sidebar-panel"
            data-expanded={workspaceExpanded}
            data-panel="workspace"
          >
            <button
              type="button"
              className="app-sidebar-panel-toggle"
              aria-expanded={workspaceExpanded}
              onClick={() => setExpandedPanel(workspaceExpanded ? "outcomes" : "workspace")}
            >
              <span className="min-w-0">
                <span className="text-sm font-semibold">Workspace</span>
                <span className="mt-0.5 block text-[11px] leading-4 app-muted">Planning tools</span>
              </span>

              <span className="app-sidebar-panel-trailing">
                <span className="app-sidebar-panel-chevron" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6.5 8 3.5 4 3.5-4" />
                  </svg>
                </span>
              </span>
            </button>

            <div className="app-sidebar-panel-body">
              <div className="app-sidebar-panel-body-inner">
                <div className="app-sidebar-panel-shell">
                  <WorkspaceNav compact />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </aside>
  );
}

function CollapsedSidebar({ onShow }: { onShow: () => void }) {
  const outcomes = useAppState((s) => s.outcomes);
  const archivedOutcomeIds = useAppState((s) => s.archivedOutcomes.map((outcome) => outcome.id));
  const selectedOutcomeId = useAppState((s) => s.selectedOutcomeId);
  const activeTab = useAppState((s) => s.ui.activeTab);
  const archivedOutcomeIdSet = React.useMemo(() => new Set(archivedOutcomeIds), [archivedOutcomeIds]);
  const visibleOutcomes = React.useMemo(
    () => outcomes.filter((outcome) => !archivedOutcomeIdSet.has(outcome.id)),
    [archivedOutcomeIdSet, outcomes]
  );
  const collapsedWorkspaceKeys: AppTab[] = ["assistant", "templates", "archive", "settings"];

  return (
    <aside className="app-panel app-sidebar-compact flex h-full min-h-0 w-full flex-col items-center overflow-x-hidden rounded-none border-r border-[color:var(--app-border)]">
      <div className="app-sidebar-compact-stack">
        <div className="app-sidebar-compact-actions">
          <SidebarUtilityButton label="Back" kind="back" compact onClick={navigateBackFromOrama} />
          <SidebarUtilityButton label="Logout" kind="logout" compact tone="danger" onClick={logoutFromOrama} />
          <button
            type="button"
            title="Show sidebar"
            aria-label="Show sidebar"
            onClick={onShow}
            className="app-sidebar-compact-button"
          >
            <SidebarUtilityIcon kind="expand" />
          </button>
        </div>

        <div className="app-sidebar-compact-divider" />

        <button
          type="button"
          title="Open overview"
          aria-label="Open overview"
          onClick={() => {
            actions.setScrollTopForTab("overview", 0);
            actions.openOverview("global");
          }}
          className={cn(
            "app-sidebar-compact-button",
            activeTab === "overview"
              ? "app-sidebar-compact-button-active app-sidebar-compact-button-brand-active"
              : "app-sidebar-compact-button-brand"
          )}
        >
          <CollapsedBrandMark />
        </button>

        <div className="app-sidebar-compact-divider" />

        <div className="app-sidebar-compact-scroll">
        {visibleOutcomes.map((outcome) => {
          const active = outcome.id === selectedOutcomeId;
          return (
            <button
              key={outcome.id}
              type="button"
              title={outcome.title}
              aria-label={`Open ${outcome.title}`}
              onClick={() => actions.openOverview("outcome", outcome.id)}
              style={getOutcomeThemeStyle(outcome.themeId)}
              className={cn(
                "app-sidebar-compact-circle app-sidebar-compact-outcome",
                active
                  ? "border-[color:var(--app-nav-active-border)] bg-[color:var(--app-nav-active-bg)] shadow-[0_6px_16px_var(--app-shadow)]"
                  : "border-transparent bg-transparent hover:border-[color:var(--app-border)] hover:bg-[color:var(--app-nav-hover)]"
              )}
            >
              <span className="block h-3.5 w-3.5 rounded-full border border-[color:var(--outcome-border)] bg-[color:var(--outcome-accent)]" />
            </button>
          );
        })}
        </div>

        <div className="app-sidebar-compact-divider" />

        <div className="app-sidebar-compact-nav">
        {collapsedWorkspaceKeys.map((key) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              title={TAB_META[key].label}
              aria-label={TAB_META[key].label}
              onClick={() => actions.setActiveTab(key)}
              className={cn(
                "app-sidebar-compact-circle app-workspace-compact-circle",
                active
                  ? "app-workspace-compact-circle-active"
                  : "border-transparent bg-transparent hover:border-[color:var(--app-border)] hover:bg-[color:var(--app-nav-hover)]"
              )}
            >
              <WorkspaceThumbnail tab={key} />
            </button>
          );
        })}
        </div>
      </div>
    </aside>
  );
}

function SettingsView() {
  return (
    <div className="app-settings-view grid gap-4">
      <Card className="app-settings-hero app-card-soft rounded-[0.95rem] p-5">
        <div className="app-kicker">Settings</div>
        <div className="font-display mt-2 text-lg font-semibold">Tune the workspace.</div>
        <div className="mt-2 text-sm leading-6 app-muted">
          Appearance changes update the whole app. Week start changes how planning weeks and the calendar line up. Backup and restore live here too.
        </div>
      </Card>

      <SettingsPanel compact />
      <BackupView />
    </div>
  );
}

function OutcomeEditorForm({
  active,
  onClose,
  outcome,
  inline = false
}: {
  active: boolean;
  onClose: () => void;
  outcome?: Outcome;
  inline?: boolean;
}) {
  const [title, setTitle] = React.useState(normalizeOutcomeTitle(outcome?.title ?? ""));
  const [notes, setNotes] = React.useState(outcome?.notes ?? "");
  const [startDate, setStartDate] = React.useState(outcome?.startDate ?? todayISO());
  const [endDate, setEndDate] = React.useState(outcome?.endDate ?? todayISO());
  const [daysOfWeek, setDaysOfWeek] = React.useState<DayOfWeek[]>(normalizeDaysOfWeek(outcome?.daysOfWeek));
  const [consistencyTarget, setConsistencyTarget] = React.useState(outcome?.consistencyTarget ?? 90);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const currentActiveOutcomeCount = useAppState((s) => activeOutcomeCount(s.outcomes, s.archivedOutcomes));

  React.useEffect(() => {
    if (!active) return;
    setTitle(normalizeOutcomeTitle(outcome?.title ?? ""));
    setNotes(outcome?.notes ?? "");
    setStartDate(outcome?.startDate ?? todayISO());
    setEndDate(outcome?.endDate ?? todayISO());
    setDaysOfWeek(normalizeDaysOfWeek(outcome?.daysOfWeek));
    setConsistencyTarget(outcome?.consistencyTarget ?? 90);
    setError(null);
    setConfirmDelete(false);
  }, [active, outcome]);

  const isEdit = Boolean(outcome);
  const createLimitReached = !isEdit && currentActiveOutcomeCount >= MAX_ACTIVE_OUTCOMES;

  const canSave = React.useMemo(() => {
    if (createLimitReached) return false;
    if (!title.trim()) return false;
    if (!daysOfWeek.length) return false;
    try {
      const start = parseISODate(startDate);
      const end = parseISODate(endDate);
      return start.getTime() <= end.getTime();
    } catch {
      return false;
    }
  }, [createLimitReached, daysOfWeek.length, endDate, startDate, title]);

  function save() {
    if (!canSave) return;
    try {
      if (isEdit) {
        actions.updateOutcome(outcome!.id, {
          title: title.trim(),
          notes: notes.trim(),
          startDate,
          endDate,
          daysOfWeek,
          consistencyTarget
        });
      } else {
        actions.addOutcome({ title: title.trim(), notes: notes.trim(), startDate, endDate, daysOfWeek, consistencyTarget });
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

  const titleField = (
    <div className={inline ? "outcome-editor-title-field" : "grid gap-2"}>
      <div className="app-kicker">{inline ? "Outcome" : "Outcome title"}</div>
      <Input
        value={title}
        maxLength={OUTCOME_TITLE_MAX_CHARACTERS}
        onChange={(e) => setTitle(e.target.value.slice(0, OUTCOME_TITLE_MAX_CHARACTERS))}
        placeholder="e.g., Run a sub-4 hour marathon"
        className={inline ? "outcome-editor-input" : undefined}
      />
    </div>
  );

  const notesField = (
    <div className={inline ? "outcome-editor-notes-block" : "grid gap-2"}>
      {inline ? (
        <div className="app-kicker">Description</div>
      ) : (
        <div className="app-kicker">Notes</div>
      )}
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What does success look like? Why does it matter?"
        className={inline ? "outcome-editor-notes-field outcome-editor-input" : undefined}
      />
    </div>
  );

  const scheduleSection = (
    <div className={inline ? "outcome-editor-section outcome-editor-schedule-section" : "grid gap-4"}>
      {inline ? (
        <div className="outcome-editor-section-head">
          <div className="app-kicker">Schedule</div>
          <div className="text-xs app-muted">
            {formatShortDate(startDate)}
            {" -> "}
            {formatShortDate(endDate)}
          </div>
        </div>
      ) : null}
      <div className={inline ? "outcome-editor-date-grid grid" : "grid grid-cols-1 gap-3 sm:grid-cols-2"}>
        <div className="grid gap-2">
          <div className="app-kicker">Start date</div>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inline ? "outcome-editor-input" : undefined} />
        </div>
        <div className="grid gap-2">
          <div className="app-kicker">End date</div>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inline ? "outcome-editor-input" : undefined} />
        </div>
      </div>

      <div className={cn("grid gap-2", inline ? "outcome-editor-target-field" : "")}>
        <div className="flex items-center justify-between gap-3">
          <div className="app-kicker">Consistency target</div>
          <div className="text-xs app-muted">90% default</div>
        </div>
        <Input
          type="number"
          min="0"
          max="100"
          step="1"
          value={String(consistencyTarget)}
          onChange={(e) => setConsistencyTarget(Math.max(0, Math.min(100, Math.round(Number(e.target.value || 0)))))}
          className={inline ? "outcome-editor-input outcome-editor-target-input" : undefined}
        />
      </div>
    </div>
  );

  const cadenceSection = (
    <div className={inline ? "outcome-editor-section outcome-editor-cadence-section" : "grid gap-2"}>
      <div className="outcome-editor-section-head">
        <div className="app-kicker">Planning days</div>
        <div className="text-xs app-muted">{formatDaysOfWeek(daysOfWeek)}</div>
      </div>

      <div className={inline ? "outcome-editor-days-grid grid grid-cols-7" : "grid grid-cols-7 gap-2"}>
        {ALL_DAYS_OF_WEEK.map((day) => {
          const active = daysOfWeek.includes(day);
          return (
            <button
              key={day}
              type="button"
              className={cn(
                inline ? "outcome-editor-day-button rounded-[0.6rem] border font-semibold transition" : "rounded-[0.6rem] border px-2 py-3 text-sm font-semibold transition",
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

      <div className={cn("text-xs app-muted", inline ? "outcome-editor-days-helper leading-5" : "")}>
        All 7 days are selected by default. Untick the days this outcome should ignore, like weekends for a work goal.
      </div>
    </div>
  );

  const helpBlock = inline ? null : (
    <Card className="app-card-soft rounded-[0.75rem] p-4">
      <div className="text-sm font-semibold">How planning works here</div>
      <div className="mt-2 text-sm leading-6 app-muted">
        Define a time-bound outcome, give each month and week a focus, then keep daily commitments small enough to finish even on a busy day.
      </div>
    </Card>
  );

  const outcomeLimitBlock =
    inline || isEdit ? null : (
      <Card className={cn("rounded-[0.75rem] p-4", createLimitReached ? "border border-[color:var(--app-signal-amber-border)] bg-[color:var(--app-signal-amber-bg)]" : "app-card-soft")}>
        <div className="app-kicker">
          {currentActiveOutcomeCount}/{MAX_ACTIVE_OUTCOMES} active outcomes
        </div>
        <div className="mt-2 text-sm leading-6 app-muted">
          Keep up to {MAX_ACTIVE_OUTCOMES} active outcomes. {ACTIVE_OUTCOME_LIMIT_EXPLANATION}
        </div>
      </Card>
    );

  const content = inline ? (
    <div className="outcome-editor-inline-content grid">
      {confirmDelete ? (
        <Card className="rounded-[0.75rem] border border-red-300/40 bg-red-50/80 p-4">
          <div className="text-sm font-semibold text-red-700">Delete this outcome?</div>
          <div className="mt-2 text-sm leading-6 text-red-700/90">
            This removes the outcome itself and all connected monthly, weekly, and daily planning data.
          </div>
        </Card>
      ) : null}

      <div className="outcome-editor-inline-grid">
        <div className="outcome-editor-main">
          {titleField}
          {notesField}
          {error ? <div className="text-sm text-red-500">{error}</div> : null}
        </div>
        <div className="outcome-editor-sidebar">
          {scheduleSection}
          {cadenceSection}
        </div>
      </div>
    </div>
  ) : (
    <div className="grid gap-4">
      {confirmDelete ? (
        <Card className="rounded-[0.75rem] border border-red-300/40 bg-red-50/80 p-4">
          <div className="text-sm font-semibold text-red-700">Delete this outcome?</div>
          <div className="mt-2 text-sm leading-6 text-red-700/90">
            This removes the outcome itself and all connected monthly, weekly, and daily planning data.
          </div>
        </Card>
      ) : null}

      {outcomeLimitBlock}
      {titleField}
      {notesField}
      {scheduleSection}
      {cadenceSection}
      {helpBlock}
      {error ? <div className="text-sm text-red-500">{error}</div> : null}
    </div>
  );

  const actionsRow = confirmDelete ? (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex-1 text-xs app-muted">Delete this outcome and all of its month, week, and day slices.</div>
      <Button onClick={() => setConfirmDelete(false)}>Keep outcome</Button>
      <Button variant="danger" onClick={removeOutcome}>
        Confirm delete
      </Button>
    </div>
  ) : inline ? (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="primary" disabled={!canSave} onClick={save}>
        Save
      </Button>
      <div className="flex-1" />
      {isEdit ? (
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      ) : null}
    </div>
  ) : (
    <div className="flex flex-wrap items-center gap-2">
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
    </div>
  );

  if (inline) {
    return (
      <div className="outcome-header-edit-panel outcome-header-themed-panel w-full p-3 sm:p-4">
        {content}
        <div className="outcome-editor-actions mt-3 sm:mt-4">{actionsRow}</div>
      </div>
    );
  }

  return (
    <Modal open={active} onClose={onClose} title={isEdit ? "Edit outcome" : "Create a new outcome"} footer={actionsRow}>
      {content}
    </Modal>
  );
}

function OutcomeModal({ open, onClose, outcome }: { open: boolean; onClose: () => void; outcome?: Outcome }) {
  return <OutcomeEditorForm active={open} onClose={onClose} outcome={outcome} />;
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
        <div className="mt-3 max-w-2xl text-sm leading-6 app-muted">
          You can keep up to {MAX_ACTIVE_OUTCOMES} active outcomes. {ACTIVE_OUTCOME_LIMIT_EXPLANATION}
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

function Main({
  onNewOutcome,
  themeStyle,
  calendarFocusRequest = 0
}: {
  onNewOutcome: () => void;
  themeStyle?: React.CSSProperties;
  calendarFocusRequest?: number;
}) {
  const outcomes = useAppState((s) => s.outcomes);
  const selectedOutcomeId = useAppState((s) => s.selectedOutcomeId);
  const weekStartsOn = useAppState((s) => s.weekStartsOn);
  const tab = useAppState((s) => s.ui.activeTab);
  const overviewScope = useAppState((s) => s.ui.overviewScope);
  const scrollTopByTab = useAppState((s) => s.ui.scrollTopByTab);
  const yearly = useAppState((s) => s.yearly);
  const monthly = useAppState((s) => s.monthly);
  const weekly = useAppState((s) => s.weekly);
  const daily = useAppState((s) => s.daily);
  const [headerPanel, setHeaderPanel] = React.useState<"details" | "timeline" | "edit" | null>(null);
  const [mobileHeaderCollapsed, setMobileHeaderCollapsed] = React.useState(true);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const pendingPlanJumpRef = React.useRef<null | (() => void)>(null);

  const outcome = React.useMemo(() => outcomes.find((item) => item.id === selectedOutcomeId), [outcomes, selectedOutcomeId]);
  const planNavigation = usePlanNavigation(outcome, weekStartsOn);

  React.useEffect(() => {
    if (outcome) return;
    if (outcomes.length) actions.selectOutcome(firstOutcomeId(outcomes)!);
  }, [outcome, outcomes]);

  React.useEffect(() => {
    setHeaderPanel(null);
    setMobileHeaderCollapsed(true);
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

  const tabNeedsOutcome = tab === "assistant" || tab === "plan" || tab === "calendar" || (tab === "overview" && overviewScope === "outcome");

  if (!outcome && tabNeedsOutcome) {
    return <EmptyState onNewOutcome={onNewOutcome} />;
  }

  const outcomePlanningActions = outcome ? summarizePlanningActions(outcome, { yearly, monthly, weekly }, weekStartsOn) : null;
  const months = outcomePlanningActions?.monthKeys ?? [];
  const hasNotes = outcome ? outcome.notes.trim().length > 0 : false;
  const showOutcomeHeader = Boolean(outcome && (tab === "plan" || tab === "calendar" || (tab === "overview" && overviewScope === "outcome")));
  const outcomeTimelineProgress = outcome
    ? (() => {
        const now = parseISODate(todayISO()).getTime();
        const start = parseISODate(outcome.startDate).getTime();
        const end = parseISODate(outcome.endDate).getTime();
        if (end <= start) return now >= end ? 1 : 0;
        return clamp01((now - start) / (end - start));
      })()
    : 0;
  const outcomeConsistencyProgress = outcome
    ? (() => {
        const today = todayISO();
        const activeDates = dateISOsInRange(outcome.startDate, outcome.endDate, outcome.daysOfWeek);
        const elapsedDates = activeDates.filter((dateISO) => dateISO <= today);
        if (!elapsedDates.length) return 0;
        const done = elapsedDates.reduce((count, dateISO) => count + (daily[`${outcome.id}:${dateISO}`]?.done ? 1 : 0), 0);
        return done / elapsedDates.length;
      })()
    : 0;
  const primaryPlanningMetric = outcomePlanningActions
    ? outcomePlanningActions.category === "long"
      ? { count: outcomePlanningActions.years, label: "Years To Plan", targetDimension: "years" as const }
      : { count: outcomePlanningActions.months, label: "Months To Plan", targetDimension: "months" as const }
    : null;
  const secondaryPlanningMetric = outcomePlanningActions
    ? outcomePlanningActions.category === "short"
      ? { count: outcomePlanningActions.weeks, label: "Weeks To Plan", targetDimension: "weeks" as const }
      : {
          count: {
            dimension: "months" as const,
            total: outcomePlanningActions.total,
            outstanding: outcomePlanningActions.outstanding,
            populated: outcomePlanningActions.populated
          },
          label: "Actions Left",
          targetDimension: undefined
        }
    : null;

  function runPlanJump(jump: () => void) {
    if (tab === "plan") {
      requestAnimationFrame(() => jump());
      return;
    }
    pendingPlanJumpRef.current = jump;
    actions.setActiveTab("plan");
  }

  function jumpToPlanningTarget(dimension?: PlanningActionDimension) {
    if (!outcome) return;
    const target = firstOutstandingPlanningTarget(outcome, { yearly, monthly, weekly }, weekStartsOn, dimension);
    if (!target) {
      actions.setActiveTab("plan");
      return;
    }

    runPlanJump(() => {
      if (target.dimension === "years") {
        planNavigation.goToYear(target.yearKey);
        return;
      }
      if (target.dimension === "months") {
        planNavigation.goToMonth(target.monthKey);
        return;
      }
      planNavigation.goToWeek(target.monthKey, target.weekStartISO);
    });
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
    requestAnimationFrame(() => setHeaderPanel("edit"));
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden" style={themeStyle}>
      {showOutcomeHeader && outcome ? (
        <div className="border-b border-[color:var(--app-border)] px-3 py-2.5 sm:px-6 sm:py-4">
          <div
            className="outcome-header-shell rounded-[0.9rem] border border-[color:var(--outcome-border)] p-3 sm:rounded-[1rem] sm:p-6"
            data-mobile-collapsed={mobileHeaderCollapsed}
          >
            <div className="outcome-header-grid grid gap-4">
              <div className="outcome-header-main flex flex-col gap-2">
                <div className="outcome-header-title-block min-w-0">
                  <div className="outcome-header-title-row flex min-w-0 flex-wrap items-center gap-2.5">
                    <div className="outcome-header-title font-display min-w-0 truncate text-[1.28rem] font-semibold leading-tight text-[color:var(--app-text)] sm:text-[1.9rem]">
                      {outcome.title}
                    </div>
                    <div className="outcome-header-meta-strip">
                      <OutcomeBadge outcome={outcome} />
                      <OutcomeLengthTile months={months.length} />
                    </div>
                  </div>
                  <div className="outcome-header-progress mt-2 max-w-[36rem]">
                    <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] app-subtle">
                      <span>{formatShortDate(outcome.startDate)}</span>
                      <span>{formatShortDate(outcome.endDate)}</span>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[color:var(--app-border)]">
                      <div
                        className="h-full rounded-full bg-[color:var(--outcome-border)]"
                        style={{ width: `${Math.round(outcomeTimelineProgress * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="outcome-header-bottom">
                  <div className="outcome-header-controls">
                    <Button
                      className="outcome-header-nav-button h-8 px-2.5 text-[12px]"
                      variant={tab === "overview" && overviewScope === "outcome" ? "secondary" : "ghost"}
                      size="sm"
                      title="Open today view for this outcome"
                      onClick={() => openOutcomeHistory(outcome.id)}
                    >
                      Today
                    </Button>
                    <Button
                      className="outcome-header-nav-button h-8 px-2.5 text-[12px]"
                      variant={tab === "plan" ? "secondary" : "ghost"}
                      size="sm"
                      title="Open the future plan"
                      onClick={() => actions.setActiveTab("plan")}
                    >
                      Future
                    </Button>
                    <Button
                      className="outcome-header-nav-button h-8 px-2.5 text-[12px]"
                      variant={tab === "calendar" ? "secondary" : "ghost"}
                      size="sm"
                      title="Open the calendar"
                      onClick={() => actions.setActiveTab("calendar")}
                    >
                      Calendar
                    </Button>
                    <Button
                      className="outcome-header-utility-button h-8 px-2.5 text-[12px]"
                      variant={headerPanel === "details" ? "secondary" : "ghost"}
                      size="sm"
                      disabled={!hasNotes}
                      title={hasNotes ? "Show or hide outcome details" : "No outcome details"}
                      onClick={() => setHeaderPanel((prev) => (prev === "details" ? null : "details"))}
                    >
                      Details
                    </Button>
                    <Button
                      className="outcome-header-utility-button h-8 px-2.5 text-[12px]"
                      variant={headerPanel === "timeline" ? "secondary" : "ghost"}
                      size="sm"
                      title="Show or hide navigation"
                      onClick={() => setHeaderPanel((prev) => (prev === "timeline" ? null : "timeline"))}
                    >
                      Navigate
                    </Button>
                    <Button
                      className="outcome-header-utility-button outcome-header-stats-button h-8 px-2.5 text-[12px]"
                      variant={mobileHeaderCollapsed ? "ghost" : "secondary"}
                      size="sm"
                      title="Show or hide outcome stats"
                      aria-expanded={!mobileHeaderCollapsed}
                      onClick={() => setMobileHeaderCollapsed((prev) => !prev)}
                    >
                      Stats
                    </Button>
                    <Button
                      className="outcome-header-utility-button h-8 px-2.5 text-[12px]"
                      variant={headerPanel === "edit" ? "secondary" : "ghost"}
                      size="sm"
                      title="Edit outcome"
                      onClick={() => setHeaderPanel((prev) => (prev === "edit" ? null : "edit"))}
                    >
                      Edit
                    </Button>
                    <Button
                      className="outcome-header-complete-button h-8 px-2.5 text-[12px]"
                      variant="primary"
                      size="sm"
                      title="Mark this outcome done and add it to Victory Wall"
                      onClick={markOutcomeDone}
                    >
                      <span className="outcome-header-complete-label-full">Mark done</span>
                      <span className="outcome-header-complete-label-compact">Done</span>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="outcome-header-months">
                {primaryPlanningMetric ? (
                  <PlanningMetricRing
                    count={primaryPlanningMetric.count}
                    label={primaryPlanningMetric.label}
                    onClick={() => jumpToPlanningTarget(primaryPlanningMetric.targetDimension)}
                  />
                ) : null}
              </div>

              <div className="outcome-header-weeks">
                {secondaryPlanningMetric ? (
                  <PlanningMetricRing
                    count={secondaryPlanningMetric.count}
                    label={secondaryPlanningMetric.label}
                    onClick={() => jumpToPlanningTarget(secondaryPlanningMetric.targetDimension)}
                  />
                ) : null}
              </div>

              <div className="outcome-header-consistency">
                <HeaderProgressRing progress={outcomeConsistencyProgress} targetPercent={outcome.consistencyTarget} />
              </div>
            </div>

            {headerPanel === "details" && hasNotes ? (
              <div className="outcome-header-expanded-panel outcome-header-themed-panel mt-4 w-full p-4">
                <div
                  className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: "var(--outcome-ink)", opacity: 0.72 }}
                >
                  Outcome description
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6" style={{ color: "color-mix(in srgb, var(--outcome-ink) 90%, black 10%)" }}>
                  {outcome.notes}
                </div>
              </div>
            ) : null}

            {headerPanel === "timeline" ? (
              <div className="outcome-header-expanded-panel outcome-header-themed-panel mt-4 w-full p-4">
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

            {headerPanel === "edit" && outcome ? (
              <div className="mt-4">
                <OutcomeEditorForm active onClose={() => setHeaderPanel(null)} outcome={outcome} inline />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="app-main-scroll min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6"
      >
        {tab === "overview" && overviewScope === "global" ? <OverviewLandingView /> : null}
        {tab === "overview" && overviewScope === "outcome" && outcome ? (
          <OverviewView outcome={outcome} weekStartsOn={weekStartsOn} />
        ) : null}
        {tab === "assistant" && outcome ? <PlanningAssistantView outcome={outcome} weekStartsOn={weekStartsOn} /> : null}
        {tab === "plan" && outcome ? <PlanView outcome={outcome} weekStartsOn={weekStartsOn} navigation={planNavigation} /> : null}
        {tab === "calendar" && outcome ? (
          <CalendarView outcome={outcome} weekStartsOn={weekStartsOn} focusCurrentMonthRequest={calendarFocusRequest} />
        ) : null}
        {tab === "archive" ? <ArchiveView onOpenOutcome={openOutcomeHistory} onEditOutcome={openOutcomeForEdit} /> : null}
        {tab === "templates" ? <TemplatesView /> : null}
        {tab === "settings" ? <SettingsView /> : null}
      </div>

    </div>
  );
}

function MobileNavigationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Navigate Orama" className="app-mobile-menu-modal">
      <div className="grid gap-5">
        <section>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="app-kicker">Outcomes</div>
              <div className="mt-1 text-xs app-muted">Switch focus without losing your place.</div>
            </div>
          </div>
          <div className="mt-3">
            <OutcomeList onSelect={onClose} />
          </div>
        </section>

        <section>
          <WorkspaceNav onSelect={onClose} />
        </section>

        <section className="grid grid-cols-2 gap-2">
          <SidebarUtilityButton label="Back" kind="back" onClick={navigateBackFromOrama} className="justify-center" />
          <SidebarUtilityButton label="Logout" kind="logout" tone="danger" onClick={logoutFromOrama} className="justify-center" />
        </section>
      </div>
    </Modal>
  );
}

function MobileHeader({ onNewOutcome }: { onNewOutcome: () => void }) {
  const outcomes = useAppState((s) => s.outcomes);
  const archivedOutcomes = useAppState((s) => s.archivedOutcomes);
  const outcomeLimitReached = activeOutcomeCount(outcomes, archivedOutcomes) >= MAX_ACTIVE_OUTCOMES;

  function openGlobalOverview() {
    actions.setScrollTopForTab("overview", 0);
    actions.openOverview("global");
  }

  return (
    <header className="app-mobile-topbar app-panel">
      <div className="app-mobile-topbar-main">
        <button
          type="button"
          className="app-mobile-brand-button"
          title="Open today's work"
          aria-label="Open today's work"
          onClick={openGlobalOverview}
        >
          <OramaLogo className="app-mobile-brand-logo" />
        </button>

        <Button
          variant="primary"
          size="sm"
          className="app-mobile-new-button"
          disabled={outcomeLimitReached}
          title={outcomeLimitReached ? ACTIVE_OUTCOME_LIMIT_EXPLANATION : "Create new outcome"}
          aria-label="Create new outcome"
          onClick={onNewOutcome}
        >
          + Add
        </Button>

      </div>
    </header>
  );
}

function MobileBottomNav({ onOpenMenu, onOpenCalendar }: { onOpenMenu: () => void; onOpenCalendar: () => void }) {
  const activeTab = useAppState((s) => s.ui.activeTab);
  const overviewScope = useAppState((s) => s.ui.overviewScope);

  const items = [
    {
      label: "Today",
      active: activeTab === "overview" && overviewScope === "global",
      onClick: () => {
        actions.setScrollTopForTab("overview", 0);
        actions.openOverview("global");
      }
    },
    {
      label: "Future",
      active: activeTab === "plan",
      onClick: () => actions.setActiveTab("plan")
    },
    {
      label: "Calendar",
      active: activeTab === "calendar",
      onClick: onOpenCalendar
    },
    {
      label: "Settings",
      active: activeTab === "settings",
      onClick: () => actions.setActiveTab("settings")
    },
    {
      label: "Menu",
      active: activeTab === "assistant" || activeTab === "archive" || activeTab === "templates" || (activeTab === "overview" && overviewScope === "outcome"),
      onClick: onOpenMenu
    }
  ];

  return (
    <nav className="app-mobile-bottom-nav app-panel" aria-label="Primary mobile navigation">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={cn("app-mobile-bottom-nav-button", item.active && "app-mobile-bottom-nav-button-active")}
          onClick={item.onClick}
          aria-current={item.active ? "page" : undefined}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export default function App() {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [sidebarHidden, setSidebarHidden] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [calendarFocusRequest, setCalendarFocusRequest] = React.useState(0);
  const outcomes = useAppState((s) => s.outcomes);
  const selectedOutcomeId = useAppState((s) => s.selectedOutcomeId);
  const activeTab = useAppState((s) => s.ui.activeTab);
  const overviewScope = useAppState((s) => s.ui.overviewScope);

  const selectedOutcome = outcomes.find((outcome) => outcome.id === selectedOutcomeId);
  const shouldTintWorkspace =
    Boolean(selectedOutcome) &&
    (activeTab === "assistant" || activeTab === "plan" || activeTab === "calendar" || (activeTab === "overview" && overviewScope === "outcome"));
  const themeStyle = shouldTintWorkspace && selectedOutcome ? getOutcomeThemeStyle(selectedOutcome.themeId) : undefined;

  function openMobileCalendar() {
    setCalendarFocusRequest((value) => value + 1);
    actions.setActiveTab("calendar");
  }

  return (
    <div className="app-shell h-full w-full" data-app-theme="white">
      <div
        className={cn(
          "app-safe-viewport-frame relative grid h-full w-full grid-cols-1",
          sidebarHidden ? "sm:grid-cols-[76px_minmax(0,1fr)]" : "sm:grid-cols-[320px_minmax(0,1fr)]"
        )}
      >
        {sidebarHidden ? (
          <div className="hidden min-h-0 sm:block">
            <CollapsedSidebar onShow={() => setSidebarHidden(false)} />
          </div>
        ) : null}

        {!sidebarHidden ? (
          <div className="hidden min-h-0 sm:block">
            <Sidebar onNewOutcome={() => setCreateOpen(true)} onHide={() => setSidebarHidden(true)} />
          </div>
        ) : null}

        <div className="flex min-w-0 min-h-0 flex-col gap-0">
          <div className="sm:hidden">
            <MobileHeader onNewOutcome={() => setCreateOpen(true)} />
          </div>

          <main className="app-panel min-w-0 min-h-0 flex-1 overflow-hidden rounded-none border-0">
            <div className="app-main-panel h-full min-w-0 rounded-none border-0 shadow-none">
              <Main onNewOutcome={() => setCreateOpen(true)} themeStyle={themeStyle} calendarFocusRequest={calendarFocusRequest} />
            </div>
          </main>

          <div className="sm:hidden">
            <MobileBottomNav onOpenMenu={() => setMobileNavOpen(true)} onOpenCalendar={openMobileCalendar} />
          </div>
        </div>
      </div>

      <OutcomeModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <MobileNavigationModal open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
    </div>
  );
}
