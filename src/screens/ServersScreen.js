import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { telepathService } from '../services/telepath';
import { colors, spacing, radius, fonts, typeColor } from '../theme';
import { Text, Icon, Button } from '../components/ui';

// ── Server type badge ─────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  if (!type) return null;
  const c = typeColor(type);
  return (
    <View style={[badgeStyles.badge, { backgroundColor: c + '22' }]}>
      <Text style={[badgeStyles.text, { color: c }]}>{type.toUpperCase()}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { borderRadius: radius.xs, paddingHorizontal: 6, paddingVertical: 2 },
  text: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
});

// ── Status indicator ──────────────────────────────────────────────────────────
function StatusPill({ running }) {
  const c = running ? colors.green : colors.textMuted;
  return (
    <View style={[pillStyles.pill, { backgroundColor: running ? 'rgba(56,224,136,0.12)' : 'rgba(111,114,153,0.14)' }]}>
      <View style={[pillStyles.dot, { backgroundColor: c }]} />
      <Text style={[pillStyles.text, { color: running ? colors.green : colors.textSecondary }]}>
        {running ? 'Online' : 'Stopped'}
      </Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '700' },
});

// ── Server card ───────────────────────────────────────────────────────────────
function ServerCard({ server, onPress, onToggleFavorite }) {
  const running  = server?.running || false;
  const name     = server?.name    || 'Unknown server';
  const type     = server?.type    || '';
  const version  = server?.version || '';
  const players  = server?.player_count;
  const favorite = server?.favorite || false;
  const c = typeColor(type);

  return (
    <TouchableOpacity style={cardStyles.card} onPress={() => onPress(server)} activeOpacity={0.85}>
      <View style={[cardStyles.stripe, { backgroundColor: running ? colors.green : 'transparent' }]} />
      <View style={cardStyles.body}>
        <View style={[cardStyles.iconBox, { backgroundColor: c + '22' }]}>
          <Icon name="cube" size={22} color={c} />
        </View>

        <View style={cardStyles.info}>
          <Text style={cardStyles.name} numberOfLines={1}>{name}</Text>
          <View style={cardStyles.meta}>
            <TypeBadge type={type} />
            {version ? <Text style={cardStyles.version}>{version}</Text> : null}
          </View>
        </View>

        <View style={cardStyles.right}>
          <TouchableOpacity
            onPress={() => onToggleFavorite(server)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name={favorite ? 'heart' : 'heart-outline'} size={20} color={favorite ? colors.pink : colors.textMuted} />
          </TouchableOpacity>
          <View style={cardStyles.status}>
            {running && players != null ? (
              <View style={cardStyles.players}>
                <Icon name="people" size={13} color={colors.textSecondary} />
                <Text style={cardStyles.playersText}>{players}</Text>
              </View>
            ) : null}
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
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.sm + 2,
    overflow: 'hidden',
  },
  stripe: { width: 4 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  iconBox: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 6 },
  name: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  version: { fontSize: 13, color: colors.textSecondary },
  right: { alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  players: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  playersText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
});

// ── Header ────────────────────────────────────────────────────────────────────
function ScreenHeader({ host, port, servers, onDisconnect }) {
  const online = servers.filter(s => s?.running).length;
  return (
    <View style={headerStyles.wrap}>
      <View style={headerStyles.row}>
        <View style={headerStyles.logo}>
          <Icon name="cube" size={22} color={colors.onAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={headerStyles.title}>Servers</Text>
          <Text style={headerStyles.host}>{host}:{port}</Text>
        </View>
        <TouchableOpacity style={headerStyles.btn} onPress={onDisconnect} activeOpacity={0.7}>
          <Icon name="log-out-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      {servers.length > 0 ? (
        <Text style={headerStyles.summary}>
          <Text style={{ color: colors.green, fontWeight: '700' }}>{online} online</Text>
          {`  ·  ${servers.length} total`}
        </Text>
      ) : null}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl + spacing.lg, paddingBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  host: { fontSize: 13, color: colors.textSecondary, fontFamily: fonts.mono, marginTop: 1 },
  btn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  summary: { marginTop: spacing.md, fontSize: 13, color: colors.textSecondary },
});

// ── Empty / error states ──────────────────────────────────────────────────────
function CenteredState({ icon, iconColor = colors.accent, title, subtitle, action }) {
  return (
    <View style={stateStyles.wrap}>
      <View style={[stateStyles.iconWrap, { backgroundColor: iconColor + '22' }]}>
        <Icon name={icon} size={34} color={iconColor} />
      </View>
      <Text style={stateStyles.title}>{title}</Text>
      {subtitle ? <Text style={stateStyles.sub}>{subtitle}</Text> : null}
      {action}
    </View>
  );
}

const stateStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  sub:   { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
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
      Alert.alert('Error', e.message);
    }
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect', 'Disconnect from Telepath?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: async () => {
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
        servers={servers}
        onDisconnect={handleDisconnect}
      />

      {loading && !refreshing ? (
        <CenteredState
          icon="flash"
          title="Loading servers…"
          subtitle={`${telepathService.host}:${telepathService.port}`}
        />
      ) : error ? (
        <CenteredState
          icon="cloud-offline"
          iconColor={colors.red}
          title="Connection lost"
          subtitle={error}
          action={<Button label="Retry" icon="refresh" variant="secondary" onPress={() => loadServers()} style={{ marginTop: spacing.md }} />}
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
              icon="file-tray-outline"
              title="No servers"
              subtitle="No servers were found on this instance"
            />
          }
        />
      )}

      {!loading && !error ? (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('CreateServer', { existingNames: servers.map(s => s?.name).filter(Boolean) })}
        >
          <Icon name="add" size={32} color={colors.onAccent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.xl,
    width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, elevation: 8,
    shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  list: { paddingHorizontal: spacing.md, paddingBottom: 100 },
});
