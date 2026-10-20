import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text, Icon, Button } from '../components/ui';
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
        contentContainerStyle={styles.list}
        keyExtractor={(item, index) => item.path || `${item.name}_${item.date || index}`}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.iconBox}>
              <Icon name="archive" size={22} color={colors.accent} />
            </View>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={2}>{item.name || 'Backup'}</Text>
              <View style={styles.metaRow}>
                <Icon name="time-outline" size={13} color={colors.textMuted} />
                <Text style={styles.meta}>{item.date || '—'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Icon name="document-outline" size={13} color={colors.textMuted} />
                <Text style={styles.meta}>{formatSize(item.size)}</Text>
              </View>
            </View>
            <Button
              compact
              variant="secondary"
              icon="refresh"
              label="Restore"
              onPress={() => handleRestore(item)}
              loading={restoring === item.name}
              disabled={restoring === item.name}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Icon name="archive-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No backups found</Text>
            <Text style={styles.empty}>Backups of this server will show up here</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  list: { padding: spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  iconBox: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, gap: 3 },
  name: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { color: colors.textSecondary, fontSize: 12 },
  emptyWrap: { alignItems: 'center', marginTop: spacing.xl * 2, gap: spacing.xs },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bgCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  emptyTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  empty: { color: colors.textSecondary, textAlign: 'center', fontSize: 14 },
});
