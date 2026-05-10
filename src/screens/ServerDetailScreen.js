import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, Alert, Keyboard, ActivityIndicator, KeyboardAvoidingView
} from 'react-native';
import { telepathService } from '../services/telepath';
import { colors, spacing, radius } from '../theme';
import ModsTab from './ModsTab';
import { useFocusEffect } from '@react-navigation/native';


const DEBUG = true;
function log(tag, msg, data) {
  if (!DEBUG) return;
  console.log(`[${tag}]`, msg, data !== undefined ? JSON.stringify(data) : '');
}

// Extracts plain text from a log entry
// Each entry is {text: (date, level, message, color)} or a plain string
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

const logColor = (type) => ({ error: colors.red, join: colors.green, leave: colors.yellow, info: colors.textSecondary, default: '#c0c8e0' })[type] || colors.textPrimary;

// ---- Shared state: run_data is polled centrally ----
function useRunData(opened) {
  const [runData, setRunData] = useState(null);

  useEffect(() => {
    if (!opened) return;
    const fetch = async () => {
      try {
        const data = await telepathService.getRunData();
        log('RunData', 'result', data ? 'ok' : 'null');
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

// ---- Server Address ----
function ServerAddress({ network }) {
  const ip = network?.address?.ip || network?.public_ip || network?.private_ip || '—';
  const port = network?.address?.port;
  const addr = port && String(port) !== '25565' ? `${ip}:${port}` : ip;
  const isPlayit = ip && (ip.includes('.joinmc.link') || ip.includes('.playit.gg'));

  return (
    <View style={addrStyles.container}>
      {<Text style={{ fontSize: 11 }}>🌐</Text>}
      <Text
        style={addrStyles.addr}
        numberOfLines={1}
        ellipsizeMode="tail"
        selectable
      >
        {addr}
      </Text>
    </View>
  );
}

const addrStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    overflow: 'hidden',
  },
  addr: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.accentLight,
    flexShrink: 1,
    width: 300,
  },
});

// ---- Console Tab ----
function ConsoleTab({ runData, serverName }) {
  const [cmd, setCmd] = useState('');
  const [sending, setSending] = useState(false);
  const [localLogs, setLocalLogs] = useState([{ id: 0, text: '// Console prête', type: 'info' }]);
  const scrollRef = useRef();
  const logIdRef = useRef(1);
  const seenRef = useRef(new Set());

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
    if (newEntries.length > 0) {
      setLocalLogs(prev => [...prev, ...newEntries].slice(-300));
    }
  }, [runData?.log]);

  const sendCommand = async () => {
    if (!cmd.trim()) return;
    const command = cmd.trim();
    setCmd('');
    setSending(true);
    logIdRef.current += 1;
    setLocalLogs(prev => [...prev, { id: logIdRef.current, text: `> ${command}`, type: 'info' }]);
    try {
      const result = await telepathService.sendCommand(command);
      log('Console', 'send_command result', result);
    } catch (e) {
      log('Console', 'send_command error', e.message);
      logIdRef.current += 1;
      setLocalLogs(prev => [...prev, { id: logIdRef.current, text: `Erreur: ${e.message}`, type: 'error' }]);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    // On crée un listener qui se déclenche quand le clavier est totalement affiché
    const keyboardSubscription = Keyboard.addListener('keyboardDidShow', () => {
      // On force le scroll vers la fin
      scrollRef.current?.scrollToEnd({ animated: true });
    });

    return () => {
      keyboardSubscription.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {localLogs.map(l => (
          <Text key={l.id} style={[styles.logLine, { color: logColor(l.type) }]}>
            {l.text}
          </Text>
        ))}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        // Ajuste ceci si l'input est trop bas/haut sous iOS
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} 
      >
        <View style={styles.cmdRow}>
          <Text style={styles.cmdPrompt}>/</Text>
          <TextInput
            style={styles.cmdInput}
            placeholder="commande..."
            placeholderTextColor={colors.textSecondary}
            value={cmd}
            onChangeText={setCmd}
            onSubmitEditing={sendCommand}
            renderKeyType="send"
            autoCapitalize="none"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!cmd.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendCommand}
            disabled={!cmd.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendIcon}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ---- Players Tab ----
function PlayersTab({ runData }) {
  const playerList = runData?.['player-list'] || {};
  const players = Object.entries(playerList)
    .filter(([, v]) => v?.['logged-in'])
    .map(([name]) => name);

  log('Players', 'online', players);

  const kick = (name) => {
    Alert.alert(`Kick ${name}`, `Expulser ${name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Kick', style: 'destructive', onPress: async () => {
        try { await telepathService.sendCommand(`kick ${name}`); }
        catch (e) { Alert.alert('Erreur', e.message); }
      }}
    ]);
  };

  return (
    <ScrollView style={styles.tabScroll}>
      {players.length === 0
        ? <View style={styles.center}><Text style={styles.emptyIcon}>👻</Text><Text style={styles.emptyText}>Aucun joueur connecté</Text></View>
        : players.map((name, i) => (
          <View key={i} style={styles.playerRow}>
            <Text style={styles.playerName}>🧑 {name}</Text>
            <TouchableOpacity style={styles.kickBtn} onPress={() => kick(name)}>
              <Text style={styles.kickText}>Kick</Text>
            </TouchableOpacity>
          </View>
        ))
      }
    </ScrollView>
  );
}

// ---- Stats Tab ----
function StatsTab({ runData }) {
  const perf = runData?.performance || null;
  log('Stats', 'performance', perf);

  if (!perf) return (
    <View style={styles.center}>
      <Text style={styles.emptyIcon}>📊</Text>
      <Text style={styles.emptyText}>Stats disponibles uniquement{'\n'}quand le serveur tourne</Text>
    </View>
  );

  const items = [
    { label: 'CPU', value: perf?.cpu != null ? `${Number(perf.cpu).toFixed(1)}%` : '--', icon: '🖥️', color: perf?.cpu > 80 ? colors.red : colors.green },
    { label: 'RAM', value: perf?.ram != null ? `${Number(perf.ram).toFixed(0)} %` : '--', icon: '💾', color: colors.accentLight },
    { label: 'Joueurs', value: perf?.player_count ?? (runData?.['player-list'] ? Object.values(runData['player-list']).filter(p => p?.['logged-in']).length : '--'), icon: '👥', color: colors.yellow },
    { label: 'Uptime', value: perf?.uptime || '--', icon: '⏱️', color: colors.textPrimary },
  ];

  return (
    <ScrollView contentContainerStyle={styles.statsGrid}>
      {items.map((item, i) => (
        <View key={i} style={styles.statCard}>
          <Text style={styles.statIcon}>{item.icon}</Text>
          <Text style={[styles.statValue, { color: item.color }]}>{String(item.value)}</Text>
          <Text style={styles.statLabel}>{item.label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ---- Main ----
export default function ServerDetailScreen({ route, navigation }) {
  const { server } = route.params;
  const serverName = server?.name || server?.server_name;
  const [running, setRunning] = useState(server?.running || false);
  const [actionLoading, setActionLoading] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [opened, setOpened] = useState(false);
  const [supportsMods, setSupportsMods] = useState(false);
  const [serverType, setServerType] = useState(null);
  const [openError, setOpenError] = useState(null);
  const [modsRefreshKey, setModsRefreshKey] = useState(0);

  const runData = useRunData(opened);

  useEffect(() => { navigation.setOptions({ title: serverName }); }, [serverName]);

  useEffect(() => {
    navigation.setOptions({
      title: serverName,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('ServerSettings', { serverName })}
          style={{ padding: 8 }}
        >
          <Text style={{ fontSize: 24 }}>⚙️</Text>
        </TouchableOpacity>
      ),
    });
  }, [serverName, navigation]);

  useEffect(() => {
    (async () => {
      try {
        log('Detail', 'opening server', serverName);
        const result = await telepathService.openServer(serverName);
        log('Detail', 'open_remote_server result', result);
        setOpened(true);
        // Récupération du type
        const serverTypeRaw = await telepathService._post('ServerObject/_sync_attr', { name: 'type' });
        const type = typeof serverTypeRaw === 'string' ? serverTypeRaw.toLowerCase() : null;
        setServerType(type);
        const MODDED_TYPES = ['forge', 'fabric', 'quilt', 'neoforge', 'mohist'];
        setSupportsMods(MODDED_TYPES.includes(type));
      } catch (e) {
        log('Detail', 'open_remote_server error', e.message);
        setOpenError(e.message);
      }
    })();
  }, [serverName]);

  const TABS = React.useMemo(() => {
    const base = ['Console', 'Joueurs', 'Stats'];
    if (supportsMods) base.push('Mods');
    return base;
  }, [supportsMods]);

  // Sync running state from run_data
  useEffect(() => {
    if (runData !== null) {
      // Server launched if performance object exists
      setRunning(!!runData?.performance);
    }
  }, [runData]);

  const doAction = (action) => {
    const labels = { launch: 'Démarrer', stop: 'Arrêter', restart: 'Redémarrer' };
    Alert.alert(labels[action], `${labels[action]} "${serverName}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: labels[action], onPress: async () => {
        setActionLoading(action);
        try {
          log('Action', action, 'calling...');
          let result;
          if (action === 'launch') result = await telepathService.launchServer();
          else if (action === 'stop') result = await telepathService.stopServer();
          else result = await telepathService.restartServer();
          log('Action', `${action} result`, result);
          // Optimistic update; run_data will correct it
          if (action === 'launch') setRunning(true);
          else if (action === 'stop') setRunning(false);
        } catch (e) {
          log('Action', `${action} error`, e.message);
          Alert.alert('Erreur', `${action}: ${e.message}`);
        } finally {
          setActionLoading(null);
        }
      }}
    ]);
  };

  useFocusEffect(
    React.useCallback(() => {
      setModsRefreshKey(prev => prev + 1);
    }, [])
  );

  if (openError) return (
    <View style={[styles.container, styles.center]}>
      <Text style={styles.emptyIcon}>⚠️</Text>
      <Text style={styles.errorText}>Impossible d'ouvrir le serveur :{'\n'}{openError}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.retryText}>← Retour</Text>
      </TouchableOpacity>
    </View>
  );

  if (!opened) return (
    <View style={[styles.container, styles.center]}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>Ouverture du serveur...</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Control bar */}
      <View style={styles.controls}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <View style={[styles.statusDot, { backgroundColor: running ? colors.green : colors.red }]} />
            <Text style={styles.statusText}>{running ? 'En ligne' : 'Arrêté'}</Text>
          </View>
          {running && runData?.network && <ServerAddress network={runData.network} />}
        </View>

        {actionLoading
          ? <ActivityIndicator color={colors.accent} />
          : <>
            {!running && (
              <TouchableOpacity style={[styles.ctrlBtn, styles.btnStart]} onPress={() => doAction('launch')}>
                <Text style={styles.ctrlText}>▶ Start</Text>
              </TouchableOpacity>
            )}
            {running && (<>
              <TouchableOpacity style={[styles.ctrlBtn, styles.btnRestart]} onPress={() => doAction('restart')}>
                <Text style={styles.ctrlText}>↺</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ctrlBtn, styles.btnStop]} onPress={() => doAction('stop')}>
                <Text style={styles.ctrlText}>■ Stop</Text>
              </TouchableOpacity>
            </>)}
          </>
        }
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <View style={styles.tabs}>
          {TABS.map((tab, i) => (
            <TouchableOpacity key={i} style={[styles.tab, activeTab === i && styles.tabActive]} onPress={() => setActiveTab(i)}>
              <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === 0 && <ConsoleTab runData={runData} serverName={serverName} />}
        {activeTab === 1 && <PlayersTab runData={runData} />}
        {activeTab === 2 && <StatsTab runData={runData} />}
        {supportsMods && activeTab === 3 && <ModsTab serverName={serverName} serverType={serverType} navigation={navigation} refreshKey={modsRefreshKey} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  controls: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { color: colors.textSecondary, fontSize: 13 },
  ctrlBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, minWidth: 60, alignItems: 'center' },
  btnStart: { backgroundColor: '#1a3a2a', borderWidth: 1, borderColor: colors.green },
  btnStop: { backgroundColor: '#3a1a1a', borderWidth: 1, borderColor: colors.red },
  btnRestart: { backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, minWidth: 40 },
  ctrlText: { color: colors.textPrimary, fontWeight: '700', fontSize: 13 },
  tabsRow: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bgCard },
  tabs: { flexDirection: 'row', flex: 1 },
  settingsBtn: { paddingHorizontal: spacing.md, justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: colors.border },
  settingsBtnText: { fontSize: 18 },
  tab: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  tabText: { color: colors.textSecondary, fontSize: 14 },
  tabTextActive: { color: colors.textPrimary, fontWeight: '700' },
  // Console
  consoleScroll: { flex: 1, backgroundColor: '#0a0c14', padding: spacing.sm },
  logLine: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, lineHeight: 18 },
  cmdRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.sm, gap: spacing.sm },
  cmdPrompt: { color: colors.accent, fontSize: 18, fontWeight: '800' },
  cmdInput: { flex: 1, color: colors.textPrimary, fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', paddingVertical: spacing.xs },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: colors.bgInput },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '800' },
  // Players
  tabScroll: { flex: 1 },
  playerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  playerName: { color: colors.textPrimary, fontSize: 15 },
  kickBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.red, backgroundColor: 'rgba(224,92,92,0.1)' },
  kickText: { color: colors.red, fontSize: 13, fontWeight: '600' },
  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md, gap: spacing.md },
  statCard: { backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border, width: '45%', flex: 1, minWidth: 120 },
  statIcon: { fontSize: 28, marginBottom: spacing.sm },
  statValue: { fontSize: 24, fontWeight: '800', marginBottom: spacing.xs },
  statLabel: { color: colors.textSecondary, fontSize: 12 },
  // Error
  errorText: { color: colors.red, textAlign: 'center' },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: colors.textSecondary, fontSize: 15, textAlign: 'center' },
  retryBtn: { backgroundColor: colors.bgCard, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
  retryText: { color: colors.textPrimary },
});
