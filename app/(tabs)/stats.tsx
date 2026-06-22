import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Dimensions } from 'react-native';
import { Title, Text, Card, useTheme, IconButton, Divider, List } from 'react-native-paper';
import { BarChart } from 'react-native-chart-kit';
import { getHabits, getCompletions, getWeeklyCompletionData } from '@/data/database';
import { runEngine, mapHabitToEngine, mapLogToEngine, generateWeeklyNarrative } from '@/engine';
import { calculateStreak } from '@/engine/streak-guard';
import { StreakAlert } from '@/engine/types';

export default function StatsScreen() {
  const theme = useTheme();
  const [weeklyData, setWeeklyData] = useState<{ labels: string[], datasets: { data: number[] }[] }>({
    labels: [],
    datasets: [{ data: [] }]
  });
  const [streaks, setStreaks] = useState<{ id: number, title: string, streak: number }[]>([]);
  const [alerts, setAlerts] = useState<StreakAlert[]>([]);
  const [summary, setSummary] = useState<string>('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const data = await getWeeklyCompletionData();
    setWeeklyData({
      labels: data.labels,
      datasets: [{ data: data.counts }]
    });

    const allHabits = await getHabits();
    const allLogs = await getCompletions();
    
    // Calculate streaks
    const streakList = allHabits.map((h: any) => {
      const logs = allLogs.filter((l: any) => l.habit_id === h.id);
      const engineLogs = logs.map(mapLogToEngine);
      const info = calculateStreak(h.id.toString(), engineLogs, new Date());
      return { id: h.id, title: h.title, streak: info.currentStreak };
    }).sort((a: any, b: any) => b.streak - a.streak);
    
    setStreaks(streakList);

    // Run engine for alerts and summary
    const engineHabits = allHabits.map(mapHabitToEngine);
    const engineLogs = allLogs.map(mapLogToEngine);
    const engineOutput = runEngine({
      habits: engineHabits,
      completions: engineLogs,
      now: new Date()
    });

    const narrative = generateWeeklyNarrative(engineHabits, engineLogs, new Date());
    setAlerts(engineOutput.streakAlerts);
    setSummary(narrative);
  };

  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(103, 80, 164, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#ffa726',
    },
  };

  const bestStreak = streaks.length > 0 ? streaks[0] : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Title style={styles.sectionTitle}>Weekly Activity</Title>
      <Card style={styles.chartCard}>
        <Card.Content>
          {weeklyData.labels.length > 0 ? (
            <BarChart
              data={weeklyData}
              width={Dimensions.get('window').width - 60}
              height={220}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={chartConfig}
              style={styles.chart}
              showValuesOnTopOfBars
              fromZero
            />
          ) : (
            <Text>Loading chart...</Text>
          )}
        </Card.Content>
      </Card>

      <Title style={styles.sectionTitle}>Performance Insights</Title>
      <Card style={styles.insightCard}>
        <Card.Content>
          <Text style={styles.summaryText}>{summary || 'Complete more habits to generate a personal summary!'}</Text>
        </Card.Content>
      </Card>

      {alerts.length > 0 && (
        <>
          <Title style={styles.sectionTitle}>Streaks at Risk</Title>
          {alerts.map((alert, idx) => (
            <Card key={idx} style={[styles.alertCard, { borderLeftColor: alert.severity === 'critical' ? '#F44336' : '#FF9800' }]}>
              <Card.Content style={styles.alertContent}>
                <IconButton icon="alert-circle" iconColor={alert.severity === 'critical' ? '#F44336' : '#FF9800'} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                </View>
              </Card.Content>
            </Card>
          ))}
        </>
      )}

      <Title style={styles.sectionTitle}>Streak Highlights</Title>
      <Card style={styles.streakCard}>
        {streaks.map((s, idx) => (
          <React.Fragment key={s.id}>
            <List.Item
              title={s.title}
              right={() => <Text style={styles.streakCount}>🔥 {s.streak}</Text>}
              left={(props: any) => <List.Icon {...props} icon="fire" color={idx === 0 ? '#FF9800' : '#666'} />}
            />
            {idx < streaks.length - 1 && <Divider />}
          </React.Fragment>
        ))}
        {streaks.length === 0 && (
          <Card.Content>
            <Text style={styles.emptyText}>Start a habit to track your streaks!</Text>
          </Card.Content>
        )}
      </Card>

      {bestStreak && bestStreak.streak >= 7 && (
        <View style={styles.awardSection}>
          <IconButton icon="trophy" size={40} iconColor="#FFD700" style={styles.awardIcon} />
          <Title>Best Streak Award</Title>
          <Text style={styles.awardText}>{bestStreak.streak} Days on {bestStreak.title}!</Text>
        </View>
      )}

      <View style={{ height: 20 }} />
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
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  chartCard: {
    borderRadius: 15,
    backgroundColor: '#fff',
    elevation: 2,
    paddingRight: 15,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  insightCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    elevation: 1,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
    color: '#444',
  },
  alertCard: {
    marginBottom: 10,
    backgroundColor: '#fff',
    borderLeftWidth: 5,
    elevation: 1,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 0,
  },
  alertMessage: {
    fontSize: 14,
    fontWeight: '600',
  },
  streakCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    elevation: 1,
    overflow: 'hidden',
  },
  streakCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF9800',
    alignSelf: 'center',
    marginRight: 15,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 10,
  },
  awardSection: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  awardIcon: {
    margin: 0,
  },
  awardText: {
    color: '#666',
    fontSize: 16,
  },
});
