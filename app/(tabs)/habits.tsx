import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Alert, TouchableOpacity } from 'react-native';
import { FAB, List, IconButton, Modal, Portal, TextInput, Button, SegmentedButtons, Title, useTheme, Text, Card, Divider, Badge } from 'react-native-paper';
import { getHabits, createHabit, updateHabit, deleteHabit, getCompletions, Habit } from '@/data/database';
import { mapHabitToEngine, mapLogToEngine } from '@/utils/mappers';
import { suggestScheduleForHabit } from '@/engine/scheduling-engine';
import { suggestComplementaryHabits } from '@/engine/habit-suggester';
import { calculateStreak } from '@/engine/streak-guard';
import { HabitSuggestion } from '@/engine/types';

const EMOJIS = ['⭐', '🏃‍♂️', '🧘', '📚', '💧', '🥗', '🍎', '💪', '🧠', '🎹', '🎨', '🧹'];
const COLORS = ['#6750A4', '#9C27B0', '#3F51B5', '#2196F3', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#795548'];

export default function HabitsScreen() {
  const theme = useTheme();
  const [habits, setHabits] = useState<(Habit & { suggestion?: string, streak: number })[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<HabitSuggestion[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('⭐');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [category, setCategory] = useState('health');
  const [frequency, setFrequency] = useState('daily');
  const [targetTime, setTargetTime] = useState('09:00');
  
  useEffect(() => {
    loadHabits();
  }, []);

  const loadHabits = async () => {
    const data = await getHabits();
    const allLogs = await getCompletions();
    
    // Get AI schedule suggestions and streaks for each habit
    const habitsWithMetadata = await Promise.all(data.map(async (h) => {
      const logs = allLogs.filter(l => l.habit_id === h.id);
      const engineHabit = mapHabitToEngine(h);
      const engineLogs = logs.map(mapLogToEngine);
      
      const suggestion = suggestScheduleForHabit(engineHabit, engineLogs);
      const streakInfo = calculateStreak(h.id.toString(), engineLogs, new Date());
      
      let suggestionText = '';
      if (suggestion.confidence !== 'low') {
        suggestionText = `Suggested: ${suggestion.suggestedTime.hour}:00`;
      }
      
      return { ...h, suggestion: suggestionText, streak: streakInfo.currentStreak };
    }));

    setHabits(habitsWithMetadata);

    // Get AI complementary habit suggestions
    const engineHabits = data.map(mapHabitToEngine);
    const engineLogs = allLogs.map(mapLogToEngine);
    const complements = suggestComplementaryHabits(engineHabits, engineLogs, 3);
    setAiSuggestions(complements);
  };

  const openAddModal = () => {
    setEditingHabit(null);
    setTitle('');
    setSelectedEmoji('⭐');
    setSelectedColor(COLORS[0]);
    setCategory('health');
    setFrequency('daily');
    setTargetTime('09:00');
    setModalVisible(true);
  };

  const openEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setTitle(habit.title);
    setSelectedEmoji(habit.emoji || '⭐');
    setSelectedColor(habit.color || COLORS[0]);
    setCategory(habit.category);
    setFrequency(habit.frequency);
    
    let time = '09:00';
    if (habit.target_times) {
      try {
        const parsed = JSON.parse(habit.target_times);
        if (parsed.length > 0) {
          time = `${parsed[0].hour.toString().padStart(2, '0')}:${parsed[0].minute.toString().padStart(2, '0')}`;
        }
      } catch (e) {}
    }
    setTargetTime(time);
    setModalVisible(true);
  };

  const handleSaveHabit = async () => {
    if (!title.trim()) return;
    
    const [hour, minute] = targetTime.split(':').map(Number);
    const targetTimesJson = JSON.stringify([{ hour, minute }]);
    
    if (editingHabit) {
      await updateHabit(editingHabit.id, {
        title,
        emoji: selectedEmoji,
        color: selectedColor,
        category,
        frequency,
        target_times: targetTimesJson,
      });
    } else {
      await createHabit({
        title,
        emoji: selectedEmoji,
        color: selectedColor,
        category,
        frequency,
        active: 1,
        description: '',
        custom_days: JSON.stringify([]),
        target_times: targetTimesJson,
      });
    }
    
    setModalVisible(false);
    loadHabits();
  };

  const handleAddSuggested = async (sug: HabitSuggestion) => {
    await createHabit({
      title: sug.title,
      emoji: '💡',
      color: theme.colors.secondary,
      category: sug.category,
      frequency: sug.suggestedFrequency,
      active: 1,
      description: sug.reasoning,
      custom_days: JSON.stringify([]),
      target_times: JSON.stringify([{ hour: 10, minute: 0 }]),
    });
    loadHabits();
    Alert.alert('Habit Added', `"${sug.title}" has been added to your habits.`);
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete Habit', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteHabit(id);
        loadHabits();
      }},
    ]);
  };

  const activeCount = habits.filter(h => h.active).length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Title style={styles.sectionTitle}>My Habits</Title>
          <Badge size={28} style={styles.activeBadge}>{activeCount}</Badge>
        </View>
        <Text style={styles.sectionSubtitle}>Total active habits</Text>

        {habits.map((habit) => (
          <List.Item
            key={habit.id}
            title={habit.title}
            description={`${habit.frequency} • ${habit.category}${habit.suggestion ? ' • ' + habit.suggestion : ''}`}
            left={(props: any) => (
              <View style={[styles.emojiContainer, { backgroundColor: habit.color + '20' }]}>
                <Text style={styles.emojiText}>{habit.emoji}</Text>
              </View>
            )}
            right={(props: any) => (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {habit.streak > 0 && <Text style={styles.streakText}>🔥 {habit.streak}</Text>}
                <IconButton {...props} icon="pencil" onPress={() => openEditModal(habit)} />
                <IconButton {...props} icon="delete" onPress={() => handleDelete(habit.id)} />
              </View>
            )}
            style={styles.listItem}
          />
        ))}
        {habits.length === 0 && (
          <Text style={styles.empty}>No habits yet. Tap the + button to create one!</Text>
        )}

        {aiSuggestions.length > 0 && (
          <>
            <Title style={[styles.sectionTitle, { marginTop: 30 }]}>Suggested for You</Title>
            <Text style={styles.sectionSubtitle}>Based on your current routine</Text>
            {aiSuggestions.map((sug, idx) => (
              <Card key={idx} style={styles.sugCard}>
                <Card.Content>
                  <Title style={styles.sugTitle}>{sug.title}</Title>
                  <Text style={styles.sugReason}>{sug.reasoning}</Text>
                  <Button 
                    mode="outlined" 
                    onPress={() => handleAddSuggested(sug)} 
                    style={styles.sugButton}
                    icon="plus"
                  >
                    Add Habit
                  </Button>
                </Card.Content>
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modal}>
          <Title>{editingHabit ? 'Edit Habit' : 'New Habit'}</Title>
          <TextInput
            label="Habit Title"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            style={styles.input}
          />
          
          <Title style={styles.modalSubtitle}>Emoji</Title>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiPicker}>
            {EMOJIS.map(e => (
              <TouchableOpacity 
                key={e} 
                onPress={() => setSelectedEmoji(e)}
                style={[styles.emojiOption, selectedEmoji === e && { borderColor: theme.colors.primary, borderWidth: 2 }]}
              >
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Title style={styles.modalSubtitle}>Color</Title>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorPicker}>
            {COLORS.map(c => (
              <TouchableOpacity 
                key={c} 
                onPress={() => setSelectedColor(c)}
                style={[styles.colorOption, { backgroundColor: c }, selectedColor === c && { borderColor: '#000', borderWidth: 2 }]}
              />
            ))}
          </ScrollView>

          <View style={styles.formRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Title style={styles.modalSubtitle}>Frequency</Title>
              <SegmentedButtons
                value={frequency}
                onValueChange={setFrequency}
                buttons={[
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' },
                ]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Title style={styles.modalSubtitle}>Target Time</Title>
              <TextInput
                value={targetTime}
                onChangeText={setTargetTime}
                placeholder="09:00"
                mode="outlined"
                dense
              />
            </View>
          </View>
          
          <Title style={styles.modalSubtitle}>Category</Title>
          <SegmentedButtons
            value={category}
            onValueChange={setCategory}
            buttons={[
              { value: 'health', label: 'Health' },
              { value: 'mindfulness', label: 'Mind' },
              { value: 'productivity', label: 'Work' },
            ]}
          />

          <Button mode="contained" onPress={handleSaveHabit} style={styles.button}>
            {editingHabit ? 'Update Habit' : 'Create Habit'}
          </Button>
        </Modal>
      </Portal>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={openAddModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scroll: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeBadge: {
    backgroundColor: '#6750A4',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  listItem: {
    backgroundColor: '#fff',
    marginBottom: 8,
    borderRadius: 12,
    elevation: 1,
  },
  emojiContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  emojiText: {
    fontSize: 20,
  },
  streakText: {
    fontWeight: 'bold',
    color: '#FF9800',
    marginRight: 5,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: '#666',
  },
  sugCard: {
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6750A4',
  },
  sugTitle: {
    fontSize: 18,
  },
  sugReason: {
    fontSize: 14,
    color: '#444',
    marginBottom: 10,
  },
  sugButton: {
    alignSelf: 'flex-start',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 12,
  },
  modalSubtitle: {
    fontSize: 16,
    marginTop: 15,
    marginBottom: 5,
  },
  input: {
    marginBottom: 5,
  },
  emojiPicker: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  emojiOption: {
    padding: 8,
    borderRadius: 8,
    marginRight: 5,
    backgroundColor: '#f0f0f0',
  },
  colorPicker: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  colorOption: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  formRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  button: {
    marginTop: 25,
  },
});
