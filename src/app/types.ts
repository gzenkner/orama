export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday ... 6 = Saturday

export type WeekStartsOn = 0 | 1; // 0 = Sunday (US), 1 = Monday

export type AppTab = "overview" | "coach" | "plan" | "wizard" | "calendar" | "settings";

export type AppThemeMode = "white" | "black";

export type OutcomeThemeId = "apricot" | "sage" | "sky" | "lavender" | "butter" | "rose";

export type Outcome = {
  id: string;
  title: string;
  notes: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysOfWeek: DayOfWeek[];
  themeId: OutcomeThemeId;
  createdAt: string; // ISO
};

export type OutcomeCoachTopicId =
  | "finish_line"
  | "why_now"
  | "proof"
  | "scope"
  | "constraints"
  | "risks"
  | "rhythm";

export type OutcomeCoachMessageRole = "assistant" | "user";

export type OutcomeCoachMessage = {
  id: string;
  role: OutcomeCoachMessageRole;
  content: string;
  createdAt: string; // ISO
  topicId?: OutcomeCoachTopicId;
};

export type OutcomeCoachAnswers = Partial<Record<OutcomeCoachTopicId, string>>;

export type OutcomeCoachThread = {
  version: number;
  outcomeId: string;
  messages: OutcomeCoachMessage[];
  pendingUserMessage?: OutcomeCoachMessage;
  pendingRequestId?: string;
  pendingModel?: string;
  pendingSince?: string; // ISO
  lastError?: string;
  answers: OutcomeCoachAnswers;
  activeTopicId?: OutcomeCoachTopicId;
  draftDescription: string;
  lastUpdatedAt: string; // ISO
  appliedAt?: string; // ISO
};

export type MonthlyGoal = {
  title: string;
};

export type WeeklyGoal = {
  title: string;
};

export type DailyGoal = {
  title: string;
  items?: string[];
  itemsDone?: boolean[];
  done: boolean;
  doneAt?: string;
};

export type PersistedStateV1 = {
  version: 1;
  weekStartsOn: WeekStartsOn;
  selectedOutcomeId?: string;
  ui: {
    showMonthlyObjectives: boolean;
    showWeeklyObjectives: boolean;
    activeTab: AppTab;
    themeMode: AppThemeMode;
    scrollTopByTab: Partial<Record<AppTab, number>>;
  };
  outcomes: Outcome[];
  monthly: Record<string, MonthlyGoal>;
  weekly: Record<string, WeeklyGoal>;
  daily: Record<string, DailyGoal>;
  coachThreads: Record<string, OutcomeCoachThread>;
};
