// ============================================================
// HabitFlow AI Engine — Shared Type Definitions
// All types are plain interfaces, enums, and type aliases.
// No side effects, no runtime logic.
// ============================================================

// ─── Time & Schedule Types ───────────────────────────────────

/** Hours in 24h format (0–23), Minutes (0–59) */
export interface TimeOfDay {
  hour: number;   // 0–23
  minute: number; // 0–59
}

export enum DayOfWeek {
  Sunday = 0,
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6,
}

/** A time window for scheduling a habit */
export interface TimeWindow {
  start: TimeOfDay;
  end: TimeOfDay;
}

// ─── Habit Definition ───────────────────────────────────────

export enum HabitCategory {
  Health = "health",
  Fitness = "fitness",
  Mindfulness = "mindfulness",
  Productivity = "productivity",
  Learning = "learning",
  Social = "social",
  Finance = "finance",
  Creativity = "creativity",
  Other = "other",
}

export enum HabitFrequency {
  Daily = "daily",
  Weekly = "weekly",
  Weekdays = "weekdays",
  Weekends = "weekends",
  Custom = "custom",
}

export interface Habit {
  /** Unique identifier for the habit */
  id: string;
  /** User-given name (e.g., "Morning Run") */
  title: string;
  /** Optional description or notes */
  description?: string;
  category: HabitCategory;
  frequency: HabitFrequency;
  /** For Custom frequency: which days of the week this habit should be done */
  customDays?: DayOfWeek[];
  /** User's preferred time window for this habit (can be auto-adjusted by scheduling engine) */
  preferredWindow?: TimeWindow;
  /** When the habit was created */
  createdAt: Date;
  /** Whether this habit is active (not archived/deleted) */
  active: boolean;
}

// ─── Completion Records ─────────────────────────────────────

export interface HabitCompletion {
  /** Unique ID for this completion record */
  id: string;
  /** The habit this completion is for */
  habitId: string;
  /** When the user completed the habit (ISO timestamp) */
  completedAt: Date;
  /** How the user felt about that session (optional mood rating 1–5) */
  moodRating?: number; // 1–5
  /** Optional notes the user left */
  notes?: string;
}

// ─── Streak Tracking ────────────────────────────────────────

export interface StreakInfo {
  /** The habit this streak applies to */
  habitId: string;
  /** Current streak length in days */
  currentStreak: number;
  /** Longest-ever streak length in days */
  longestStreak: number;
  /** Date of the most recent completion */
  lastCompletedDate: Date | null;
  /** Whether the streak is currently "alive" */
  isActive: boolean;
  /** Array of recent completion dates for pattern analysis */
  recentCompletionDates: Date[];
}

// ─── Scheduling Engine Outputs ──────────────────────────────

export interface TimeSlotScore {
  /** Hour of the day (0–23) */
  hour: number;
  /** Normalized score 0–1 indicating how likely the user is to complete at this hour */
  score: number;
  /** Number of data points supporting this score */
  sampleCount: number;
}

export interface ScheduleSuggestion {
  /** The habit this suggestion is for */
  habitId: string;
  /** The suggested optimal time */
  suggestedTime: TimeOfDay;
  /** Confidence level: how reliable this suggestion is */
  confidence: "high" | "medium" | "low";
  /** Full 24-hour scoring distribution */
  hourlyScores: TimeSlotScore[];
  /** Human-readable reasoning */
  reasoning: string;
}

export interface PeakProductivityWindow {
  /** Label for this window (e.g., "Morning Peak", "Afternoon Slump") */
  label: string;
  window: TimeWindow;
  /** Average completion rate in this window 0–1 */
  averageCompletionRate: number;
}

// ─── Streak Guard Outputs ───────────────────────────────────

export enum StreakRiskLevel {
  Safe = "safe",
  Warning = "warning",
  Critical = "critical",
}

export interface StreakGuardAlert {
  /** The habit at risk */
  habitId: string;
  habitTitle: string;
  riskLevel: StreakRiskLevel;
  /** How many hours remaining in the user's typical completion window */
  hoursRemaining: number;
  /** Current streak that's at risk */
  currentStreak: number;
  /** Coaching message to show the user */
  coachingMessage: string;
  /** Suggested action text */
  suggestedAction: string;
  /** Timeliness: when this alert was generated */
  generatedAt: Date;
}

// ─── Coaching & Insights Outputs ────────────────────────────

export type CoachingInsightType = "achievement" | "warning" | "trend" | "tip";

export interface CoachingInsight {
  type: CoachingInsightType;
  habitId: string;
  title: string;
  message: string;
  /** Optional icon or emoji for display */
  badgeDisplay?: string;
  /** When this insight was generated */
  generatedAt: Date;
}

export interface WeeklySummary {
  /** ISO week identifier (e.g., "2026-W25") */
  weekId: string;
  /** Start date of the week */
  weekStart: Date;
  /** End date of the week */
  weekEnd: Date;
  /** Overall completion rate 0–1 */
  completionRate: number;
  /** Total habits tracked this week */
  totalHabits: number;
  /** Number of habits completed on schedule */
  habitsCompleted: number;
  /** Best day this week */
  bestDay: { day: DayOfWeek; rate: number } | null;
  /** Worst day this week */
  worstDay: { day: DayOfWeek; rate: number } | null;
  /** Categories ranked by performance */
  categoryBreakdown: { category: HabitCategory; rate: number }[];
  /** Streak milestones hit this week */
  streakMilestones: StreakMilestone[];
}

export interface StreakMilestone {
  habitId: string;
  habitTitle: string;
  streakLength: number;
  message: string;
}

// ─── Habit Suggester Outputs ────────────────────────────────

export interface HabitSuggestion {
  /** Suggested habit title / name */
  title: string;
  /** Why this habit is suggested */
  reasoning: string;
  category: HabitCategory;
  /** Estimated difficulty for the user (1 = easiest, 5 = hardest) */
  difficulty: number;
  /** Source category that triggered this suggestion */
  basedOnCategory: HabitCategory;
  /** Suggested frequency */
  suggestedFrequency: HabitFrequency;
}

// ─── Full Engine Input / Output ─────────────────────────────

export interface EngineInput {
  habits: Habit[];
  completions: HabitCompletion[];
  /** Current date/time for "now" reference (allows deterministic testing) */
  now: Date;
}

export interface EngineOutput {
  scheduleSuggestions: ScheduleSuggestion[];
  streakAlerts: StreakGuardAlert[];
  coachingInsights: CoachingInsight[];
  habitSuggestions: HabitSuggestion[];
  weeklySummary: WeeklySummary | null;
}