import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { telepathService } from '../services/telepath';
import { colors, spacing, radius, fonts } from '../theme';

// ── Server type badge ─────────────────────────────────────────────────────────
const TYPE_COLORS = {
  paper:     '#4caf87',
  spigot:    '#f0b429',
  fabric:    '#a78bfa',
  forge:     '#fb923c',
  neoforge:  '#f97316',
  quilt:     '#38bdf8',
  purpur:    '#c084fc',
  vanilla:   '#6b8299',
  craftbukkit: '#facc15',
};

function TypeBadge({ type }) {
  if (!type) return null;
  const t = type.toLowerCase();
  const bg = TYPE_COLORS[t] || colors.textMuted;
  return (
    <View style={[typeBadgeStyles.badge, { backgroundColor: bg + '22', borderColor: bg + '55' }]}>
      <Text style={[typeBadgeStyles.text, { color: bg }]}>{type.toUpperCase()}</Text>
    </View>
  );
}

const typeBadgeStyles = StyleSheet.create({
  badge: {
    borderWidth: 1, borderRadius: radius.xs,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  text: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
});

// ── Status indicator ──────────────────────────────────────────────────────────
function StatusPill({ running }) {
  return (
    <View style={[pillStyles.pill, running ? pillStyles.online : pillStyles.offline]}>
      <View style={[pillStyles.dot, { backgroundColor: running ? colors.green : colors.textMuted }]} />
      <Text style={[pillStyles.text, { color: running ? colors.green : colors.textMuted }]}>
        {running ? 'EN LIGNE' : 'ARRÊTÉ'}
      </Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1,
  },
  online:  { backgroundColor: 'rgba(76,175,135,0.1)',  borderColor: 'rgba(76,175,135,0.3)' },
  offline: { backgroundColor: 'rgba(107,130,153,0.08)', borderColor: 'rgba(107,130,153,0.2)' },
  dot:  { width: 5, height: 5, borderRadius: 3 },
  text: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
});

// ── Server card ───────────────────────────────────────────────────────────────
function ServerCard({ server, onPress, onToggleFavorite }) {
  const running  = server?.running || false;
  const name     = server?.name    || 'Serveur inconnu';
  const type     = server?.type    || '';
  const version  = server?.version || '';
  const players  = server?.player_count;
  const favorite = server?.favorite || false;

  return (
    <TouchableOpacity
      style={[cardStyles.card, favorite && cardStyles.cardFav]}
      onPress={() => onPress(server)}
      activeOpacity={0.85}
    >
      <View style={cardStyles.body}>
        {/* Top row */}
        <View style={cardStyles.topRow}>
          <Text style={cardStyles.name} numberOfLines={1}>{name}</Text>
          <TouchableOpacity
            onPress={() => onToggleFavorite(server)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[cardStyles.fav, favorite && cardStyles.favActive]}>
              {favorite ? '♥' : '♡'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom row */}
        <View style={cardStyles.bottomRow}>
          <View style={cardStyles.meta}>
            {type ? <TypeBadge type={type} /> : null}
            {version ? <Text style={cardStyles.version}>{version}</Text> : null}
          </View>
          <View style={cardStyles.right}>
            {running && players != null && (
              <Text style={cardStyles.players}>👥 {players}</Text>
            )}
            <StatusPill running={running} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  cardFav: {
    borderColor: 'rgba(255,107,157,0.35)',
    backgroundColor: '#160f1b',
  },
  body: { flex: 1, padding: spacing.md },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  fav:  { fontSize: 20, color: colors.textMuted },
  favActive: { color: '#ff6b9d' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  version: { fontSize: 11, color: colors.textMuted },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  players: { fontSize: 11, color: colors.textSecondary },
});

// ── Header ────────────────────────────────────────────────────────────────────
function ScreenHeader({ host, port, onDisconnect }) {
  return (
    <View style={headerStyles.wrap}>
      <View>
        <Text style={headerStyles.title}>SERVEURS</Text>
        <View style={headerStyles.hostRow}>
          <View style={headerStyles.hostDot} />
          <Text style={headerStyles.host}>{host}:{port}</Text>
        </View>
      </View>
      <TouchableOpacity style={headerStyles.btn} onPress={onDisconnect}>
        <Text style={headerStyles.btnText}>⏏</Text>
      </TouchableOpacity>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: {
    fontSize: 22, fontWeight: '800', letterSpacing: 2,
    color: colors.textPrimary,
  },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  hostDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  host: {
    fontSize: 11, color: colors.accent,
    fontFamily: fonts.mono,
    letterSpacing: 0.5,
  },
  btn: {
    width: 38, height: 38, borderRadius: radius.sm,
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { fontSize: 17, color: colors.textSecondary },
});

// ── Empty / error states ──────────────────────────────────────────────────────
function CenteredState({ icon, title, subtitle, action }) {
  return (
    <View style={stateStyles.wrap}>
      <Text style={stateStyles.icon}>{icon}</Text>
      <Text style={stateStyles.title}>{title}</Text>
      {subtitle && <Text style={stateStyles.sub}>{subtitle}</Text>}
      {action}
    </View>
  );
}

const stateStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  icon:  { fontSize: 44, marginBottom: spacing.md },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  sub:   { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: spacing.xs },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ServersScreen({ navigation }) {
  const [servers, setServers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState('');

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
      setLoading(false); setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadServers(); }, []));

  const handleToggleFavorite = async (server) => {
    const name = server?.name;
    const newFav = !server.favorite;
    setServers(prev => prev.map(s => s.name === name ? { ...s, favorite: newFav } : s));
    try {
      await telepathService.openServer(name);
      const [sp, cf] = await Promise.all([
        telepathService._post('ServerObject/_sync_attr', { name: 'server_properties' }),
        telepathService._post('ServerObject/_sync_attr', { name: 'config_file' }),
      ]);
      const newCf = { ...cf, general: { ...(cf?.general || {}), isFavorite: String(newFav) } };
      await telepathService._post('ServerObject/write_config', { remote_data: { config_file: newCf, server_properties: sp } });
    } catch (e) {
      setServers(prev => prev.map(s => s.name === name ? { ...s, favorite: !newFav } : s));
      Alert.alert('Erreur', e.message);
    }
  };

  const handleDisconnect = () => {
    Alert.alert('Déconnexion', 'Se déconnecter de Telepath ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: async () => {
        await telepathService.logout();
        navigation.replace('Connect');
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        host={telepathService.host}
        port={telepathService.port}
        onDisconnect={handleDisconnect}
      />

      {loading && !refreshing ? (
        <CenteredState
          icon="⚡"
          title="Chargement des serveurs…"
          subtitle={`${telepathService.host}:${telepathService.port}`}
        />
      ) : error ? (
        <CenteredState
          icon="⚠️"
          title="Connexion perdue"
          subtitle={error}
          action={
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadServers()}>
              <Text style={styles.retryText}>Réessayer</Text>
            </TouchableOpacity>
          }
        />
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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadServers(true)}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <CenteredState
              icon="📭"
              title="Aucun serveur"
              subtitle="Aucun serveur n'a été trouvé sur cette instance"
            />
          }
        />
      )}

      {!loading && !error ? (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('CreateServer', { existingNames: servers.map(s => s?.name).filter(Boolean) })}
        >
          <Text style={styles.fabText}>＋</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.xl,
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  fabText: { color: colors.bg, fontSize: 28, fontWeight: '700', marginTop: -2 },
  list: { padding: spacing.md, paddingTop: spacing.sm },
  retryBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  retryText: { color: colors.textPrimary, fontSize: 14 },
});