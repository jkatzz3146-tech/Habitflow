import React from 'react';
import { StyleSheet, ScrollView, View, Alert, Image } from 'react-native';
import { Title, Text, Card, List, Switch, Button, Divider, useTheme, Avatar } from 'react-native-paper';
import { useAppTheme } from '@/utils/ThemeContext';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getHabits, getCompletions } from '@/data/database';

export default function ProfileScreen() {
  const theme = useTheme();
  const { themeMode, setThemeMode } = useAppTheme();

  const handleExportCSV = async () => {
    try {
      const habits = await getHabits();
      const logs = await getCompletions();

      // Create CSV for habits
      let csvContent = 'id,title,emoji,category,frequency,active,created_at\n';
      habits.forEach(h => {
        csvContent += `${h.id},"${h.title}",${h.emoji},${h.category},${h.frequency},${h.active},${h.created_at}\n`;
      });

      csvContent += '\n\n-- Completion Logs --\n';
      csvContent += 'id,habit_id,habit_title,date,time,notes,mood_rating\n';
      logs.forEach(l => {
        const habitTitle = habits.find(h => h.id === l.habit_id)?.title || 'Unknown';
        csvContent += `${l.id},${l.habit_id},"${habitTitle}",${l.date},${l.time},"${l.notes || ''}",${l.mood_rating || ''}\n`;
      });

      const fileUri = FileSystem.cacheDirectory + 'habitflow_backup.csv';
      await FileSystem.writeAsStringAsync(fileUri, csvContent);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      Alert.alert('Export Failed', 'An error occurred while exporting data.');
      console.error(error);
    }
  };

  const isDark = themeMode === 'dark';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Avatar.Icon size={80} icon="account" style={{ backgroundColor: theme.colors.primaryContainer }} />
        <Title style={styles.userName}>Habit Enthusiast</Title>
        <Text style={styles.userStatus}>Free Tier</Text>
      </View>

      <Card style={styles.proCard}>
        <Card.Content>
          <View style={styles.proHeader}>
            <Title style={styles.proTitle}>Upgrade to Pro</Title>
            <Text style={styles.proPrice}>$9.99 One-time</Text>
          </View>
          <Text style={styles.proDesc}>Unlock unlimited habits, advanced AI coaching, and custom themes.</Text>
          <View style={styles.featureList}>
            <List.Item title="Unlimited Habits" left={p => <List.Icon {...p} icon="lock" size={20} />} />
            <List.Item title="Advanced AI Insights" left={p => <List.Icon {...p} icon="lock" size={20} />} />
            <List.Item title="Custom Color Themes" left={p => <List.Icon {...p} icon="lock" size={20} />} />
          </View>
          <Button mode="contained" onPress={() => Alert.alert('Pro Upgrade', 'This is a demo. Pro features would be unlocked here.')}>
            Get Pro
          </Button>
        </Card.Content>
      </Card>

      <Title style={styles.sectionTitle}>Settings</Title>
      <Card style={styles.settingsCard}>
        <List.Item
          title="Dark Mode"
          right={() => (
            <Switch 
              value={isDark} 
              onValueChange={(val) => setThemeMode(val ? 'dark' : 'light')} 
            />
          )}
          left={p => <List.Icon {...p} icon="brightness-6" />}
        />
        <Divider />
        <List.Item
          title="Export Data (CSV)"
          description="Download your habits and progress"
          onPress={handleExportCSV}
          left={p => <List.Icon {...p} icon="export" />}
          right={p => <List.Icon {...p} icon="chevron-right" />}
        />
        <Divider />
        <List.Item
          title="Language"
          description="English (System Default)"
          left={p => <List.Icon {...p} icon="translate" />}
        />
      </Card>

      <Title style={styles.sectionTitle}>About</Title>
      <Card style={styles.settingsCard}>
        <List.Item
          title="Version"
          right={() => <Text>1.0.0 (Build 42)</Text>}
        />
        <Divider />
        <List.Item
          title="Privacy Policy"
          right={p => <List.Icon {...p} icon="open-in-new" />}
        />
        <Divider />
        <List.Item
          title="Terms of Service"
          right={p => <List.Icon {...p} icon="open-in-new" />}
        />
      </Card>

      <View style={styles.footer}>
        <Title style={styles.brand}>HabitFlow</Title>
        <Text style={styles.tagline}>AI-Powered Productivity</Text>
      </View>
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
    alignItems: 'center',
    marginVertical: 20,
  },
  userName: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: 'bold',
  },
  userStatus: {
    color: '#666',
  },
  proCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    elevation: 4,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#EADDFF',
  },
  proHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  proTitle: {
    color: '#6750A4',
    fontWeight: 'bold',
  },
  proPrice: {
    fontWeight: 'bold',
  },
  proDesc: {
    fontSize: 14,
    color: '#444',
    marginVertical: 10,
  },
  featureList: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  brand: {
    fontSize: 24,
    color: '#6750A4',
    fontWeight: 'bold',
  },
  tagline: {
    color: '#666',
    fontSize: 12,
  },
});
