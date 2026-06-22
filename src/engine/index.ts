// ============================================================
// HabitFlow AI Engine — Unified Entry Point
//
// Single import for the entire AI engine module.
// Exports all pure functions and types with a clean API.
//
// Usage:
//   import { runEngine, suggestSchedule, checkStreaks, ... } from './engine';
// ============================================================

// ─── Types ──────────────────────────────────────────────────

export type {
  TimeOfDay,
  TimeWindow,
  Habit,
  HabitCompletion,
  StreakInfo,
  TimeSlotScore,
  ScheduleSuggestion,
  PeakProductivityWindow,
  StreakGuardAlert,
  CoachingInsight,
  WeeklySummary,
  StreakMilestone,
  HabitSuggestion,
  EngineInput,
  EngineOutput,
} from "./types";

export {
  DayOfWeek,
  HabitCategory,
  HabitFrequency,
  StreakRiskLevel,
  CoachingInsightType,
} from "./types";

// ─── Scheduling Engine ──────────────────────────────────────

export {
  analyzeHourlyDistribution,
  findBestTimeSlot,
  suggestScheduleForHabit,
  suggestAllSchedules,
  detectPeakProductivityWindows,
  isOnSchedule,
} from "./scheduling-engine";

// ─── Streak Guard ───────────────────────────────────────────

export {
  calculateStreak,
  calculateAllStreaks,
  evaluateStreakRisk,
  generateCoachingMessage,
  checkAllStreaks,
  isStreakMilestone,
  getMilestoneMessage,
} from "./streak-guard";

// ─── Insights Engine ────────────────────────────────────────

export {
  generateWeeklySummary,
  generateCoachingInsights,
  generateWeeklyNarrative,
  detectStreakMilestones,
} from "./insights-engine";

// ─── Habit Suggester ────────────────────────────────────────

export {
  suggestComplementaryHabits,
  suggestNextHabit,
} from "./habit-suggester";

// ─── Mappers ────────────────────────────────────────────────
export {
  mapHabitToEngine,
  mapLogToEngine,
} from "../utils/mappers";

// ─── Orchestrator: Run Everything ───────────────────────────

import {
  suggestAllSchedules,
  detectPeakProductivityWindows,
} from "./scheduling-engine";
import {
  checkAllStreaks,
  calculateAllStreaks,
} from "./streak-guard";
import {
  generateCoachingInsights,
  generateWeeklySummary,
} from "./insights-engine";
import {
  suggestComplementaryHabits,
} from "./habit-suggester";
import type {
  EngineInput,
  EngineOutput,
} from "./types";

/**
 * Run the complete AI engine on a full input payload.
 * This is the primary entry point for the mobile app.
 *
 * Returns predictions, suggestions, alerts, and coaching
 * messages for all active habits.
 *
 * Pure function — no side effects, deterministic given input.
 */
export function runEngine(input: EngineInput): EngineOutput {
  const { habits, completions, now } = input;
  const activeHabits = habits.filter((h) => h.active);

  // 1. Scheduling — optimal times for each habit
  const scheduleSuggestions = suggestAllSchedules(activeHabits, completions);
  const productivityWindows = detectPeakProductivityWindows(activeHabits, completions);

  // 2. Streak tracking
  const streakMap = calculateAllStreaks(activeHabits, completions, now);
  const streakAlerts = checkAllStreaks(
    activeHabits,
    completions,
    scheduleSuggestions,
    now
  );

  // Build streaks array for insights engine
  const streaks = Array.from(streakMap.entries())
    .filter(([, s]) => s.currentStreak > 0)
    .map(([habitId, streak]) => {
      const habit = activeHabits.find((h) => h.id === habitId);
      return {
        habitId,
        habitTitle: habit?.title ?? "Unknown",
        currentStreak: streak.currentStreak,
      };
    });

  // 3. Insights & coaching
  const coachingInsights = generateCoachingInsights(
    activeHabits,
    completions,
    streaks,
    now
  );

  const weeklySummary = generateWeeklySummary(activeHabits, completions, now);

  if (weeklySummary) {
    weeklySummary.streakMilestones = coachingInsights
      .filter((i) => i.type === "achievement" && i.badgeDisplay === "🔥")
      .map((i) => ({
        habitId: i.habitId,
        habitTitle: i.title.replace("-Day Streak!", "").trim(),
        streakLength: parseInt(i.title.split("-")[0], 10) || 0,
        message: i.message,
      }));
  }

  // 4. Habit suggestions
  const habitSuggestions = suggestComplementaryHabits(activeHabits, completions, 5);

  return {
    scheduleSuggestions,
    streakAlerts,
    coachingInsights,
    habitSuggestions,
    weeklySummary,
  };
}