import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native';
import { Title, Text, Card, Checkbox, useTheme, IconButton, Divider, Button } from 'react-native-paper';
import { getHabits, getCompletions, logCompletion } from '@/data/database';
import type { Habit, HabitLog } from '@/data/database';
import { runEngine } from '@/engine';
import { mapHabitToEngine, mapLogToEngine } from '@/utils/mappers';
import { suggestComplementaryHabits } from '@/engine/habit-suggester';
import type { CoachingInsight, HabitSuggestion } from '@/engine/types';

export default function TodayScreen() {
  const theme = useTheme();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitLog[]>([]);
  const [insights, setInsights] = useState<CoachingInsight[]>([]);
  const [newSuggestions, setNewSuggestions] = useState<HabitSuggestion[]>([]);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    loadData();
    updateGreeting();
  }, []);

  const updateGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning!');
    else if (hour < 18) setGreeting('Good afternoon!');
    else setGreeting('Good evening!');
  };

  const loadData = async () => {
    const allHabits = await getHabits();
    const allLogs = await getCompletions();
    const today = new Date().toISOString().split('T')[0];
    
    const todayLogs = allLogs.filter(log => log.date === today);
    
    setHabits(allHabits);
    setCompletions(todayLogs);

    // Run AI engine for insights
    const engineHabits = allHabits.map(mapHabitToEngine);
    const engineLogs = allLogs.map(mapLogToEngine);
    
    const engineOutput = runEngine({
      habits: engineHabits,
      completions: engineLogs,
      now: new Date(),
    });

    setInsights(engineOutput.coachingInsights);

    // Get complementary habit suggestions
    const complements = suggestComplementaryHabits(engineHabits, engineLogs, 2);
    setNewSuggestions(complements);
  };

  const handleToggleHabit = async (habitId: number) => {
    const today = new Date().toISOString().split('T')[0];
    const isCompleted = completions.some(c => c.habit_id === habitId);

    if (!isCompleted) {
      await logCompletion(habitId, today, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 'Logged via Today screen');
      loadData();
    }
  };

  const isHabitCompleted = (habitId: number) => {
    return completions.some(c => c.habit_id === habitId);
  };

  const todayStr = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  const activeHabits = habits.filter(h => h.active);
  const completedCount = activeHabits.filter(h => isHabitCompleted(h.id)).length;
  const allDone = activeHabits.length > 0 && completedCount === activeHabits.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.dateText}>{todayStr}</Text>
        <Title style={styles.greetingText}>{greeting}</Title>
      </View>

      {insights.length > 0 && (
        <Card style={styles.coachCard}>
          <Card.Content>
            <View style={styles.coachHeader}>
              <IconButton icon="robot" size={20} iconColor={theme.colors.primary} />
              <Text style={styles.coachTitle}>AI Coach</Text>
            </View>
            <Text style={styles.coachMessage}>{insights[0].message}</Text>
          </Card.Content>
        </Card>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Title>Today's Habits</Title>
          <Text style={styles.progressText}>{completedCount}/{activeHabits.length}</Text>
        </View>
        
        {allDone && (
          <Card style={styles.allDoneCard}>
            <Card.Content style={styles.allDoneContent}>
              <Text style={styles.allDoneText}>🎉 All done for today! Great job!</Text>
            </Card.Content>
          </Card>
        )}

        {activeHabits.map((habit) => {
          const completed = isHabitCompleted(habit.id);
          let suggestedTime = '';
          try {
            const times = JSON.parse(habit.target_times || '[]');
            if (times.length > 0) {
              suggestedTime = `${times[0].hour.toString().padStart(2, '0')}:${times[0].minute.toString().padStart(2, '0')}`;
            }
          } catch (e) {}

          return (
            <Card 
              key={habit.id} 
              style={[styles.habitCard, completed && styles.completedCard]}
              onPress={() => handleToggleHabit(habit.id)}
            >
              <Card.Content style={styles.habitContent}>
                <View style={styles.habitLeft}>
                  <View style={[styles.emojiCircle, { backgroundColor: habit.color + '20' }]}>
                    <Text style={styles.emoji}>{habit.emoji || '⭐'}</Text>
                  </View>
                  <View>
                    <Text style={[styles.habitTitle, completed && styles.completedText]}>
                      {habit.title}
                    </Text>
                    <Text style={styles.habitSub}>
                      {suggestedTime ? `🕒 ${suggestedTime}` : ''}
                    </Text>
                  </View>
                </View>
                <Checkbox
                  status={completed ? 'checked' : 'unchecked'}
                  onPress={() => handleToggleHabit(habit.id)}
                  color={habit.color || theme.colors.primary}
                />
              </Card.Content>
            </Card>
          );
        })}
        {activeHabits.length === 0 && (
          <Text style={styles.emptyText}>No habits scheduled for today.</Text>
        )}
      </View>

      {newSuggestions.length > 0 && (
        <View style={styles.section}>
          <Title style={styles.suggestionTitle}>Recommended for You</Title>
          {newSuggestions.map((sug, idx) => (
            <Card key={idx} style={styles.suggestionCard}>
              <Card.Content>
                <Text style={styles.sugHabitTitle}>{sug.title}</Text>
                <Text style={styles.sugReason}>{sug.reasoning}</Text>
                <Button mode="text" compact onPress={() => {}} icon="plus">
                  Add to My Habits
                </Button>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  dateText: {
    fontSize: 16,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  greetingText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  coachCard: {
    marginBottom: 25,
    backgroundColor: '#fff',
    borderRadius: 15,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#6750A4',
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -10,
    marginBottom: -5,
  },
  coachTitle: {
    fontWeight: 'bold',
    color: '#6750A4',
  },
  coachMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },
  section: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  progressText: {
    fontWeight: 'bold',
    color: '#6750A4',
  },
  habitCard: {
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  completedCard: {
    opacity: 0.7,
    backgroundColor: '#f0f0f0',
  },
  habitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  habitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emojiCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  emoji: {
    fontSize: 22,
  },
  habitTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  habitSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#888',
  },
  allDoneCard: {
    marginBottom: 15,
    backgroundColor: '#EADDFF',
    borderRadius: 12,
  },
  allDoneContent: {
    alignItems: 'center',
  },
  allDoneText: {
    fontWeight: 'bold',
    color: '#21005D',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  suggestionTitle: {
    fontSize: 18,
    marginTop: 10,
    marginBottom: 10,
  },
  suggestionCard: {
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  sugHabitTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sugReason: {
    fontSize: 13,
    color: '#666',
    marginVertical: 4,
  },
});
