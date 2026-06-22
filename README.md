# HabitFlow — AI-Powered Habit Tracker

A React Native (Expo) mobile app that combines habit streaks, smart scheduling, and a personalized AI coach — all offline-first with no subscription.

## Features

### ✅ Today Screen
- Time-based greeting ("Good Morning!", "Good Evening!")
- Interactive habit checklist with checkboxes
- 🔥 Streak badges on each habit
- AI Coach insights card (personalized coaching messages)
- Streak alerts (critical/warning when a streak is at risk)

### 📋 Habits Screen
- Full CRUD: create, edit, delete habits
- Modal form with category & frequency selection
- AI-powered schedule suggestions (optimal time of day)
- AI complementary habit recommendations
- Clean list view with emoji and color

### 📊 Stats Screen
- 7-day completion chart (line chart)
- Weekly summary with completion rate
- Streak milestones achieved
- AI-powered performance insights

### 👤 Profile Screen
- Dark mode toggle (persisted via AsyncStorage)
- CSV data export (habits + completion logs)
- Pro upgrade card ($9.99 one-time)
- Version info and branding

## Tech Stack

- **Framework:** React Native with Expo SDK 56
- **Navigation:** Expo Router (file-based routing)
- **UI:** React Native Paper (Material Design 3)
- **Storage:** expo-sqlite (offline-first, WAL mode)
- **Charts:** react-native-chart-kit
- **Themes:** Custom ThemeProvider with AsyncStorage persistence
- **AI Engine:** Pure TypeScript on-device engine (no API calls)

## AI Engine (src/engine/)

- **scheduling-engine.ts** — Analyzes completion patterns to suggest optimal habit times with confidence scoring
- **streak-guard.ts** — Detects streaks at risk and generates proactive coaching alerts
- **insights-engine.ts** — Generates weekly summaries and personalized coaching insights
- **habit-suggester.ts** — Suggests complementary habits based on existing routines
- **types.ts** — Shared TypeScript interfaces for the entire engine

All AI runs locally on-device — zero cloud dependencies.

## Running Locally

```bash
cd habitflow-app
npx expo start
```

Scan the QR code with Expo Go on your phone, or press `a` for Android emulator / `i` for iOS simulator.

## Building for Production

```bash
# Android
npx eas build --platform android --profile production

# iOS
npx eas build --platform ios --profile production
```

## Licensing

This app and all its source code are exclusively owned by the business owner.
See [LICENSE](./LICENSE) for full terms.

## Revenue Model

- **Free tier:** 5 habits, basic stats
- **Pro unlock:** $9.99 one-time purchase — unlimited habits, AI coaching, smart scheduling, dark mode, export
- **No subscriptions** — deliberate differentiator