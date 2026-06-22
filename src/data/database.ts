import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'habitflow.db';

export interface Habit {
  id: number;
  title: string;
  emoji: string;
  color: string;
  frequency: string;
  target_times: string; // JSON array of TimeOfDay {hour, minute}
  description?: string;
  category: string;
  custom_days?: string; // JSON array of numbers
  active: number; // 0 or 1
  created_at: string;
}

export interface HabitLog {
  id: number;
  habit_id: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  notes?: string;
  mood_rating?: number;
}

let db: SQLite.SQLiteDatabase | null = null;

export const getDb = async () => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  return db;
};

export const initDb = async () => {
  const db = await getDb();
  
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      emoji TEXT,
      color TEXT,
      frequency TEXT DEFAULT 'daily',
      target_times TEXT,
      description TEXT,
      category TEXT DEFAULT 'other',
      custom_days TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS habit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      notes TEXT,
      mood_rating INTEGER,
      FOREIGN KEY (habit_id) REFERENCES habits (id)
    );
  `);
};

export const createHabit = async (habit: Omit<Habit, 'id' | 'created_at'>) => {
  const db = await getDb();
  const result = await db.runAsync(
    'INSERT INTO habits (title, emoji, color, frequency, target_times, description, category, custom_days, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    habit.title, habit.emoji || '', habit.color || '', habit.frequency, habit.target_times || '[]', habit.description || '', habit.category || 'health', habit.custom_days || '[]', habit.active
  );
  return result.lastInsertRowId;
};

export const updateHabit = async (id: number, habit: Partial<Habit>) => {
  const db = await getDb();
  const keys = Object.keys(habit);
  const values = Object.values(habit);
  const setClause = keys.map(key => `${key} = ?`).join(', ');
  await db.runAsync(`UPDATE habits SET ${setClause} WHERE id = ?`, ...values, id);
};

export const getHabits = async (): Promise<Habit[]> => {
  const db = await getDb();
  return await db.getAllAsync<Habit>('SELECT * FROM habits');
};

export const deleteHabit = async (id: number) => {
  const db = await getDb();
  await db.runAsync('DELETE FROM habits WHERE id = ?', id);
  await db.runAsync('DELETE FROM habit_logs WHERE habit_id = ?', id);
};

export const logCompletion = async (habitId: number, date: string, time: string, notes?: string, moodRating?: number) => {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO habit_logs (habit_id, date, time, notes, mood_rating) VALUES (?, ?, ?, ?, ?)',
    habitId, date, time, notes || '', moodRating || 0
  );
};

export const getCompletions = async (habitId?: number): Promise<HabitLog[]> => {
  const db = await getDb();
  if (habitId) {
    return await db.getAllAsync<HabitLog>('SELECT * FROM habit_logs WHERE habit_id = ? ORDER BY date DESC, time DESC', habitId);
  }
  return await db.getAllAsync<HabitLog>('SELECT * FROM habit_logs ORDER BY date DESC, time DESC');
};

export const getWeeklyCompletionData = async () => {
  const db = await getDb();
  const logs = await db.getAllAsync<{ date: string; count: number }>(`
    SELECT date, count(*) as count 
    FROM habit_logs 
    WHERE date >= date('now', '-7 days')
    GROUP BY date
    ORDER BY date ASC
  `);
  return logs;
};

import { calculateAllStreaks } from '../engine/streak-guard';
import { mapHabitToEngine, mapLogToEngine } from '../utils/mappers';

export const getStreaks = async () => {
  const habits = await getHabits();
  const logs = await getCompletions();
  
  const engineHabits = habits.map(mapHabitToEngine);
  const engineLogs = logs.map(mapLogToEngine);
  
  return calculateAllStreaks(engineHabits, engineLogs, new Date());
};
