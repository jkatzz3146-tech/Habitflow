// ============================================================
// scheduling-engine.ts — Smart Scheduling Engine
//
// Analyzes habit completion patterns to:
// - Suggest optimal times of day for each habit
// - Identify peak productivity windows
// - Provide hourly scoring distributions
// - Generate human-readable reasoning
//
// Pure functions, no side effects, fully testable.
// ============================================================

import {
  Habit,
  HabitCompletion,
  TimeOfDay,
  TimeSlotScore,
  ScheduleSuggestion,
  PeakProductivityWindow,
  DayOfWeek,
} from "./types";

// ─── Constants ──────────────────────────────────────────────

const HOURS_IN_DAY = 24;
const MIN_SAMPLES_FOR_HIGH_CONFIDENCE = 10;
const MIN_SAMPLES_FOR_MEDIUM_CONFIDENCE = 3;

// ─── Helpers ────────────────────────────────────────────────

/** Extract the hour (0–23) from a Date */
function getHour(date: Date): number {
  return date.getHours();
}

/** Check if two TimeOfDay values are equal */
function timesEqual(a: TimeOfDay, b: TimeOfDay): boolean {
  return a.hour === b.hour && a.minute === b.minute;
}

/** Format TimeOfDay as a readable string (e.g., "7:30 AM") */
function formatTimeOfDay(t: TimeOfDay): string {
  const period = t.hour >= 12 ? "PM" : "AM";
  const hour12 = t.hour === 0 ? 12 : t.hour > 12 ? t.hour - 12 : t.hour;
  const minuteStr = t.minute.toString().padStart(2, "0");
  return `${hour12}:${minuteStr} ${period}`;
}

/** Generate a human-readable label for an hour range */
function hourRangeLabel(startHour: number, endHour: number): string {
  const periods: { label: string; start: number; end: number }[] = [
    { label: "Early Morning", start: 4, end: 7 },
    { label: "Morning", start: 7, end: 10 },
    { label: "Late Morning", start: 10, end: 12 },
    { label: "Early Afternoon", start: 12, end: 14 },
    { label: "Afternoon", start: 14, end: 17 },
    { label: "Early Evening", start: 17, end: 19 },
    { label: "Evening", start: 19, end: 22 },
    { label: "Late Night", start: 22, end: 24 },
    { label: "Overnight", start: 0, end: 4 },
  ];

  const midHour = (startHour + endHour) / 2;
  for (const period of periods) {
    if (midHour >= period.start && midHour < period.end) {
      return period.label;
    }
  }
  return "Custom Time";
}

/** Count how many completions a habit has total */
function countCompletions(habitId: string, completions: HabitCompletion[]): number {
  return completions.filter((c) => c.habitId === habitId).length;
}

// ─── Core: Analyze completion times for a habit ────────────

/**
 * Compute hourly completion distribution for a specific habit.
 * Returns an array of 24 TimeSlotScore objects, one per hour.
 * Scores are normalized 0–1 based on how often the user completes
 * the habit during that hour vs other hours.
 */
export function analyzeHourlyDistribution(
  habitId: string,
  completions: HabitCompletion[]
): TimeSlotScore[] {
  // Count completions per hour
  const hourCounts = new Array<number>(HOURS_IN_DAY).fill(0);
  let totalRelevant = 0;

  for (const completion of completions) {
    if (completion.habitId !== habitId) continue;
    const hour = getHour(completion.completedAt);
    hourCounts[hour]++;
    totalRelevant++;
  }

  if (totalRelevant === 0) {
    // No data — return uniform distribution
    return Array.from({ length: HOURS_IN_DAY }, (_, hour) => ({
      hour,
      score: 0,
      sampleCount: 0,
    }));
  }

  const maxCount = Math.max(...hourCounts);
  const divisor = maxCount > 0 ? maxCount : 1;

  return hourCounts.map((count, hour) => ({
    hour,
    score: count / divisor, // normalize to 0–1
    sampleCount: count,
  }));
}

/**
 * Find the single best time slot for a habit.
 * Picks the hour with the highest completion count.
 * If tied, picks the earliest hour.
 */
export function findBestTimeSlot(
  habitId: string,
  completions: HabitCompletion[],
  preferredWindow?: { start: TimeOfDay; end: TimeOfDay }
): { hour: number; score: number; count: number } | null {
  const distribution = analyzeHourlyDistribution(habitId, completions);
  const totalCompletions = countCompletions(habitId, completions);

  if (totalCompletions === 0) return null;

  let filtered = distribution;

  // If user has a preferred window, boost scores within that window
  if (preferredWindow) {
    filtered = distribution.map((slot) => {
      const inWindow =
        slot.hour >= preferredWindow.start.hour &&
        slot.hour < preferredWindow.end.hour;
      return {
        ...slot,
        score: inWindow ? slot.score * 1.5 : slot.score * 0.5,
      };
    });
  }

  let best = filtered[0];
  for (const slot of filtered) {
    if (
      slot.score > best.score ||
      (slot.score === best.score &&
        slot.sampleCount > best.sampleCount)
    ) {
      best = slot;
    }
  }

  return best.score > 0
    ? { hour: best.hour, score: best.score, count: best.sampleCount }
    : null;
}

// ─── Confidence Calculation ─────────────────────────────────

function calculateConfidence(
  sampleCount: number,
  totalCompletions: number
): "high" | "medium" | "low" {
  if (sampleCount >= MIN_SAMPLES_FOR_HIGH_CONFIDENCE && totalCompletions >= 5) {
    return "high";
  }
  if (sampleCount >= MIN_SAMPLES_FOR_MEDIUM_CONFIDENCE) {
    return "medium";
  }
  return "low";
}

// ─── Reasoning Generation ───────────────────────────────────

function generateReasoning(
  habitTitle: string,
  bestHour: number,
  confidence: "high" | "medium" | "low",
  sampleCount: number,
  preferredWindow?: { start: TimeOfDay; end: TimeOfDay }
): string {
  const timeLabel = hourRangeLabel(bestHour, bestHour + 1);
  const formattedTime = formatTimeOfDay({ hour: bestHour, minute: 0 });

  if (confidence === "high") {
    if (preferredWindow) {
      return `You consistently complete "${habitTitle}" during the ${timeLabel} (around ${formattedTime}), which aligns well with your preferred schedule. Based on ${sampleCount} data points, this is your most reliable time.`;
    }
    return `Based on ${sampleCount} completed sessions, your most productive time for "${habitTitle}" is the ${timeLabel} around ${formattedTime}. You have strong consistency at this hour.`;
  }

  if (confidence === "medium") {
    return `Early data suggests the ${timeLabel} (around ${formattedTime}) works well for "${habitTitle}". Keep tracking to refine this recommendation.`;
  }

  return `Not enough data yet to suggest an optimal time for "${habitTitle}". Complete it a few more times and check back for personalized scheduling.`;
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Generate a full schedule suggestion for a single habit.
 */
export function suggestScheduleForHabit(
  habit: Habit,
  completions: HabitCompletion[]
): ScheduleSuggestion {
  const hourlyScores = analyzeHourlyDistribution(habit.id, completions);
  const best = findBestTimeSlot(habit.id, completions, habit.preferredWindow);
  const totalCompletions = countCompletions(habit.id, completions);

  if (!best) {
    return {
      habitId: habit.id,
      suggestedTime: habit.preferredWindow?.start ?? { hour: 9, minute: 0 },
      confidence: "low",
      hourlyScores,
      reasoning: `Not enough data yet to suggest an optimal time for "${habit.title}". Start tracking to receive personalized suggestions.`,
    };
  }

  const confidence = calculateConfidence(best.count, totalCompletions);

  return {
    habitId: habit.id,
    suggestedTime: { hour: best.hour, minute: 0 },
    confidence,
    hourlyScores,
    reasoning: generateReasoning(
      habit.title,
      best.hour,
      confidence,
      best.count,
      habit.preferredWindow
    ),
  };
}

/**
 * Generate schedule suggestions for all active habits.
 */
export function suggestAllSchedules(
  habits: Habit[],
  completions: HabitCompletion[]
): ScheduleSuggestion[] {
  return habits
    .filter((h) => h.active)
    .map((habit) => suggestScheduleForHabit(habit, completions));
}

/**
 * Detect the user's peak productivity windows by aggregating
 * completion data across all habits.
 */
export function detectPeakProductivityWindows(
  habits: Habit[],
  completions: HabitCompletion[]
): PeakProductivityWindow[] {
  // Aggregate completions across all habits into hour buckets
  const hourCounts = new Array<number>(HOURS_IN_DAY).fill(0);
  const activeHabitIds = new Set(habits.filter((h) => h.active).map((h) => h.id));

  for (const completion of completions) {
    if (!activeHabitIds.has(completion.habitId)) continue;
    const hour = getHour(completion.completedAt);
    hourCounts[hour]++;
  }

  const totalCompletions = hourCounts.reduce((a, b) => a + b, 0);
  if (totalCompletions === 0) return [];

  // Define standard windows
  const windowDefs: { label: string; start: number; end: number }[] = [
    { label: "Morning (6–10 AM)", start: 6, end: 10 },
    { label: "Midday (10 AM–2 PM)", start: 10, end: 14 },
    { label: "Afternoon (2–6 PM)", start: 14, end: 18 },
    { label: "Evening (6–10 PM)", start: 18, end: 22 },
    { label: "Night (10 PM–2 AM)", start: 22, end: 26 }, // wrap past midnight
    { label: "Early Morning (2–6 AM)", start: 2, end: 6 },
  ];

  return windowDefs
    .map((wd) => {
      let count = 0;
      for (let h = wd.start; h < wd.end; h++) {
        count += hourCounts[h % 24];
      }
      return {
        label: wd.label,
        window: {
          start: { hour: wd.start % 24, minute: 0 },
          end: { hour: wd.end % 24, minute: 0 },
        },
        averageCompletionRate: totalCompletions > 0 ? count / totalCompletions : 0,
      };
    })
    .sort((a, b) => b.averageCompletionRate - a.averageCompletionRate);
}

/**
 * Check if a habit completion time falls within its expected schedule.
 */
export function isOnSchedule(
  habit: Habit,
  completionTime: Date,
  suggestedSchedule: ScheduleSuggestion
): boolean {
  const completionHour = getHour(completionTime);
  const suggestedHour = suggestedSchedule.suggestedTime.hour;
  // Consider "on schedule" if within ±2 hours of suggested time
  return Math.abs(completionHour - suggestedHour) <= 2;
}