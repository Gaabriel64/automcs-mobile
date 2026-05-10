import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, Alert, Keyboard, ActivityIndicator, KeyboardAvoidingView
} from 'react-native';
import { telepathService } from '../services/telepath';
import { colors, spacing, radius, fonts } from '../theme';
import ModsTab from './ModsTab';
import { useFocusEffect } from '@react-navigation/native';

const DEBUG = true;
function log(tag, msg, data) {
  if (!DEBUG) return;
  console.log(`[${tag}]`, msg, data !== undefined ? JSON.stringify(data) : '');
}

function extractLogText(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  const t = entry?.text;
  if (Array.isArray(t) && t.length >= 3) return `[${t[1]}] ${t[2]}`;
  if (typeof t === 'string') return t;
  return JSON.stringify(entry);
}

function logTypeFromText(text) {
  if (!text) return 'default';
  const t = text.toLowerCase();
  if (/error|warn/.test(t)) return 'error';
  if (/joined|logged in/.test(t)) return 'join';
  if (/left|disconnect/.test(t)) return 'leave';
  return 'default';
}

const logColor = (type) => ({
  error: colors.red,
  join:  colors.green,
  leave: colors.yellow,
  info:  '#4b6580',
  default: '#8faabf',
})[type] || colors.consoleText;

// ── run_data polling ──────────────────────────────────────────────────────────
function useRunData(opened) {
  const [runData, setRunData] = useState(null);
  useEffect(() => {
    if (!opened) return;
    const fetch = async () => {
      try {
        const data = await telepathService.getRunData();
        if (data && typeof data === 'object') setRunData(data);
        else setRunData(null);
      } catch (e) {
        log('RunData', 'error', e.message);
      }
    };
    fetch();
    const interval = setInterval(fetch, 2000);
    return () => clearInterval(interval);
  }, [opened]);
  return runData;
}

// ── Server address ────────────────────────────────────────────────────────────
function ServerAddress({ network }) {
  const ip   = network?.address?.ip || network?.public_ip || network?.private_ip || '—';
  const port = network?.address?.port;
  const addr = port && String(port) !== '25565' ? `${ip}:${port}` : ip;
  return (
    <View style={addrStyles.row}>
      <Text style={addrStyles.icon}>🌐</Text>
      <Text style={addrStyles.addr} numberOfLines={1} selectable>{addr}</Text>
    </View>
  );
}

const addrStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  icon: { fontSize: 10 },
  addr: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.accentLight,
    flexShrink: 1,
  },
});

// ── Console tab ───────────────────────────────────────────────────────────────
function ConsoleTab({ runData }) {
  const [cmd, setCmd] = useState('');
  const [sending, setSending] = useState(false);
  const [localLogs, setLocalLogs] = useState([{ id: 0, text: '// Console ready', type: 'info' }]);
  const scrollRef = useRef();
  const logIdRef  = useRef(1);
  const seenRef   = useRef(new Set());

  useEffect(() => {
    if (!runData?.log) return;
    const newEntries = [];
    runData.log.forEach((entry, i) => {
      const text = extractLogText(entry);
      if (!text) return;
      const key = `${i}-${text}`;
      if (!seenRef.current.has(key)) {
        seenRef.current.add(key);
        logIdRef.current += 1;
        newEntries.push({ id: logIdRef.current, text, type: logTypeFromText(text) });
      }
    });
    if (newEntries.length > 0) setLocalLogs(prev => [...prev, ...newEntries].slice(-300));
  }, [runData?.log]);

  const sendCommand = async () => {
    if (!cmd.trim()) return;
    const command = cmd.trim();
    setCmd(''); setSending(true);
    logIdRef.current += 1;
    setLocalLogs(prev => [...prev, { id: logIdRef.current, text: `> ${command}`, type: 'info' }]);
    try {
      await telepathService.sendCommand(command);
    } catch (e) {
      logIdRef.current += 1;
      setLocalLogs(prev => [...prev, { id: logIdRef.current, text: `[error] ${e.message}`, type: 'error' }]);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.consoleBg }}>
      {/* Scrollable log */}
      <ScrollView
        ref={scrollRef}
        style={consoleStyles.scroll}
        contentContainerStyle={{ paddingBottom: 12 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {localLogs.map(l => (
          <Text key={l.id} style={[consoleStyles.line, { color: logColor(l.type) }]}>
            {l.text}
          </Text>
        ))}
      </ScrollView>

      {/* Command input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={consoleStyles.inputRow}>
          <Text style={consoleStyles.prompt}>/</Text>
          <TextInput
            style={consoleStyles.input}
            placeholder="command…"
            placeholderTextColor={colors.textMuted}
            value={cmd}
            onChangeText={setCmd}
            onSubmitEditing={sendCommand}
            returnKeyType="send"
            autoCapitalize="none"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[consoleStyles.sendBtn, (!cmd.trim() || sending) && consoleStyles.sendBtnOff]}
            onPress={sendCommand}
            disabled={!cmd.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color={colors.bg} size="small" />
              : <Text style={consoleStyles.sendIcon}>↑</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const consoleStyles = StyleSheet.create({
  scroll: { flex: 1, padding: spacing.sm },
  line: {
    fontFamily: fonts.mono,
    fontSize: 11, lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0c1520',
    borderTopWidth: 1, borderTopColor: colors.border,
    padding: spacing.sm, gap: spacing.sm,
  },
  prompt: { color: colors.accent, fontSize: 18, fontWeight: '800' },
  input: {
    flex: 1, color: colors.textPrimary, fontSize: 13,
    fontFamily: fonts.mono,
    paddingVertical: spacing.xs,
  },
  sendBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnOff: { backgroundColor: colors.bgInput },
  sendIcon: { color: colors.bg, fontSize: 18, fontWeight: '800' },
});

// ── Players tab ───────────────────────────────────────────────────────────────
function PlayersTab({ runData }) {
  const playerList = runData?.['player-list'] || {};
  const players = Object.entries(playerList)
    .filter(([, v]) => v?.['logged-in'])
    .map(([name]) => name);

  const kick = (name) => {
    Alert.alert(`Kick ${name}`, `Expulser ${name} du serveur ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Kick', style: 'destructive', onPress: async () => {
        try { await telepathService.sendCommand(`kick ${name}`); }
        catch (e) { Alert.alert('Erreur', e.message); }
      }},
    ]);
  };

  if (players.length === 0) {
    return (
      <View style={tabStyles.empty}>
        <Text style={tabStyles.emptyIcon}>👻</Text>
        <Text style={tabStyles.emptyTitle}>Aucun joueur connecté</Text>
      </View>
    );
  }

  return (
    <ScrollView style={tabStyles.scroll}>
      {players.map((name, i) => (
        <View key={i} style={playerStyles.row}>
          <View style={playerStyles.avatar}>
            <Text style={playerStyles.avatarText}>{name[0].toUpperCase()}</Text>
          </View>
          <Text style={playerStyles.name}>{name}</Text>
          <TouchableOpacity style={playerStyles.kickBtn} onPress={() => kick(name)}>
            <Text style={playerStyles.kickText}>KICK</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const playerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.md,
  },
  avatar: {
    width: 36, height: 36, borderRadius: radius.sm,
    backgroundColor: colors.accentDim,
    borderWidth: 1, borderColor: colors.borderAccent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontWeight: '800', fontSize: 14 },
  name: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  kickBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 5,
    borderRadius: radius.xs,
    borderWidth: 1, borderColor: 'rgba(224,92,92,0.4)',
    backgroundColor: 'rgba(224,92,92,0.08)',
  },
  kickText: { color: colors.red, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
});

// ── Stats tab ─────────────────────────────────────────────────────────────────
function StatsTab({ runData }) {
  const perf = runData?.performance || null;

  if (!perf) {
    return (
      <View style={tabStyles.empty}>
        <Text style={tabStyles.emptyIcon}>📊</Text>
        <Text style={tabStyles.emptyTitle}>Stats indisponibles</Text>
        <Text style={tabStyles.emptyText}>Disponibles uniquement quand le serveur tourne</Text>
      </View>
    );
  }

  const cpu = perf?.cpu != null ? Number(perf.cpu).toFixed(1) : null;
  const ram = perf?.ram != null ? Number(perf.ram).toFixed(0) : null;

  const items = [
    { label: 'CPU', value: cpu != null ? `${cpu}%` : '--', bar: cpu != null ? cpu / 100 : 0, color: cpu > 80 ? colors.red : cpu > 60 ? colors.yellow : colors.green, icon: '🖥' },
    { label: 'RAM', value: ram != null ? `${ram}%` : '--', bar: ram != null ? ram / 100 : 0, color: colors.accentLight, icon: '💾' },
    { label: 'Joueurs', value: perf?.player_count ?? (runData?.['player-list'] ? Object.values(runData['player-list']).filter(p => p?.['logged-in']).length : '--'), bar: null, icon: '👥', color: colors.yellow },
    { label: 'Uptime', value: perf?.uptime || '--', bar: null, color: colors.blue, icon: '⏱' },
  ];

  return (
    <ScrollView contentContainerStyle={statStyles.grid}>
      {items.map((item, i) => (
        <View key={i} style={statStyles.card}>
          <Text style={statStyles.icon}>{item.icon}</Text>
          <Text style={[statStyles.value, { color: item.color }]}>{item.value}</Text>
          <Text style={statStyles.label}>{item.label}</Text>
          {item.bar != null && (
            <View style={statStyles.barTrack}>
              <View style={[statStyles.barFill, { width: `${Math.min(item.bar * 100, 100)}%`, backgroundColor: item.color }]} />
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const statStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md, gap: spacing.md },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    flex: 1, minWidth: 130,
  },
  icon:  { fontSize: 26, marginBottom: spacing.sm },
  value: { fontSize: 26, fontWeight: '800', marginBottom: spacing.xs },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  barTrack: { width: '100%', height: 3, backgroundColor: colors.border, borderRadius: 2, marginTop: spacing.sm, overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: 2 },
});

// ── Shared tab styles ─────────────────────────────────────────────────────────
const tabStyles = StyleSheet.create({
  scroll: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyIcon:  { fontSize: 44, marginBottom: spacing.md },
  emptyTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  emptyText:  { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: spacing.xs },
});

// ── Control bar ───────────────────────────────────────────────────────────────
function ControlBar({ running, actionLoading, onAction, network }) {
  return (
    <View style={ctrlStyles.bar}>
      <View style={ctrlStyles.left}>
        <View style={ctrlStyles.statusRow}>
          <View style={[ctrlStyles.dot, { backgroundColor: running ? colors.green : colors.red }]} />
          <Text style={[ctrlStyles.status, { color: running ? colors.green : colors.textSecondary }]}>
            {running ? 'EN LIGNE' : 'ARRÊTÉ'}
          </Text>
        </View>
        {running && network && <ServerAddress network={network} />}
      </View>

      <View style={ctrlStyles.actions}>
        {actionLoading
          ? <ActivityIndicator color={colors.accent} />
          : running ? (
            <>
              <TouchableOpacity style={[ctrlStyles.btn, ctrlStyles.btnSecondary]} onPress={() => onAction('restart')}>
                <Text style={ctrlStyles.btnText}>↺</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ctrlStyles.btn, ctrlStyles.btnStop]} onPress={() => onAction('stop')}>
                <Text style={[ctrlStyles.btnText, { color: colors.red }]}>■ STOP</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={[ctrlStyles.btn, ctrlStyles.btnStart]} onPress={() => onAction('launch')}>
              <Text style={[ctrlStyles.btnText, { color: colors.green }]}>▶ START</Text>
            </TouchableOpacity>
          )
        }
      </View>
    </View>
  );
}

const ctrlStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  left: { flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  dot:    { width: 7, height: 7, borderRadius: 4 },
  status: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, minWidth: 52,
  },
  btnStart:    { borderColor: 'rgba(76,175,135,0.4)', backgroundColor: 'rgba(76,175,135,0.08)' },
  btnStop:     { borderColor: 'rgba(224,92,92,0.4)',  backgroundColor: 'rgba(224,92,92,0.08)' },
  btnSecondary:{ borderColor: colors.border, backgroundColor: colors.bgInput },
  btnText: { color: colors.textPrimary, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
});

// ── Tab bar ───────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onSelect }) {
  return (
    <View style={tabBarStyles.row}>
      {tabs.map((tab, i) => (
        <TouchableOpacity
          key={i}
          style={[tabBarStyles.tab, active === i && tabBarStyles.tabActive]}
          onPress={() => onSelect(i)}
        >
          <Text style={[tabBarStyles.text, active === i && tabBarStyles.textActive]}>
            {tab.toUpperCase()}
          </Text>
          {active === i && <View style={tabBarStyles.indicator} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tabBarStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, paddingVertical: spacing.sm + 2,
    alignItems: 'center', position: 'relative',
  },
  tabActive: {},
  text: {
    color: colors.textMuted,
    fontSize: 10, fontWeight: '800', letterSpacing: 1,
  },
  textActive: { color: colors.accent },
  indicator: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 2, backgroundColor: colors.accent,
  },
});

// ── Main component ────────────────────────────────────────────────────────────
export default function ServerDetailScreen({ route, navigation }) {
  const { server } = route.params;
  const serverName = server?.name || server?.server_name;
  const [running, setRunning]       = useState(server?.running || false);
  const [actionLoading, setActionLoading] = useState(null);
  const [activeTab, setActiveTab]   = useState(0);
  const [opened, setOpened]         = useState(false);
  const [supportsMods, setSupportsMods] = useState(false);
  const [serverType, setServerType] = useState(null);
  const [openError, setOpenError]   = useState(null);
  const [modsRefreshKey, setModsRefreshKey] = useState(0);

  const runData = useRunData(opened);

  useEffect(() => {
    navigation.setOptions({
      title: serverName,
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('ServerSettings', { serverName })} style={{ padding: 8 }}>
          <Text style={{ fontSize: 20, color: colors.textSecondary }}>⚙️</Text>
        </TouchableOpacity>
      ),
    });
  }, [serverName, navigation]);

  useEffect(() => {
    (async () => {
      try {
        await telepathService.openServer(serverName);
        setOpened(true);
        const serverTypeRaw = await telepathService._post('ServerObject/_sync_attr', { name: 'type' });
        const type = typeof serverTypeRaw === 'string' ? serverTypeRaw.toLowerCase() : null;
        setServerType(type);
        setSupportsMods(['forge', 'fabric', 'quilt', 'neoforge', 'mohist'].includes(type));
      } catch (e) {
        setOpenError(e.message);
      }
    })();
  }, [serverName]);

  const TABS = React.useMemo(() => {
    const base = ['Console', 'Joueurs', 'Stats'];
    if (supportsMods) base.push('Mods');
    return base;
  }, [supportsMods]);

  useEffect(() => {
    if (runData !== null) setRunning(!!runData?.performance);
  }, [runData]);

  const doAction = (action) => {
    const labels = { launch: 'Démarrer', stop: 'Arrêter', restart: 'Redémarrer' };
    Alert.alert(labels[action], `${labels[action]} "${serverName}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: labels[action], onPress: async () => {
        setActionLoading(action);
        try {
          if (action === 'launch') await telepathService.launchServer();
          else if (action === 'stop') await telepathService.stopServer();
          else await telepathService.restartServer();
          if (action === 'launch') setRunning(true);
          else if (action === 'stop') setRunning(false);
        } catch (e) {
          Alert.alert('Erreur', `${action}: ${e.message}`);
        } finally {
          setActionLoading(null);
        }
      }},
    ]);
  };

  useFocusEffect(
    React.useCallback(() => { setModsRefreshKey(prev => prev + 1); }, [])
  );

  if (openError) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 40 }}>⚠️</Text>
        <Text style={styles.errorTitle}>Impossible d'ouvrir le serveur</Text>
        <Text style={styles.errorText}>{openError}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!opened) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Ouverture du serveur…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ControlBar
        running={running}
        actionLoading={actionLoading}
        onAction={doAction}
        network={runData?.network}
      />
      <TabBar tabs={TABS} active={activeTab} onSelect={setActiveTab} />

      <View style={{ flex: 1 }}>
        {activeTab === 0 && <ConsoleTab runData={runData} serverName={serverName} />}
        {activeTab === 1 && <PlayersTab runData={runData} />}
        {activeTab === 2 && <StatsTab runData={runData} />}
        {supportsMods && activeTab === 3 && (
          <ModsTab serverName={serverName} serverType={serverType} navigation={navigation} refreshKey={modsRefreshKey} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: spacing.md, padding: spacing.xl },
  loadingText:  { color: colors.textSecondary, marginTop: spacing.sm },
  errorTitle:   { color: colors.textPrimary, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  errorText:    { color: colors.red, fontSize: 13, textAlign: 'center' },
  backBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  backBtnText: { color: colors.textPrimary, fontSize: 14 },
});