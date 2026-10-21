import React, { useState, useRef, useEffect, memo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Image,
  Platform,
  Alert,
  Keyboard,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { Text, TextInput, Icon } from '../components/ui';
import { telepathService } from '../services/telepath';
import { colors, spacing, radius, fonts } from '../theme';
import ModsTab from './ModsTab';
import { useFocusEffect } from '@react-navigation/native';
import {
  parseLogEntry, makeLocalLine, entrySignature, findNewStart, brighten, toCss,
} from '../utils/consoleLog';

const DEBUG = true;
function log(tag, msg, data) {
  if (!DEBUG) return;
  console.log(`[${tag}]`, msg, data !== undefined ? JSON.stringify(data) : '');
}

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
      <Icon name="globe-outline" size={14} color={colors.accentLight} />
      <Text style={addrStyles.addr} numberOfLines={1} selectable>{addr}</Text>
    </View>
  );
}

const addrStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addr: {
    fontSize: 14,
    fontFamily: fonts.mono,
    color: colors.accentLight,
    flexShrink: 1,
  },
});

// One console line, like the desktop: time/type pills + message colored by type (color
// codes inside the message keep their own color). The time is hidden by default; tapping
// a line shows it in the same spot, tapping again hides it.
const LogLine = memo(function LogLine({ line }) {
  const [showTime, setShowTime] = useState(false);
  const base = toCss(line.color);
  const dark = toCss(brighten(line.color, -0.65));
  return (
    <Pressable onPress={() => line.time && setShowTime(v => !v)}>
      <View style={consoleStyles.logRow}>
        {showTime && line.time ? (
          <Text style={[consoleStyles.pill, { backgroundColor: toCss(brighten(line.color, -0.2)), color: dark }]}>
            {line.time}
          </Text>
        ) : null}
        <Text style={[consoleStyles.pill, consoleStyles.typePill, { backgroundColor: base, color: dark }]}>
          {line.type}
        </Text>
        <Text style={[consoleStyles.line, consoleStyles.msg, { color: base }]}>
          {line.segments.map((seg, i) => (
            <Text key={i} style={seg.color ? { color: seg.color } : null}>{seg.text}</Text>
          ))}
        </Text>
      </View>
    </Pressable>
  );
});

// ── Console tab ───────────────────────────────────────────────────────────────
function ConsoleTab({ runData }) {
  const [cmd, setCmd] = useState('');
  const [sending, setSending] = useState(false);
  const [localLogs, setLocalLogs] = useState([{ id: 0, ...makeLocalLine('INFO', '// Console ready') }]);
  const scrollRef = useRef();
  const logIdRef  = useRef(1);
  const prevSigsRef = useRef([]);

  // The server keeps at most 2000 lines and drops the oldest ones, so new lines are
  // found by matching the end of what is already shown against the received list.
  useEffect(() => {
    if (!Array.isArray(runData?.log)) return;
    const cur = runData.log;
    const curSigs = cur.map(entrySignature);
    const start = findNewStart(prevSigsRef.current, curSigs);
    prevSigsRef.current = curSigs;

    const toLines = (entries) => entries.map(e => {
      logIdRef.current += 1;
      return { id: logIdRef.current, ...parseLogEntry(e) };
    });

    if (start === -1) {
      // Log was reset (server restarted...): start over from what the server sends
      setLocalLogs(toLines(cur).slice(-300));
    } else if (start < cur.length) {
      const fresh = toLines(cur.slice(start));
      setLocalLogs(prev => [...prev, ...fresh].slice(-300));
    }
  }, [runData?.log]);

  const sendCommand = async () => {
    if (!cmd.trim()) return;
    const command = cmd.trim();
    setCmd(''); setSending(true);
    logIdRef.current += 1;
    setLocalLogs(prev => [...prev, { id: logIdRef.current, ...makeLocalLine('EXEC', `> ${command}`) }]);
    try {
      await telepathService.sendCommand(command);
    } catch (e) {
      logIdRef.current += 1;
      setLocalLogs(prev => [...prev, { id: logIdRef.current, ...makeLocalLine('ERROR', e.message) }]);
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
        {localLogs.map(l => <LogLine key={l.id} line={l} />)}
      </ScrollView>

      {/* Command input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={consoleStyles.inputRow}>
          <View style={consoleStyles.inputWrap}>
            <Text style={consoleStyles.prompt}>/</Text>
            <TextInput
              style={consoleStyles.input}
              placeholder="Type a command…"
              placeholderTextColor={colors.textMuted}
              value={cmd}
              onChangeText={setCmd}
              onSubmitEditing={sendCommand}
              returnKeyType="send"
              autoCapitalize="none"
              autoCorrect={false}
              blurOnSubmit={false}
            />
          </View>
          <TouchableOpacity
            style={[consoleStyles.sendBtn, (!cmd.trim() || sending) && consoleStyles.sendBtnOff]}
            onPress={sendCommand}
            disabled={!cmd.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator color={colors.onAccent} size="small" />
              : <Icon name="send" size={18} color={cmd.trim() ? colors.onAccent : colors.textMuted} />}
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
  logRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: 2 },
  pill: {
    fontFamily: fonts.mono, fontSize: 9, lineHeight: 14, fontWeight: '700',
    paddingHorizontal: 4, borderRadius: 3, overflow: 'hidden', marginTop: 2,
  },
  typePill: { minWidth: 46, textAlign: 'center' },
  msg: { flex: 1 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bgCard,
    borderTopWidth: 1, borderTopColor: colors.border,
    padding: spacing.sm,
  },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bgInput, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, minHeight: 44,
  },
  prompt: { color: colors.accent, fontSize: 18, fontWeight: '800', fontFamily: fonts.mono },
  input: {
    flex: 1, color: colors.textPrimary, fontSize: 15,
    fontFamily: fonts.mono, paddingVertical: spacing.sm,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnOff: { backgroundColor: colors.bgRaised },
});

// ── Shared empty state ────────────────────────────────────────────────────────
function EmptyState({ icon, title, text }) {
  return (
    <View style={tabStyles.empty}>
      <View style={tabStyles.emptyIconWrap}>
        <Icon name={icon} size={32} color={colors.textMuted} />
      </View>
      <Text style={tabStyles.emptyTitle}>{title}</Text>
      {text ? <Text style={tabStyles.emptyText}>{text}</Text> : null}
    </View>
  );
}

// ── Player avatar ─────────────────────────────────────────────────────────────
// Head of the player skin from mc-heads.net, which accepts a username directly. Only valid
// Java usernames are requested (Bedrock/Floodgate names start with "." and do not resolve).
// The initial stays underneath: it is what shows while loading, offline, or on error.
const VALID_USERNAME = /^[A-Za-z0-9_]{1,16}$/;

function PlayerAvatar({ name }) {
  const [failed, setFailed] = useState(false);
  const showHead = VALID_USERNAME.test(name) && !failed;
  return (
    <View style={playerStyles.avatar}>
      <Text style={playerStyles.avatarText}>{name[0].toUpperCase()}</Text>
      {showHead ? (
        <Image
          source={{ uri: `https://mc-heads.net/avatar/${name}/128` }}
          style={playerStyles.avatarImage}
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}

// ── Players tab ───────────────────────────────────────────────────────────────
function PlayersTab({ runData }) {
  const playerList = runData?.['player-list'] || {};
  const players = Object.entries(playerList)
    .filter(([, v]) => v?.['logged-in'])
    .map(([name]) => name);

  const kick = (name) => {
    Alert.alert(`Kick ${name}`, `Kick ${name} from the server?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Kick', style: 'destructive', onPress: async () => {
        try { await telepathService.sendCommand(`kick ${name}`); }
        catch (e) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  if (players.length === 0) {
    return <EmptyState icon="people-outline" title="No players online" text="Players will show up here when they join" />;
  }

  return (
    <ScrollView style={tabStyles.scroll}>
      <Text style={playerStyles.count}>{players.length} online</Text>
      {players.map((name, i) => (
        <View key={i} style={playerStyles.row}>
          <PlayerAvatar name={name} />
          <Text style={playerStyles.name}>{name}</Text>
          <TouchableOpacity style={playerStyles.kickBtn} onPress={() => kick(name)} activeOpacity={0.7}>
            <Icon name="exit-outline" size={15} color={colors.red} />
            <Text style={playerStyles.kickText}>Kick</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const playerStyles = StyleSheet.create({
  count: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.md, marginTop: spacing.sm, padding: spacing.md,
  },
  avatar: {
    width: 44, height: 44, borderRadius: radius.sm, overflow: 'hidden',
    backgroundColor: colors.accentDim,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  avatarText: { color: colors.accent, fontWeight: '800', fontSize: 16 },
  name: { flex: 1, color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  kickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.sm, backgroundColor: 'rgba(255,107,143,0.12)',
  },
  kickText: { color: colors.red, fontSize: 13, fontWeight: '700' },
});

// ── Stats tab ─────────────────────────────────────────────────────────────────
function StatsTab({ runData }) {
  const perf = runData?.performance || null;

  if (!perf) {
    return <EmptyState icon="stats-chart-outline" title="Stats unavailable" text="Only available while the server is running" />;
  }

  const cpu = perf?.cpu != null ? Number(perf.cpu).toFixed(1) : null;
  const ram = perf?.ram != null ? Number(perf.ram).toFixed(0) : null;

  const items = [
    { label: 'CPU', value: cpu != null ? `${cpu}%` : '--', bar: cpu != null ? cpu / 100 : 0, color: cpu > 80 ? colors.red : cpu > 60 ? colors.yellow : colors.green, icon: 'hardware-chip' },
    { label: 'RAM', value: ram != null ? `${ram}%` : '--', bar: ram != null ? ram / 100 : 0, color: colors.accentLight, icon: 'server' },
    { label: 'Players', value: perf?.player_count ?? (runData?.['player-list'] ? Object.values(runData['player-list']).filter(p => p?.['logged-in']).length : '--'), bar: null, icon: 'people', color: colors.yellow },
    { label: 'Uptime', value: perf?.uptime || '--', bar: null, color: colors.blue, icon: 'time' },
  ];

  return (
    <ScrollView contentContainerStyle={statStyles.grid}>
      {items.map((item, i) => (
        <View key={i} style={statStyles.card}>
          <View style={[statStyles.iconWrap, { backgroundColor: item.color + '22' }]}>
            <Icon name={item.icon} size={22} color={item.color} />
          </View>
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
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
    flexBasis: '47%', flexGrow: 1,
  },
  iconWrap: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  value: { fontSize: 28, fontWeight: '800' },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  barTrack: { width: '100%', height: 6, backgroundColor: colors.bgInput, borderRadius: 3, marginTop: spacing.md, overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: 3 },
});

// ── Shared tab styles ─────────────────────────────────────────────────────────
const tabStyles = StyleSheet.create({
  scroll: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.xs },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bgCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  emptyTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  emptyText:  { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
});

// ── Control bar ───────────────────────────────────────────────────────────────
function ControlBar({ running, actionLoading, onAction, network }) {
  return (
    <View style={ctrlStyles.bar}>
      <View style={ctrlStyles.left}>
        <View style={ctrlStyles.statusRow}>
          <View style={[ctrlStyles.dot, { backgroundColor: running ? colors.green : colors.textMuted }]} />
          <Text style={[ctrlStyles.status, { color: running ? colors.green : colors.textSecondary }]}>
            {running ? 'Online' : 'Stopped'}
          </Text>
        </View>
        {running && network ? <ServerAddress network={network} /> : null}
      </View>

      <View style={ctrlStyles.actions}>
        {actionLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : running ? (
          <>
            <TouchableOpacity style={[ctrlStyles.btn, ctrlStyles.btnSecondary]} onPress={() => onAction('restart')} activeOpacity={0.75}>
              <Icon name="refresh" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={[ctrlStyles.btn, ctrlStyles.btnStop]} onPress={() => onAction('stop')} activeOpacity={0.75}>
              <Icon name="stop" size={18} color={colors.red} />
              <Text style={[ctrlStyles.btnText, { color: colors.red }]}>Stop</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={[ctrlStyles.btn, ctrlStyles.btnStart]} onPress={() => onAction('launch')} activeOpacity={0.75}>
            <Icon name="play" size={18} color={colors.onAccent} />
            <Text style={[ctrlStyles.btnText, { color: colors.onAccent }]}>Start</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const ctrlStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    backgroundColor: colors.bgCard,
  },
  left: { flex: 1, gap: 3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot:    { width: 9, height: 9, borderRadius: 5 },
  status: { fontSize: 16, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    flexDirection: 'row', gap: 6, minHeight: 44, minWidth: 48, paddingHorizontal: spacing.md,
    borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
  },
  btnStart:    { backgroundColor: colors.accent },
  btnStop:     { backgroundColor: 'rgba(255,107,143,0.14)', borderWidth: 1, borderColor: 'rgba(255,107,143,0.45)' },
  btnSecondary:{ backgroundColor: colors.bgRaised },
  btnText: { fontWeight: '800', fontSize: 15 },
});

// ── Tab bar ───────────────────────────────────────────────────────────────────
const TAB_ICONS = { Console: 'terminal', Players: 'people', Stats: 'stats-chart', Mods: 'extension-puzzle' };

function TabBar({ tabs, active, onSelect }) {
  return (
    <View style={tabBarStyles.row}>
      {tabs.map((tab, i) => {
        const on = active === i;
        return (
          <TouchableOpacity key={i} style={tabBarStyles.tab} onPress={() => onSelect(i)} activeOpacity={0.7}>
            <Icon name={TAB_ICONS[tab] || 'ellipse'} size={18} color={on ? colors.accent : colors.textMuted} />
            <Text style={[tabBarStyles.text, on && tabBarStyles.textActive]}>{tab}</Text>
            {on ? <View style={tabBarStyles.indicator} /> : null}
          </TouchableOpacity>
        );
      })}
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
    flex: 1, paddingTop: spacing.sm + 2, paddingBottom: spacing.sm + 4,
    alignItems: 'center', gap: 3, position: 'relative',
  },
  text: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  textActive: { color: colors.accent },
  indicator: {
    position: 'absolute', bottom: 0, left: '20%', right: '20%',
    height: 3, backgroundColor: colors.accent, borderTopLeftRadius: 3, borderTopRightRadius: 3,
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
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupDone, setBackupDone] = useState(false);

  const runData = useRunData(opened);


  const handleBackup = async () => {
    Alert.alert('Back up', `Create a backup of "${serverName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Back up', onPress: async () => {
        setBackupLoading(true);
        setBackupDone(false);
        try {
          await telepathService._post('BackupManager/save', {});
          setBackupDone(true);
          setTimeout(() => setBackupDone(false), 3000);
        } catch (e) {
          Alert.alert('Error', `Backup failed: ${e.message}`);
        } finally {
          setBackupLoading(false);
        }
      }}
    ]);
  };

  useEffect(() => {
    navigation.setOptions({
      title: serverName,
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => handleBackup()}
            style={{ padding: 8 }}
            disabled={backupLoading}
          >
            {backupLoading ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : backupDone ? (
              <Icon name="checkmark-circle" size={24} color={colors.green} />
            ) : (
              <Icon name="save-outline" size={24} color={colors.textPrimary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('ServerSettings', { serverName })}
            style={{ padding: 8 }}
          >
            <Icon name="settings-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [serverName, navigation, backupLoading, backupDone]);

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
    const base = ['Console', 'Players', 'Stats'];
    if (supportsMods) base.push('Mods');
    return base;
  }, [supportsMods]);

  useEffect(() => {
    if (runData !== null) setRunning(!!runData?.performance);
  }, [runData]);

  const doAction = (action) => {
    const labels = { launch: 'Start', stop: 'Stop', restart: 'Restart' };
    Alert.alert(labels[action], `${labels[action]} "${serverName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: labels[action], onPress: async () => {
        setActionLoading(action);
        try {
          if (action === 'launch') await telepathService.launchServer();
          else if (action === 'stop') await telepathService.stopServer();
          else await telepathService.restartServer();
          if (action === 'launch') setRunning(true);
          else if (action === 'stop') setRunning(false);
        } catch (e) {
          Alert.alert('Error', `${action}: ${e.message}`);
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
        <Icon name="alert-circle" size={48} color={colors.red} />
        <Text style={styles.errorTitle}>Could not open the server</Text>
        <Text style={styles.errorText}>{openError}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!opened) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Opening server…</Text>
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