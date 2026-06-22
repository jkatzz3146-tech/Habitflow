import { Habit as DBHabit, HabitLog as DBLog } from '../data/database';
import { Habit as EngineHabit, HabitCompletion, HabitCategory, HabitFrequency } from '../engine/types';

export const mapHabitToEngine = (h: DBHabit): EngineHabit => ({
  id: h.id.toString(),
  title: h.title,
  description: h.description || '',
  category: h.category as HabitCategory,
  frequency: h.frequency as HabitFrequency,
  createdAt: new Date(h.created_at),
  active: h.active === 1,
  customDays: h.custom_days ? JSON.parse(h.custom_days) : [],
  preferredWindow: h.target_times ? {
    start: JSON.parse(h.target_times)[0] || { hour: 9, minute: 0 },
    end: { hour: ((JSON.parse(h.target_times)[0]?.hour || 9) + 1) % 24, minute: 0 }
  } : undefined,
});

export const mapLogToEngine = (l: DBLog): HabitCompletion => {
  // Combine date (YYYY-MM-DD) and time (HH:mm) into a Date object
  const [year, month, day] = l.date.split('-').map(Number);
  const [hour, minute] = l.time.split(':').map(Number);
  const date = new Date(year, month - 1, day, hour, minute);

  return {
    id: l.id.toString(),
    habitId: l.habit_id.toString(),
    completedAt: date,
    moodRating: l.mood_rating,
    notes: l.notes,
  };
};
