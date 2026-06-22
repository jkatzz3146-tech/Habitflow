// ============================================================
// streak-guard.ts — Streak Risk Detection & Coaching
//
// Monitors habit streaks and generates proactive coaching
// messages when a streak is at risk of being broken.
//
// Pure functions, no side effects, fully testable.
// ============================================================

import {
  Habit,
  HabitCompletion,
  StreakInfo,
  StreakGuardAlert,
  StreakRiskLevel,
  ScheduleSuggestion,
  DayOfWeek,
} from "./types";

// ─── Constants ──────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STREAK_CRITICAL_HOURS = 2; // Within 2 hours of usual time -> critical
const STREAK_WARNING_HOURS = 4; // Within 4 hours of usual time -> warning
const STREAK_MILESTONE_DAYS = [3, 7, 14, 21, 30, 60, 90, 100, 180, 365];

// ─── Helpers ────────────────────────────────────────────────

/** Get start of a date (midnight) */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Difference in days between two dates (absolute) */
function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY;
}

/** Check if two dates are the same calendar day */
function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/**
 * Calculate the current streak for a habit from its completions.
 */
export function calculateStreak(
  habitId: string,
  completions: HabitCompletion[],
  now: Date
): StreakInfo {
  const habitCompletions = completions
    .filter((c) => c.habitId === habitId)
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime()); // newest first

  const recentCompletionDates = habitCompletions.map((c) => c.completedAt);
  const lastCompleted = habitCompletions.length > 0
    ? habitCompletions[0].completedAt
    : null;

  if (!lastCompleted) {
    return {
      habitId,
      currentStreak: 0,
      longestStreak: 0,
      lastCompletedDate: null,
      isActive: false,
      recentCompletionDates: [],
    };
  }

  // Calculate current streak by counting consecutive days backward from most recent
  // A "day" means the completion happened on consecutive calendar days
  const uniqueDays = new Set<string>();
  for (const c of habitCompletions) {
    uniqueDays.add(startOfDay(c.completedAt).toISOString());
  }

  // Get sorted unique days (descending)
  const sortedDays = Array.from(uniqueDays)
    .map((d) => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime());

  // Count consecutive days from today (or last completed day)
  let currentStreak = 0;
  const lastDay = startOfDay(lastCompleted);
  const today = startOfDay(now);
  const daysSinceLastCompletion = daysBetween(today, lastDay);

  // If last completion was more than 1 day ago (and not today), streak is broken
  if (daysSinceLastCompletion > 1 && !isSameDay(today, lastDay)) {
    currentStreak = 0;
  } else {
    // Walk backward through consecutive days
    for (let i = 0; i < sortedDays.length; i++) {
      const expectedDay = new Date(today.getTime() - i * MS_PER_DAY);
      const dayMatch = sortedDays.find((d) => isSameDay(d, expectedDay));
      if (dayMatch) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const diff = daysBetween(sortedDays[i - 1], sortedDays[i]);
    if (Math.round(diff) === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return {
    habitId,
    currentStreak,
    longestStreak,
    lastCompletedDate: lastCompleted,
    isActive: currentStreak > 0,
    recentCompletionDates,
  };
}

/**
 * Calculate streaks for all habits at once.
 */
export function calculateAllStreaks(
  habits: Habit[],
  completions: HabitCompletion[],
  now: Date
): Map<string, StreakInfo> {
  const result = new Map<string, StreakInfo>();
  for (const habit of habits) {
    if (habit.active) {
      result.set(habit.id, calculateStreak(habit.id, completions, now));
    }
  }
  return result;
}

/**
 * Check if today is a milestone worth celebrating.
 */
export function isStreakMilestone(streakLength: number): boolean {
  return STREAK_MILESTONE_DAYS.includes(streakLength);
}

/**
 * Get a milestone celebration message.
 */
export function getMilestoneMessage(streakLength: number, habitTitle: string): string | null {
  if (!isStreakMilestone(streakLength)) return null;

  const messages: Record<number, string> = {
    3: `🔥 3-day streak for "${habitTitle}"! You're building momentum.`,
    7: `🌟 One week of "${habitTitle}"! Consistency is taking root.`,
    14: `💪 Two weeks strong on "${habitTitle}"! This is becoming a habit.`,
    21: `🎯 21 days of "${habitTitle}"! It takes 21 days to form a habit — you're doing it!`,
    30: `🏆 One-month streak for "${habitTitle}"! That's a major achievement.`,
    60: `📈 Two months of "${habitTitle}"! Your consistency is inspiring.`,
    90: `🎉 90 days of "${habitTitle}"! This habit is now part of your lifestyle.`,
    100: `💯 100-day streak for "${habitTitle}"! Triple digits — incredible dedication.`,
    180: `⭐ Half a year of "${habitTitle}"! Six months of unwavering commitment.`,
    365: `👑 ONE YEAR of "${habitTitle}"! 365 days of dedication. You're a habit master!`,
  };

  return messages[streakLength] || null;
}

// ─── Streak Risk Detection ──────────────────────────────────

/**
 * Determine the risk level for a habit streak based on the current time
 * relative to the user's typical completion time.
 */
export function evaluateStreakRisk(
  streak: StreakInfo,
  habit: Habit,
  scheduleSuggestion: ScheduleSuggestion | null,
  now: Date
): { riskLevel: StreakRiskLevel; hoursRemaining: number } {
  // If streak is already broken or never started, no risk
  if (!streak.isActive || streak.currentStreak < 1) {
    return { riskLevel: StreakRiskLevel.Safe, hoursRemaining: 24 };
  }

  // Check if already completed today
  const today = startOfDay(now);
  const completedToday = streak.recentCompletionDates.some((d) => isSameDay(d, today));
  if (completedToday) {
    return { riskLevel: StreakRiskLevel.Safe, hoursRemaining: 24 };
  }

  // Determine expected completion hour
  const expectedHour = scheduleSuggestion?.suggestedTime.hour ?? 20; // default 8 PM
  const currentHour = now.getHours();

  // Calculate how many hours past the expected time
  let hoursPastExpected = currentHour - expectedHour;
  if (hoursPastExpected < 0) {
    // Still before the expected time — no risk yet
    return {
      riskLevel: StreakRiskLevel.Safe,
      hoursRemaining: expectedHour - currentHour,
    };
  }

  // Hours remaining in the day
  const hoursRemaining = 24 - currentHour;

  if (hoursPastExpected >= STREAK_CRITICAL_HOURS && hoursPastExpected < STREAK_WARNING_HOURS) {
    return { riskLevel: StreakRiskLevel.Critical, hoursRemaining };
  }

  if (hoursPastExpected >= STREAK_WARNING_HOURS) {
    return { riskLevel: StreakRiskLevel.Critical, hoursRemaining };
  }

  // Past expected but within the critical window
  return { riskLevel: StreakRiskLevel.Warning, hoursRemaining };
}

// ─── Coaching Message Generation ────────────────────────────

/**
 * Generate a contextual coaching message based on risk level and streak info.
 */
export function generateCoachingMessage(
  habit: Habit,
  streak: StreakInfo,
  riskLevel: StreakRiskLevel,
  hoursRemaining: number,
  scheduleSuggestion: ScheduleSuggestion | null
): { coachingMessage: string; suggestedAction: string } {
  if (riskLevel === StreakRiskLevel.Safe) {
    // Streak is safe — generate an encouraging message instead
    if (streak.currentStreak >= 7) {
      return {
        coachingMessage: `You're on a ${streak.currentStreak}-day streak for "${habit.title}"! Keep it going — you've got this.`,
        suggestedAction: `Complete "${habit.title}" at your usual time to keep the streak alive.`,
      };
    }
    return {
      coachingMessage: `"${habit.title}" is on track for today. Consistency builds streaks!`,
      suggestedAction: `Stay on schedule with "${habit.title}".`,
    };
  }

  const expectedTime = scheduleSuggestion
    ? `${scheduleSuggestion.suggestedTime.hour.toString().padStart(2, "0")}:${scheduleSuggestion.suggestedTime.minute.toString().padStart(2, "0")}`
    : "your usual time";

  if (riskLevel === StreakRiskLevel.Warning) {
    return {
      coachingMessage: `⏰ Heads up! You usually do "${habit.title}" around ${expectedTime} and it's getting late. Don't let your ${streak.currentStreak}-day streak slip!`,
      suggestedAction: `Take 5 minutes to do "${habit.title}" now and keep the streak alive.`,
    };
  }

  // Critical
  if (streak.currentStreak >= 30) {
    return {
      coachingMessage: `🚨 Your ${streak.currentStreak}-day streak for "${habit.title}" is in jeopardy! You typically do this around ${expectedTime}. Even a quick session counts — don't lose your progress now!`,
      suggestedAction: `Drop everything and spend 2 minutes on "${habit.title}" right now — a tiny effort saves the streak!`,
    };
  }

  if (streak.currentStreak >= 7) {
    return {
      coachingMessage: `⚠️ Your ${streak.currentStreak}-day streak for "${habit.title}" is at risk! You usually complete this around ${expectedTime}. There's still time today — don't break the chain!`,
      suggestedAction: `Do "${habit.title}" now to save your streak. Even a minimal version counts!`,
    };
  }

  return {
    coachingMessage: `👀 You haven't done "${habit.title}" yet today (usual time: ${expectedTime}). A ${streak.currentStreak}-day streak is building — keep it going!`,
    suggestedAction: `Quick — do "${habit.title}" now before the day ends!`,
  };
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Evaluate all habits and return streak alerts for those at risk.
 * Only returns alerts for habits where a streak is actually in progress.
 */
export function checkAllStreaks(
  habits: Habit[],
  completions: HabitCompletion[],
  scheduleSuggestions: ScheduleSuggestion[],
  now: Date
): StreakGuardAlert[] {
  const alerts: StreakGuardAlert[] = [];
  const streaks = calculateAllStreaks(habits, completions, now);
  const scheduleMap = new Map<string, ScheduleSuggestion>();
  for (const s of scheduleSuggestions) {
    scheduleMap.set(s.habitId, s);
  }

  for (const habit of habits) {
    if (!habit.active) continue;
    const streak = streaks.get(habit.id);
    if (!streak || streak.currentStreak < 1) continue;

    const schedule = scheduleMap.get(habit.id) ?? null;
    const { riskLevel, hoursRemaining } = evaluateStreakRisk(
      streak,
      habit,
      schedule,
      now
    );

    if (riskLevel === StreakRiskLevel.Safe) continue;

    const { coachingMessage, suggestedAction } = generateCoachingMessage(
      habit,
      streak,
      riskLevel,
      hoursRemaining,
      schedule
    );

    alerts.push({
      habitId: habit.id,
      habitTitle: habit.title,
      riskLevel,
      hoursRemaining,
      currentStreak: streak.currentStreak,
      coachingMessage,
      suggestedAction,
      generatedAt: new Date(now),
    });
  }

  // Sort by risk level (critical first), then by streak length (longer = higher priority)
  alerts.sort((a, b) => {
    const riskOrder = { critical: 0, warning: 1, safe: 2 } as const;
    const riskDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    if (riskDiff !== 0) return riskDiff;
    return b.currentStreak - a.currentStreak;
  });

  return alerts;
}