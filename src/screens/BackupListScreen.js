import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert
} from 'react-native';
import { telepathService } from '../services/telepath';
import { colors, spacing, radius } from '../theme';

export default function BackupListScreen({ route, navigation }) {
  const { serverName } = route.params;
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);

  const loadBackups = async () => {
    try {
      await telepathService._get('BackupManager/_update_data');
      const list = await telepathService._get('BackupManager/return_backup_list');
      setBackups(Array.isArray(list) ? list : []);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBackups(); }, []);

  const handleRestore = (backup) => {
    Alert.alert(
      'Restore',
      `Restore "${backup.name}"? This will overwrite the current world.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', style: 'destructive', onPress: async () => {
          setRestoring(backup.name);
          try {
            await telepathService._post('BackupManager/restore', { backup_name: backup.name });
            Alert.alert('Success', 'Backup restored. The server will restart if needed.');
            navigation.goBack();
          } catch (e) {
            const msg = typeof e === 'string' ? e : e?.message || e?.detail || JSON.stringify(e);
            Alert.alert('Error', msg);
          } finally {
            setRestoring(null);
          }
        }}
      ]
    );
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={backups}
        keyExtractor={(item, index) => item.path || `${item.name}_${item.date || index}`}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name || 'Backup'}</Text>
              <Text style={styles.meta}>
                {item.date || ''}  ·  {formatSize(item.size)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.restoreBtn}
              onPress={() => handleRestore(item)}
              disabled={restoring === item.name}
            >
              {restoring === item.name ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Text style={styles.restoreText}>Restore</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No backups found</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm, borderBottomWidth: 1,
    borderBottomColor: colors.border, gap: spacing.sm,
  },
  name: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
  meta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  restoreBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.sm,
  },
  restoreText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  empty: { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
});