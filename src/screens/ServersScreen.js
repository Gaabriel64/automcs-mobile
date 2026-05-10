import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { telepathService } from '../services/telepath';
import { colors, spacing, radius } from '../theme';

function ServerCard({ server, onPress, onToggleFavorite }) {
  const running = server?.running || false;
  const name = server?.name || 'Serveur inconnu';
  const type = server?.type || '';
  const version = server?.version || '';
  const players = server?.player_count;
  const favorite = server?.favorite || false;

  return (
    <TouchableOpacity
      style={[styles.card, favorite && styles.cardFavorite]}
      onPress={() => onPress(server)}
      activeOpacity={0.8}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.icon, { backgroundColor: running ? '#1a3a2a' : '#2a1a1a' }]}>
          <Text style={styles.iconText}>{running ? '🟢' : '🔴'}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.serverName} numberOfLines={1}>{name}</Text>
          <Text style={styles.serverMeta}>
            {[type, version].filter(Boolean).join(' · ') || 'Minecraft'}
          </Text>
        </View>
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.badge, running ? styles.badgeGreen : styles.badgeGray]}>
          <View style={[styles.dot, { backgroundColor: running ? colors.green : colors.textSecondary }]} />
          <Text style={[styles.badgeText, { color: running ? colors.green : colors.textSecondary }]}>
            {running ? 'En ligne' : 'Arrêté'}
          </Text>
        </View>
        {running && players != null && (
          <Text style={styles.players}>👥 {players}</Text>
        )}
        <TouchableOpacity
          style={styles.favBtn}
          onPress={() => onToggleFavorite(server)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.favIcon, favorite && styles.favIconActive]}>
            {favorite ? '♥' : '♡'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function ServersScreen({ navigation }) {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadServers = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const list = await telepathService.getServerList();
      setServers(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e.message);
      if (e.message.includes('401') || e.message.includes('403')) navigation.replace('Connect');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadServers(); }, []));

  const handleToggleFavorite = async (server) => {
    const name = server?.name;
    const newFav = !server.favorite;
    // Optimistic update
    setServers(prev => prev.map(s =>
      s.name === name ? { ...s, favorite: newFav } : s
    ));
    try {
      // Open the server so api_wrapper routes to the right ServerObject
      await telepathService.openServer(name);
      // Load current config_file and server_properties, then write back with updated isFavorite
      const [sp, cf] = await Promise.all([
        telepathService._post('ServerObject/_sync_attr', { name: 'server_properties' }),
        telepathService._post('ServerObject/_sync_attr', { name: 'config_file' }),
      ]);
      const newCf = {
        ...cf,
        general: { ...(cf?.general || {}), isFavorite: String(newFav) }
      };
      await telepathService._post('ServerObject/write_config', {
        remote_data: { config_file: newCf, server_properties: sp }
      });
    } catch (e) {
      // Rollback
      setServers(prev => prev.map(s =>
        s.name === name ? { ...s, favorite: !newFav } : s
      ));
      Alert.alert('Erreur', e.message);
    }
  };

  const handleDisconnect = () => {
    Alert.alert('Déconnexion', 'Se déconnecter du serveur ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: async () => {
        await telepathService.logout();
        navigation.replace('Connect');
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Serveurs</Text>
          <Text style={styles.subtitle}>{telepathService.host}:{telepathService.port}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={handleDisconnect}>
          <Text style={styles.iconBtnText}>⏏</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Chargement des serveurs...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadServers()}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={servers}
          keyExtractor={(item, i) => item?.name || String(i)}
          renderItem={({ item }) => (
            <ServerCard
              server={item}
              onPress={s => navigation.navigate('ServerDetail', { server: s })}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadServers(true)} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>Aucun serveur trouvé</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl + spacing.lg,
    paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bgCard, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  iconBtnText: { fontSize: 18 },
  list: { padding: spacing.md },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  cardFavorite: {
    borderColor: 'rgba(255, 120, 160, 0.5)',
    backgroundColor: '#1f1520',
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  icon: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  iconText: { fontSize: 20 },
  cardInfo: { flex: 1 },
  serverName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  serverMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  badgeGreen: { backgroundColor: 'rgba(76,175,135,0.15)' },
  badgeGray: { backgroundColor: 'rgba(144,144,176,0.1)' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  players: { fontSize: 11, color: colors.textSecondary },
  favBtn: { padding: 4, marginTop: 2 },
  favIcon: { fontSize: 20, color: colors.textSecondary },
  favIconActive: { color: '#ff6b9d' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { color: colors.textSecondary, marginTop: spacing.sm },
  errorIcon: { fontSize: 40 },
  errorText: { color: colors.red, textAlign: 'center', paddingHorizontal: spacing.lg },
  retryBtn: {
    backgroundColor: colors.bgCard, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
  },
  retryText: { color: colors.textPrimary },
  empty: { alignItems: 'center', paddingTop: spacing.xl * 2 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { color: colors.textSecondary, fontSize: 16 },
});
