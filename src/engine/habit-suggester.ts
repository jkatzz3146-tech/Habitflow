// ============================================================
// habit-suggester.ts — Complementary Habit Suggestions
//
// Based on a user's existing habits and goals, suggests
// complementary habits that form a cohesive routine.
// Uses heuristic rules mapping related habit categories.
//
// Pure functions, no side effects, fully testable.
// ============================================================

import {
  Habit,
  HabitCompletion,
  HabitCategory,
  HabitFrequency,
  HabitSuggestion,
} from "./types";

// ─── Habit Pairing Rules ────────────────────────────────────

interface SuggestionRule {
  /** Source category that triggers this suggestion */
  sourceCategory: HabitCategory;
  /** The suggested complementary habit */
  suggestion: {
    title: string;
    category: HabitCategory;
    reasoning: (userHabitTitles: string[]) => string;
    difficulty: number; // 1–5
    suggestedFrequency: HabitFrequency;
  };
  /** Minimum number of habits in the source category to trigger */
  minSourceHabits?: number;
}

const SUGGESTION_RULES: SuggestionRule[] = [
  // ── Health → Complementary health habits ──
  {
    sourceCategory: HabitCategory.Health,
    suggestion: {
      title: "Drink 8 Glasses of Water",
      category: HabitCategory.Health,
      reasoning: () =>
        "Staying hydrated amplifies the benefits of your health routine. Pair it with an existing health habit like a meal or supplement.",
      difficulty: 1,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },
  {
    sourceCategory: HabitCategory.Health,
    suggestion: {
      title: "Stretch for 5 Minutes",
      category: HabitCategory.Health,
      reasoning: () =>
        "Adding gentle stretching improves flexibility and recovery. Great companion to any health-focused routine.",
      difficulty: 1,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },
  {
    sourceCategory: HabitCategory.Health,
    suggestion: {
      title: "Meal Prep Sunday",
      category: HabitCategory.Health,
      reasoning: () =>
        "Planning meals ahead reduces decision fatigue and keeps your nutrition on track throughout the week.",
      difficulty: 2,
      suggestedFrequency: HabitFrequency.Weekly,
    },
  },

  // ── Fitness → Complementary fitness habits ──
  {
    sourceCategory: HabitCategory.Fitness,
    suggestion: {
      title: "Post-Workout Stretching",
      category: HabitCategory.Fitness,
      reasoning: () =>
        "Cooling down with stretches after your workout reduces soreness and improves recovery. A natural pair with any fitness routine.",
      difficulty: 1,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },
  {
    sourceCategory: HabitCategory.Fitness,
    suggestion: {
      title: "Walk 10,000 Steps",
      category: HabitCategory.Fitness,
      reasoning: () =>
        "Low-intensity walking on rest days keeps you active without overtraining. Pairs perfectly with structured workouts.",
      difficulty: 2,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },
  {
    sourceCategory: HabitCategory.Fitness,
    suggestion: {
      title: "Track Your Workouts",
      category: HabitCategory.Fitness,
      reasoning: () =>
        "Logging sets, reps, and weights helps you progressive overload. Makes your fitness routine more intentional.",
      difficulty: 1,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },

  // ── Mindfulness → Complementary mindfulness habits ──
  {
    sourceCategory: HabitCategory.Mindfulness,
    suggestion: {
      title: "Journal for 5 Minutes",
      category: HabitCategory.Mindfulness,
      reasoning: () =>
        "Writing down thoughts after meditation or mindfulness practice deepens self-awareness and emotional processing.",
      difficulty: 2,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },
  {
    sourceCategory: HabitCategory.Mindfulness,
    suggestion: {
      title: "Gratitude Practice",
      category: HabitCategory.Mindfulness,
      reasoning: () =>
        "Naming three things you're grateful for each day boosts positivity. A beautiful pair with your mindfulness practice.",
      difficulty: 1,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },
  {
    sourceCategory: HabitCategory.Mindfulness,
    suggestion: {
      title: "Digital Detox Hour",
      category: HabitCategory.Mindfulness,
      reasoning: () =>
        "One hour without screens before bed improves sleep quality and reinforces your mindfulness routine.",
      difficulty: 3,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },

  // ── Productivity → Complementary productivity habits ──
  {
    sourceCategory: HabitCategory.Productivity,
    suggestion: {
      title: "Plan Tomorrow Tonight",
      category: HabitCategory.Productivity,
      reasoning: () =>
        "End each day by listing tomorrow's top 3 priorities. You'll wake up focused and ready to execute.",
      difficulty: 2,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },
  {
    sourceCategory: HabitCategory.Productivity,
    suggestion: {
      title: "Pomodoro Timer (25/5)",
      category: HabitCategory.Productivity,
      reasoning: () =>
        "Structure deep work into 25-minute focused sprints with 5-minute breaks. Proven to boost productivity.",
      difficulty: 2,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },
  {
    sourceCategory: HabitCategory.Productivity,
    suggestion: {
      title: "Weekly Review",
      category: HabitCategory.Productivity,
      reasoning: () =>
        "Each Sunday, review what worked and what didn't. Adjust your system for the week ahead.",
      difficulty: 2,
      suggestedFrequency: HabitFrequency.Weekly,
    },
  },

  // ── Learning → Complementary learning habits ──
  {
    sourceCategory: HabitCategory.Learning,
    suggestion: {
      title: "Read 10 Pages",
      category: HabitCategory.Learning,
      reasoning: () =>
        "Consistent reading compounds knowledge. 10 pages a day is 12+ books per year — a perfect companion to any learning habit.",
      difficulty: 2,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },
  {
    sourceCategory: HabitCategory.Learning,
    suggestion: {
      title: "Teach Someone What You Learned",
      category: HabitCategory.Learning,
      reasoning: () =>
        "Teaching is the best way to solidify knowledge. Share one insight from today's learning session.",
      difficulty: 3,
      suggestedFrequency: HabitFrequency.Weekly,
    },
  },
  {
    sourceCategory: HabitCategory.Learning,
    suggestion: {
      title: "Listen to a Podcast",
      category: HabitCategory.Learning,
      reasoning: () =>
        "Turn commute or chore time into learning time with educational podcasts. Complements your existing learning routine.",
      difficulty: 1,
      suggestedFrequency: HabitFrequency.Weekly,
    },
  },

  // ── Social → Complementary social habits ──
  {
    sourceCategory: HabitCategory.Social,
    suggestion: {
      title: "Call a Friend or Family Member",
      category: HabitCategory.Social,
      reasoning: () =>
        "Deepen your relationships with regular check-in calls. Strengthens your social connections beyond surface-level interaction.",
      difficulty: 2,
      suggestedFrequency: HabitFrequency.Weekly,
    },
  },
  {
    sourceCategory: HabitCategory.Social,
    suggestion: {
      title: "Send One Thoughtful Message",
      category: HabitCategory.Social,
      reasoning: () =>
        "A quick message to someone you appreciate strengthens bonds. Small social gestures create big relationship returns.",
      difficulty: 1,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },

  // ── Finance → Complementary finance habits ──
  {
    sourceCategory: HabitCategory.Finance,
    suggestion: {
      title: "Track Daily Expenses",
      category: HabitCategory.Finance,
      reasoning: () =>
        "Knowing where your money goes is the foundation of financial health. Pairs naturally with any savings or budget habit.",
      difficulty: 2,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },
  {
    sourceCategory: HabitCategory.Finance,
    suggestion: {
      title: "Review Subscriptions",
      category: HabitCategory.Finance,
      reasoning: () =>
        "Monthly subscription checks prevent wasted spending. A quick financial hygiene habit with great ROI.",
      difficulty: 1,
      suggestedFrequency: HabitFrequency.Weekly,
    },
  },

  // ── Creativity → Complementary creativity habits ──
  {
    sourceCategory: HabitCategory.Creativity,
    suggestion: {
      title: "Morning Pages (3 Pages Free Write)",
      category: HabitCategory.Creativity,
      reasoning: () =>
        "Stream-of-consciousness writing each morning clears mental clutter and unlocks creative flow.",
      difficulty: 3,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },
  {
    sourceCategory: HabitCategory.Creativity,
    suggestion: {
      title: "Collect Inspiration",
      category: HabitCategory.Creativity,
      reasoning: () =>
        "Save one thing that inspires you each day (quote, image, idea). Build an inspiration library for your creative work.",
      difficulty: 1,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },
];

// ─── Cross-Category Pairings ────────────────────────────────

interface CrossCategoryRule {
  sourceCategory: HabitCategory;
  targetCategory: HabitCategory;
  suggestion: {
    title: string;
    reasoning: (userHabitTitles: string[]) => string;
    difficulty: number;
    suggestedFrequency: HabitFrequency;
  };
}

const CROSS_CATEGORY_RULES: CrossCategoryRule[] = [
  {
    sourceCategory: HabitCategory.Fitness,
    targetCategory: HabitCategory.Health,
    suggestion: {
      title: "Protein-Rich Breakfast",
      reasoning: (titles) =>
        `You're working out${titles.length > 0 ? ` (e.g., "${titles[0]}")` : ""} — fuel your body with a protein-rich breakfast to maximize results and recovery.`,
      difficulty: 2,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },
  {
    sourceCategory: HabitCategory.Mindfulness,
    targetCategory: HabitCategory.Productivity,
    suggestion: {
      title: "Morning Intention Setting",
      reasoning: () =>
        "Set a clear intention right after your mindfulness practice. This bridges inner calm with focused action throughout the day.",
      difficulty: 2,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },
  {
    sourceCategory: HabitCategory.Productivity,
    targetCategory: HabitCategory.Health,
    suggestion: {
      title: "Stand Up & Move Every Hour",
      reasoning: () =>
        "Long periods of focused work can lead to a sedentary posture. A quick hourly movement break protects your health while you're being productive.",
      difficulty: 2,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },
  {
    sourceCategory: HabitCategory.Learning,
    targetCategory: HabitCategory.Creativity,
    suggestion: {
      title: "Apply One Thing You Learned",
      reasoning: () =>
        "Turn knowledge into creation. Apply one concept from your learning into a creative project today.",
      difficulty: 3,
      suggestedFrequency: HabitFrequency.Weekly,
    },
  },
  {
    sourceCategory: HabitCategory.Health,
    targetCategory: HabitCategory.Mindfulness,
    suggestion: {
      title: "Mindful Eating",
      reasoning: () =>
        "Eat one meal today without any screens — just focus on the taste and texture of your food. Combines health awareness with mindfulness.",
      difficulty: 2,
      suggestedFrequency: HabitFrequency.Daily,
    },
  },
  {
    sourceCategory: HabitCategory.Social,
    targetCategory: HabitCategory.Fitness,
    suggestion: {
      title: "Workout with a Friend",
      reasoning: () =>
        "Turn exercise into a social activity. Working out with a friend boosts accountability and makes fitness more enjoyable.",
      difficulty: 2,
      suggestedFrequency: HabitFrequency.Weekly,
    },
  },
];

// ─── Helpers ────────────────────────────────────────────────

/** Get titles of habits in a given category */
function getHabitTitlesByCategory(
  habits: Habit[],
  category: HabitCategory
): string[] {
  return habits
    .filter((h) => h.active && h.category === category)
    .map((h) => h.title);
}

/** Check if a suggestion title is already in the user's habits */
function isAlreadyTracked(
  title: string,
  habits: Habit[]
): boolean {
  return habits.some(
    (h) => h.title.toLowerCase().trim() === title.toLowerCase().trim()
  );
}

/** Get the most common categories the user tracks */
function getTopCategories(
  habits: Habit[],
  limit: number = 3
): HabitCategory[] {
  const counts = new Map<HabitCategory, number>();
  for (const habit of habits) {
    if (habit.active) {
      counts.set(habit.category, (counts.get(habit.category) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([cat]) => cat);
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Suggest complementary habits based on a user's existing habits.
 * Uses category-based pairing rules: if a user tracks habits in a
 * category, we suggest common companion habits.
 *
 * @param habits - User's current habits
 * @param completions - User's completion history (used for context)
 * @param maxSuggestions - Maximum number of suggestions to return (default: 5)
 * @returns Array of HabitSuggestion objects
 */
export function suggestComplementaryHabits(
  habits: Habit[],
  _completions: HabitCompletion[],
  maxSuggestions: number = 5
): HabitSuggestion[] {
  const activeHabits = habits.filter((h) => h.active);
  if (activeHabits.length === 0) return [];

  const suggestions: HabitSuggestion[] = [];
  const topCategories = getTopCategories(activeHabits, 3);

  // 1. Within-category suggestions
  for (const category of topCategories) {
    const rules = SUGGESTION_RULES.filter(
      (r) => r.sourceCategory === category
    );
    const userTitles = getHabitTitlesByCategory(activeHabits, category);

    for (const rule of rules) {
      const minHabits = rule.minSourceHabits ?? 1;
      if (userTitles.length < minHabits) continue;

      const title = rule.suggestion.title;
      if (isAlreadyTracked(title, activeHabits)) continue;

      suggestions.push({
        title,
        reasoning: rule.suggestion.reasoning(userTitles),
        category: rule.suggestion.category,
        difficulty: rule.suggestion.difficulty,
        basedOnCategory: category,
        suggestedFrequency: rule.suggestion.suggestedFrequency,
      });
    }
  }

  // 2. Cross-category suggestions
  for (const rule of CROSS_CATEGORY_RULES) {
    const hasSource = activeHabits.some((h) => h.category === rule.sourceCategory);
    if (!hasSource) continue;

    const title = rule.suggestion.title;
    if (isAlreadyTracked(title, activeHabits)) continue;

    // Skip if user already has a habit in the target category
    const hasTarget = activeHabits.some((h) => h.category === rule.targetCategory);

    suggestions.push({
      title,
      reasoning: rule.suggestion.reasoning(
        getHabitTitlesByCategory(activeHabits, rule.sourceCategory)
      ),
      category: rule.targetCategory,
      difficulty: rule.suggestion.difficulty,
      basedOnCategory: rule.sourceCategory,
      suggestedFrequency: rule.suggestion.suggestedFrequency,
    });
  }

  // Deduplicate by title (cross-category might duplicate within-category)
  const seen = new Set<string>();
  const uniqueSuggestions: HabitSuggestion[] = [];
  for (const s of suggestions) {
    const key = s.title.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueSuggestions.push(s);
    }
  }

  // Sort: easiest first, then by how closely related to user's top categories
  uniqueSuggestions.sort((a, b) => {
    // Items matching top categories come first
    const aMatchesTop = topCategories.includes(a.basedOnCategory) ? 0 : 1;
    const bMatchesTop = topCategories.includes(b.basedOnCategory) ? 0 : 1;
    if (aMatchesTop !== bMatchesTop) return aMatchesTop - bMatchesTop;
    // Then by difficulty (easiest first)
    return a.difficulty - b.difficulty;
  });

  return uniqueSuggestions.slice(0, maxSuggestions);
}

/**
 * Get a simple "next habit" recommendation — one single best
 * suggestion for what the user should add next.
 */
export function suggestNextHabit(
  habits: Habit[],
  completions: HabitCompletion[]
): HabitSuggestion | null {
  const suggestions = suggestComplementaryHabits(habits, completions, 1);
  return suggestions.length > 0 ? suggestions[0] : null;
}