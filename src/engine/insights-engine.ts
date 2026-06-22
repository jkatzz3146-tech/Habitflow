// ============================================================
// insights-engine.ts — Weekly Insights & Coaching Summaries
//
// Analyzes past week's habit performance and generates
// natural-language coaching summaries. Detects trends,
// achievements, slips, and actionable tips.
//
// Pure functions, no side effects, fully testable.
// ============================================================

import {
  Habit,
  HabitCompletion,
  HabitCategory,
  CoachingInsight,
  WeeklySummary,
  StreakMilestone,
  DayOfWeek,
} from "./types";

// ─── Constants ──────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ─── Helpers ────────────────────────────────────────────────

/** Get start of a date (midnight) */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Check if a date falls within a given week range */
function isInWeek(date: Date, weekStart: Date, weekEnd: Date): boolean {
  const d = startOfDay(date);
  const start = startOfDay(weekStart);
  const end = startOfDay(weekEnd);
  return d >= start && d <= end;
}

/** Get ISO week string for a date (e.g., "2026-W25") */
function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7);
  const weekStr = weekNum.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-W${weekStr}`;
}

/** Get Monday of the current ISO week */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get Sunday of the current ISO week */
function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** Get the day of week as DayOfWeek enum from Date */
function getDayOfWeek(date: Date): DayOfWeek {
  return date.getDay() as DayOfWeek;
}

/** Format percentage (0–1) as a string like "75%" */
function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** Count completions for a habit in a time window */
function countCompletionsInRange(
  habitId: string,
  completions: HabitCompletion[],
  start: Date,
  end: Date
): number {
  return completions.filter(
    (c) => c.habitId === habitId && isInWeek(c.completedAt, start, end)
  ).length;
}

/** Get the category name in a friendly format */
function categoryLabel(category: HabitCategory): string {
  const labels: Record<string, string> = {
    health: "Health",
    fitness: "Fitness",
    mindfulness: "Mindfulness",
    productivity: "Productivity",
    learning: "Learning",
    social: "Social",
    finance: "Finance",
    creativity: "Creativity",
    other: "Other",
  };
  return labels[category] ?? "Other";
}

// ─── Weekly Summary Generator ───────────────────────────────

/**
 * Generate a comprehensive weekly summary from habit and completion data.
 */
export function generateWeeklySummary(
  habits: Habit[],
  completions: HabitCompletion[],
  now: Date
): WeeklySummary | null {
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(now);
  const activeHabits = habits.filter((h) => h.active);

  if (activeHabits.length === 0) return null;

  // Count completions per day this week
  const dayCompletions = new Map<number, { completed: number; total: number }>();
  for (let i = 0; i < 7; i++) {
    dayCompletions.set(i, { completed: 0, total: 0 });
  }

  let totalCompletedDays = 0;
  let totalEligibleDays = 0;

  // For each active habit, check how many eligible days it had this week
  // and how many were completed
  const habitCompletionCounts = new Map<string, number>();

  for (const habit of activeHabits) {
    let eligibleDays = 7; // For daily habits
    // For now, we use a simplified model: daily habits = 7 eligible days
    // More sophisticated frequency handling is in the scheduling engine
    if (habit.frequency === "weekdays") eligibleDays = 5;
    if (habit.frequency === "weekends") eligibleDays = 2;
    if (habit.frequency === "weekly") eligibleDays = 1;

    totalEligibleDays += eligibleDays;

    const count = countCompletionsInRange(habit.id, completions, weekStart, weekEnd);
    habitCompletionCounts.set(habit.id, count);

    // Count per-day completions
    for (const c of completions) {
      if (c.habitId !== habit.id) continue;
      if (!isInWeek(c.completedAt, weekStart, weekEnd)) continue;
      const dayIndex = c.completedAt.getDay();
      const existing = dayCompletions.get(dayIndex) ?? { completed: 0, total: 0 };
      existing.completed++;
      // Don't double-count: a habit can be completed once per day
      // We're counting completions, not unique habits per day
    }

    const actualCompleted = Math.min(count, eligibleDays);
    totalCompletedDays += actualCompleted;
  }

  // Count unique habits completed per day
  const dayUniqueHabits = new Map<number, Set<string>>();
  for (let i = 0; i < 7; i++) {
    dayUniqueHabits.set(i, new Set());
  }
  for (const c of completions) {
    if (!isInWeek(c.completedAt, weekStart, weekEnd)) continue;
    const day = c.completedAt.getDay();
    const set = dayUniqueHabits.get(day)!;
    set.add(c.habitId);
  }

  // Find best and worst days
  let bestDay: { day: DayOfWeek; rate: number } | null = null;
  let worstDay: { day: DayOfWeek; rate: number } | null = null;

  for (const [dayIndex, set] of dayUniqueHabits) {
    const totalHabitsOnDay = activeHabits.filter((h) => {
      if (h.frequency === "weekdays" && (dayIndex === 0 || dayIndex === 6)) return false;
      if (h.frequency === "weekends" && dayIndex >= 1 && dayIndex <= 5) return false;
      return true;
    }).length;

    const rate = totalHabitsOnDay > 0 ? set.size / totalHabitsOnDay : 0;

    if (!bestDay || rate > bestDay.rate) {
      bestDay = { day: dayIndex as DayOfWeek, rate };
    }
    if (!worstDay || rate < worstDay.rate) {
      worstDay = { day: dayIndex as DayOfWeek, rate };
    }
  }

  // Category breakdown
  const categoryCounts = new Map<HabitCategory, { completed: number; total: number }>();
  for (const habit of activeHabits) {
    const existing = categoryCounts.get(habit.category) ?? { completed: 0, total: 1 };
    existing.total++;
    const count = habitCompletionCounts.get(habit.id) ?? 0;
    if (count > 0) existing.completed++;
    categoryCounts.set(habit.category, existing);
  }

  const categoryBreakdown = Array.from(categoryCounts.entries())
    .map(([category, { completed, total }]) => ({
      category,
      rate: total > 0 ? completed / total : 0,
    }))
    .sort((a, b) => b.rate - a.rate);

  const completionRate =
    totalEligibleDays > 0 ? totalCompletedDays / totalEligibleDays : 0;

  return {
    weekId: getISOWeek(now),
    weekStart,
    weekEnd,
    completionRate,
    totalHabits: activeHabits.length,
    habitsCompleted: activeHabits.filter((h) => (habitCompletionCounts.get(h.id) ?? 0) > 0).length,
    bestDay,
    worstDay,
    categoryBreakdown,
    streakMilestones: [], // Filled in by generateCoachingInsights
  };
}

// ─── Coaching Insight Generators ────────────────────────────

/**
 * Detect streak milestones achieved this week.
 */
export function detectStreakMilestones(
  streaks: { habitId: string; habitTitle: string; currentStreak: number }[],
  now: Date
): StreakMilestone[] {
  const milestones: StreakMilestone[] = [];
  const milestoneDays = [7, 14, 21, 30, 60, 90, 100, 180, 365];

  for (const streak of streaks) {
    if (streak.currentStreak <= 0) continue;
    // Check if the current streak length is a milestone
    for (const day of milestoneDays) {
      if (streak.currentStreak === day) {
        milestones.push({
          habitId: streak.habitId,
          habitTitle: streak.habitTitle,
          streakLength: day,
          message: getMilestoneMessageText(day, streak.habitTitle),
        });
        break; // Only report the highest milestone reached
      }
    }
  }

  return milestones;
}

function getMilestoneMessageText(days: number, title: string): string {
  const messages: Record<number, string> = {
    7: `${days}-day streak for "${title}"! A full week of consistency.`,
    14: `${days}-day streak for "${title}"! Two weeks strong.`,
    21: `${days}-day streak for "${title}"! 21 days to form a habit — you're doing it!`,
    30: `${days}-day streak for "${title}"! One month of dedication.`,
    60: `${days}-day streak for "${title}"! Two months of unwavering commitment.`,
    90: `${days}-day streak for "${title}"! 90 days — this is a lifestyle now.`,
    100: `${days}-day streak for "${title}"! Triple digits! 🎉`,
    180: `${days}-day streak for "${title}"! Half a year of excellence.`,
    365: `${days}-day streak for "${title}"! ONE YEAR! This is legendary. 👑`,
  };
  return messages[days] ?? `${days}-day streak for "${title}"! Amazing work!`;
}

/**
 * Generate achievement insights for habits with strong performance this week.
 */
function generateAchievementInsights(
  weeklySummary: WeeklySummary,
  habits: Habit[],
  completions: HabitCompletion[],
  now: Date
): CoachingInsight[] {
  const insights: CoachingInsight[] = [];
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(now);
  const activeHabits = habits.filter((h) => h.active);

  // Overall completion rate achievement
  if (weeklySummary.completionRate >= 0.9) {
    insights.push({
      type: "achievement",
      habitId: "__overall__",
      title: "Outstanding Week!",
      message: `You crushed it this week with a ${pct(weeklySummary.completionRate)} completion rate! Your consistency is top-tier. Keep riding this momentum!`,
      badgeDisplay: "🏆",
      generatedAt: now,
    });
  } else if (weeklySummary.completionRate >= 0.75) {
    insights.push({
      type: "achievement",
      habitId: "__overall__",
      title: "Great Week",
      message: `Solid week with ${pct(weeklySummary.completionRate)} completion rate. You're building strong habits!`,
      badgeDisplay: "🌟",
      generatedAt: now,
    });
  }

  // Perfect habits (100% this week)
  for (const habit of activeHabits) {
    const count = countCompletionsInRange(habit.id, completions, weekStart, weekEnd);
    let expected = 7; // daily
    if (habit.frequency === "weekdays") expected = 5;
    if (habit.frequency === "weekends") expected = 2;
    if (habit.frequency === "weekly") expected = 1;

    if (count >= expected && count > 0) {
      insights.push({
        type: "achievement",
        habitId: habit.id,
        title: `Perfect Streak: ${habit.title}`,
        message: `100% completion on "${habit.title}" this week! You didn't miss a single session.`,
        badgeDisplay: "💯",
        generatedAt: now,
      });
    }
  }

  return insights;
}

/**
 * Generate warning/improvement insights for habits that are slipping.
 */
function generateImprovementInsights(
  weeklySummary: WeeklySummary,
  habits: Habit[],
  completions: HabitCompletion[],
  now: Date
): CoachingInsight[] {
  const insights: CoachingInsight[] = [];
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(now);
  const activeHabits = habits.filter((h) => h.active);

  // Low overall completion
  if (weeklySummary.completionRate < 0.5 && weeklySummary.totalHabits > 0) {
    insights.push({
      type: "warning",
      habitId: "__overall__",
      title: "Rough Week",
      message: `This week was tough with a ${pct(weeklySummary.completionRate)} completion rate. That's okay — every week is a fresh start. Try reducing the number of habits or adjusting their schedules.`,
      badgeDisplay: "💪",
      generatedAt: now,
    });
  }

  // Habits that were completely missed this week
  for (const habit of activeHabits) {
    const count = countCompletionsInRange(habit.id, completions, weekStart, weekEnd);
    if (count === 0) {
      insights.push({
        type: "warning",
        habitId: habit.id,
        title: `Missed: ${habit.title}`,
        message: `You didn't complete "${habit.title}" at all this week. Consider whether the timing or frequency still works for you.`,
        badgeDisplay: "📋",
        generatedAt: now,
      });
    }
  }

  // Worst day feedback
  if (weeklySummary.worstDay && weeklySummary.worstDay.rate < 0.3) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = dayNames[weeklySummary.worstDay.day];
    insights.push({
      type: "warning",
      habitId: "__overall__",
      title: `Tough Day: ${dayName}s`,
      message: `${dayName}s are your most challenging day (${pct(weeklySummary.worstDay.rate)} completion). What changed on ${dayName}s? Maybe a lighter habit load on that day would help.`,
      badgeDisplay: "📉",
      generatedAt: now,
    });
  }

  return insights;
}

/**
 * Generate trend insights comparing performance patterns.
 */
function generateTrendInsights(
  weeklySummary: WeeklySummary,
  habits: Habit[],
  completions: HabitCompletion[],
  now: Date
): CoachingInsight[] {
  const insights: CoachingInsight[] = [];
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(now);

  // Category-based trends
  if (weeklySummary.categoryBreakdown.length > 1) {
    const best = weeklySummary.categoryBreakdown[0];
    const worst = weeklySummary.categoryBreakdown[weeklySummary.categoryBreakdown.length - 1];

    if (best.rate > worst.rate + 0.3) {
      insights.push({
        type: "trend",
        habitId: "__overall__",
        title: "Category Insight",
        message: `Your ${categoryLabel(best.category)} habits are thriving (${pct(best.rate)}) while ${categoryLabel(worst.category)} habits need attention (${pct(worst.rate)}). Try attaching a ${categoryLabel(worst.category)} habit to an existing ${categoryLabel(best.category)} routine.`,
        badgeDisplay: "📊",
        generatedAt: now,
      });
    }
  }

  // Morning vs evening patterns (approximate based on hour)
  const morningCompletions = completions.filter(
    (c) => isInWeek(c.completedAt, weekStart, weekEnd) && c.completedAt.getHours() >= 5 && c.completedAt.getHours() < 12
  ).length;
  const eveningCompletions = completions.filter(
    (c) => isInWeek(c.completedAt, weekStart, weekEnd) && c.completedAt.getHours() >= 17 && c.completedAt.getHours() < 23
  ).length;
  const otherCompletions = completions.filter(
    (c) => isInWeek(c.completedAt, weekStart, weekEnd)
  ).length - morningCompletions - eveningCompletions;

  const total = morningCompletions + eveningCompletions + otherCompletions;
  if (total > 5) {
    const morningPct = morningCompletions / total;
    const eveningPct = eveningCompletions / total;

    if (morningPct > 0.6) {
      insights.push({
        type: "trend",
        habitId: "__overall__",
        title: "You're a Morning Person!",
        message: `${pct(morningPct)} of your completions happen in the morning (5 AM–12 PM). You're most productive early — schedule important habits in the AM.`,
        badgeDisplay: "🌅",
        generatedAt: now,
      });
    } else if (eveningPct > 0.6) {
      insights.push({
        type: "trend",
        habitId: "__overall__",
        title: "Night Owl Detected",
        message: `${pct(eveningPct)} of your completions happen in the evening (5 PM–11 PM). You wind down by getting things done — keep your evening routine strong.`,
        badgeDisplay: "🌙",
        generatedAt: now,
      });
    }
  }

  return insights;
}

/**
 * Generate actionable tips based on user's data patterns.
 */
function generateTips(
  weeklySummary: WeeklySummary,
  habits: Habit[],
  now: Date
): CoachingInsight[] {
  const insights: CoachingInsight[] = [];
  const activeHabits = habits.filter((h) => h.active);

  // Tip: habit stacking suggestion if user has low completion
  if (weeklySummary.completionRate < 0.7 && activeHabits.length >= 2) {
    insights.push({
      type: "tip",
      habitId: "__overall__",
      title: "Try Habit Stacking",
      message: `You have ${activeHabits.length} active habits. Try pairing a habit you often skip with one you never miss. For example, do the skipped habit right before or after your strongest habit.`,
      badgeDisplay: "🧩",
      generatedAt: now,
    });
  }

  // Tip: reduce scope
  if (activeHabits.length > 5 && weeklySummary.completionRate < 0.6) {
    insights.push({
      type: "tip",
      habitId: "__overall__",
      title: "Maybe Too Many Habits?",
      message: `You're tracking ${activeHabits.length} habits with a ${pct(weeklySummary.completionRate)} completion rate. Research suggests starting with 2–3 habits at a time. Consider focusing on fewer habits until they feel automatic.`,
      badgeDisplay: "🎯",
      generatedAt: now,
    });
  }

  return insights;
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Generate the full set of coaching insights for a week.
 * Returns achievements, warnings, trends, and tips based on
 * the user's habit completion data for the past 7 days.
 */
export function generateCoachingInsights(
  habits: Habit[],
  completions: HabitCompletion[],
  streaks: { habitId: string; habitTitle: string; currentStreak: number }[],
  now: Date
): CoachingInsight[] {
  const weeklySummary = generateWeeklySummary(habits, completions, now);
  if (!weeklySummary) return [];

  // Detect streak milestones and attach to summary
  const milestones = detectStreakMilestones(streaks, now);
  weeklySummary.streakMilestones = milestones;

  const insights: CoachingInsight[] = [];

  // Milestone celebrations (high priority)
  for (const milestone of milestones) {
    insights.push({
      type: "achievement",
      habitId: milestone.habitId,
      title: `${milestone.streakLength}-Day Streak!`,
      message: milestone.message,
      badgeDisplay: "🔥",
      generatedAt: now,
    });
  }

  // Collect all insights
  insights.push(...generateAchievementInsights(weeklySummary, habits, completions, now));
  insights.push(...generateImprovementInsights(weeklySummary, habits, completions, now));
  insights.push(...generateTrendInsights(weeklySummary, habits, completions, now));
  insights.push(...generateTips(weeklySummary, habits, now));

  // Sort: achievements first, then warnings, trends, tips
  const typeOrder = { achievement: 0, warning: 1, trend: 2, tip: 3 };
  insights.sort((a, b) => {
    const orderDiff = typeOrder[a.type] - typeOrder[b.type];
    if (orderDiff !== 0) return orderDiff;
    return 0;
  });

  return insights;
}

/**
 * Get a natural-language overview of the week's performance.
 */
export function generateWeeklyNarrative(
  habits: Habit[],
  completions: HabitCompletion[],
  now: Date
): string {
  const summary = generateWeeklySummary(habits, completions, now);
  if (!summary) return "No data this week. Start tracking to get insights!";

  const parts: string[] = [];

  // Opening
  parts.push(`📅 Week of ${summary.weekStart.toLocaleDateString()}:`);

  // Overall
  if (summary.completionRate >= 0.9) {
    parts.push(`Outstanding week with ${pct(summary.completionRate)} completion rate!`);
  } else if (summary.completionRate >= 0.75) {
    parts.push(`Solid week — ${pct(summary.completionRate)} of habits completed.`);
  } else if (summary.completionRate >= 0.5) {
    parts.push(`Decent week at ${pct(summary.completionRate)} — room for improvement.`);
  } else {
    parts.push(`Tough week at ${pct(summary.completionRate)} — tomorrow is a fresh start.`);
  }

  // Best/worst days
  if (summary.bestDay) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    parts.push(
      `Best day: ${dayNames[summary.bestDay.day]} (${pct(summary.bestDay.rate)}). ` +
      `Worst day: ${summary.worstDay ? dayNames[summary.worstDay.day] : "N/A"} (${summary.worstDay ? pct(summary.worstDay.rate) : "N/A"}).`
    );
  }

  // Habits summary
  parts.push(`${summary.habitsCompleted} of ${summary.totalHabits} habits completed this week.`);

  return parts.join(" ");
}