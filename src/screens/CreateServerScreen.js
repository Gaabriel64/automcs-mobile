// Creating a server from the phone, like the desktop wizard:
// name, type, version (list fetched from the Internet by the phone), game options,
// then running the steps on the machine hosting auto-mcs.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { Text, TextInput, Icon, Button, SectionTitle } from '../components/ui';
import { colors, spacing, radius, typeColor } from '../theme';
import { telepathService } from '../services/telepath';
import { SERVER_TYPES, fetchVersions, compareVersions } from '../services/versionSources';
import { createServer, buildSteps, DEFAULT_SETTINGS } from '../services/createServer';

const INVALID_NAME = /[\\/:*?"<>|]/;

const GAMEMODES = [
  { label: 'Survival', value: 'survival' },
  { label: 'Creative', value: 'creative' },
  { label: 'Adventure', value: 'adventure' },
];
const DIFFICULTIES = [
  { label: 'Peaceful', value: 'peaceful' },
  { label: 'Easy', value: 'easy' },
  { label: 'Normal', value: 'normal' },
  { label: 'Hard', value: 'hard' },
  { label: 'Hardcore', value: 'hardcore' },
];
const LEVEL_TYPES = [
  { label: 'Normal', value: 'default' },
  { label: 'Superflat', value: 'flat' },
  { label: 'Large biomes', value: 'large_biomes' },
  { label: 'Amplified', value: 'amplified' },
];

// World types available depending on the version (like the desktop: < 1.3.1 normal only,
// < 1.7.2 normal or superflat)
function levelTypesFor(version) {
  if (!version) return LEVEL_TYPES;
  if (compareVersions(version, '1.3.1') < 0) return LEVEL_TYPES.slice(0, 1);
  if (compareVersions(version, '1.7.2') < 0) return LEVEL_TYPES.slice(0, 2);
  return LEVEL_TYPES;
}

function Chips({ items, value, onChange, colorOf }) {
  return (
    <View style={styles.chips}>
      {items.map(it => {
        const active = it.value === value;
        const c = colorOf ? colorOf(it.value) : colors.accent;
        return (
          <TouchableOpacity
            key={it.value}
            style={[styles.chip, active && { borderColor: c, backgroundColor: c + '26' }]}
            onPress={() => onChange(it.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, active && { color: c, fontWeight: '700' }]}>{it.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Field({ label, children, hint }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        trackColor={{ false: colors.bgInput, true: colors.accentDim }}
        thumbColor={value ? colors.accent : colors.textMuted}
        ios_backgroundColor={colors.bgInput}
        value={!!value}
        onValueChange={onChange}
      />
    </View>
  );
}

function TextBox(props) {
  return <TextInput placeholderTextColor={colors.textMuted} autoCorrect={false} style={styles.input} {...props} />;
}

export default function CreateServerScreen({ route, navigation }) {
  const existingNames = route.params?.existingNames || [];

  const [name, setName]       = useState('');
  const [type, setType]       = useState('vanilla');
  const [version, setVersion] = useState('');
  const [port, setPort]       = useState('25565');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });

  // Listes de versions par type (cache)
  const cacheRef = useRef({});
  const [versions, setVersions] = useState(null);     // null = loading, [] = unavailable
  const [pickerOpen, setPickerOpen] = useState(false);

  const [phase, setPhase]     = useState('form');      // form | creating | error
  const [stepStates, setStepStates] = useState([]);
  const [failure, setFailure] = useState('');

  const setting = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));
  const latest = versions && versions.length ? versions[0] : '';
  const effectiveVersion = version.trim() || latest;
  const steps = useMemo(() => buildSteps(type), [type]);

  // Loads the version list of the chosen type (in the background, without blocking the form)
  useEffect(() => {
    let cancelled = false;
    if (cacheRef.current[type]) { setVersions(cacheRef.current[type]); return undefined; }
    setVersions(null);
    fetchVersions(type)
      .then(list => { cacheRef.current[type] = list; if (!cancelled) setVersions(list); })
      .catch(() => { cacheRef.current[type] = []; if (!cancelled) setVersions([]); });
    return () => { cancelled = true; };
  }, [type]);

  const changeType = t => { setType(t); setVersion(''); };

  // No going back during creation: it keeps running on the server
  useEffect(() => {
    navigation.setOptions({ headerLeft: phase === 'creating' ? () => null : undefined, gestureEnabled: phase !== 'creating' });
    if (phase !== 'creating') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [phase, navigation]);

  const validate = () => {
    const n = name.trim();
    if (!n) return 'Give the server a name.';
    if (INVALID_NAME.test(n) || /[. ]$/.test(n)) return 'The name contains a forbidden character (\\ / : * ? " < > |) or ends with a dot or a space.';
    if (existingNames.some(e => String(e).toLowerCase() === n.toLowerCase())) return 'A server with this name already exists.';
    if (!effectiveVersion) return 'Enter a version (the list is unavailable).';
    const p = parseInt(port, 10);
    if (!(p >= 1 && p <= 65535)) return 'The port must be between 1 and 65535.';
    if (!(parseInt(settings.max_players, 10) >= 1)) return 'Max players must be at least 1.';
    if (!(parseInt(settings.random_tick_speed, 10) >= 0)) return 'Random tick speed must be zero or positive.';
    return null;
  };

  const start = async () => {
    const problem = validate();
    if (problem) { Alert.alert('Check the form', problem); return; }

    const run = async () => {
      setFailure('');
      setStepStates(steps.map(() => 'pending'));
      setPhase('creating');
      const levelOk = levelTypesFor(effectiveVersion).some(l => l.value === settings.level_type);
      try {
        await createServer(telepathService, {
          name, type, version: effectiveVersion, port,
          settings: { ...settings, level_type: levelOk ? settings.level_type : 'default' },
        }, (i, status) => setStepStates(prev => prev.map((s, k) => (k === i ? status : s))));
        Alert.alert('Server created', `"${name.trim()}" is ready.`);
        navigation.popToTop();
      } catch (e) {
        setFailure(`${e.step ? `Step "${e.step.label}": ` : ''}${e.message}`);
        setPhase('error');
      }
    };

    // Version missing from the list: the desktop refuses it, here we let the user try
    if (versions && versions.length && !versions.includes(effectiveVersion)) {
      Alert.alert(
        'Version not found',
        `${effectiveVersion} does not appear in the ${type} list. Try anyway?`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Try anyway', onPress: run }],
      );
      return;
    }
    run();
  };

  // ── Creation in progress / failure ──
  if (phase !== 'form') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{phase === 'error' ? 'Creation failed' : `Creating "${name.trim()}"…`}</Text>
        {phase === 'creating' ? (
          <Text style={styles.hint}>Keep the app open: some steps (Java, download, installation) can take several minutes.</Text>
        ) : null}

        <View style={styles.card}>
          {steps.map((s, i) => {
            const st = stepStates[i] || 'pending';
            return (
              <View key={s.id} style={styles.stepRow}>
                <View style={styles.stepIcon}>
                  {st === 'running' ? <ActivityIndicator size="small" color={colors.accent} />
                    : <Icon
                        name={st === 'done' ? 'checkmark-circle' : st === 'error' ? 'close-circle' : 'ellipse-outline'}
                        size={22}
                        color={st === 'done' ? colors.green : st === 'error' ? colors.red : colors.textMuted}
                      />}
                </View>
                <Text style={[styles.stepLabel, st === 'pending' && { color: colors.textMuted }]}>{s.label}</Text>
              </View>
            );
          })}
        </View>

        {phase === 'error' ? (
          <View>
            <Text style={styles.error}>{failure}</Text>
            <Text style={styles.hint}>A server may have been partially created: check the server list before trying again.</Text>
            <Button icon="create-outline" label="Edit and retry" variant="secondary" onPress={() => setPhase('form')} style={{ marginTop: spacing.md }} />
            <Button icon="arrow-back" label="Back to the list" variant="ghost" onPress={() => navigation.popToTop()} style={{ marginTop: spacing.sm }} />
          </View>
        ) : null}
      </ScrollView>
    );
  }

  // ── Formulaire ──
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionTitle title="Server" icon="cube-outline" />
      <Field label="Name">
        <TextBox value={name} onChangeText={setName} placeholder="My server" />
      </Field>

      <Field label="Type">
        <Chips items={SERVER_TYPES.map(t => ({ label: t.label, value: t.id }))} value={type} onChange={changeType} colorOf={typeColor} />
        {type === 'fabric' || type === 'quilt' ? (
          <Text style={styles.hint}>Fabric API is not installed automatically: add it afterwards from the Mods tab.</Text>
        ) : null}
      </Field>

      <Field
        label="Version"
        hint={
          versions === null ? 'Looking up versions on the Internet…'
          : versions.length ? `Empty = latest version (${latest}).`
          : 'List unavailable: type the version by hand (e.g. 1.21.4).'
        }
      >
        <View style={styles.versionRow}>
          <TextBox
            style={[styles.input, { flex: 1 }]}
            value={version}
            onChangeText={setVersion}
            placeholder={latest || '1.21.4'}
            autoCapitalize="none"
          />
          <Button compact icon="list" label="List" variant="secondary" onPress={() => setPickerOpen(true)} disabled={!(versions && versions.length)} />
        </View>
      </Field>

      <SectionTitle title="Game" icon="game-controller-outline" />
      <Field label="Game mode"><Chips items={GAMEMODES} value={settings.gamemode} onChange={v => setting('gamemode', v)} /></Field>
      <Field label="Difficulty"><Chips items={DIFFICULTIES} value={settings.difficulty} onChange={v => setting('difficulty', v)} /></Field>
      <Field label="World type">
        <Chips items={levelTypesFor(effectiveVersion)} value={settings.level_type} onChange={v => setting('level_type', v)} />
      </Field>
      <Field label="Seed (optional)"><TextBox value={settings.seed} onChangeText={v => setting('seed', v)} placeholder="random" autoCapitalize="none" /></Field>
      <Field label="Message of the day"><TextBox value={settings.motd} onChangeText={v => setting('motd', v)} /></Field>
      <Field label="Max players"><TextBox value={settings.max_players} onChangeText={v => setting('max_players', v.replace(/\D/g, ''))} keyboardType="number-pad" /></Field>
      <Field label="Port"><TextBox value={port} onChangeText={v => setPort(v.replace(/\D/g, ''))} keyboardType="number-pad" /></Field>

      <View style={styles.toggleCard}>
      <ToggleRow label="Player vs player (PvP)" value={settings.pvp} onChange={v => setting('pvp', v)} />
      <ToggleRow label="Mob spawning" value={settings.spawn_creatures} onChange={v => setting('spawn_creatures', v)} />
      <ToggleRow label="Spawn protection" value={settings.spawn_protection} onChange={v => setting('spawn_protection', v)} />
      <ToggleRow label="Command blocks" value={settings.command_blocks} onChange={v => setting('command_blocks', v)} />
      <ToggleRow label="Keep inventory" value={settings.keep_inventory} onChange={v => setting('keep_inventory', v)} />
      <ToggleRow label="Daylight/weather cycle" value={settings.daylight_weather_cycle} onChange={v => setting('daylight_weather_cycle', v)} />
      </View>

      <Field label="Random tick speed">
        <TextBox value={settings.random_tick_speed} onChangeText={v => setting('random_tick_speed', v.replace(/\D/g, ''))} keyboardType="number-pad" />
      </Field>

      <Button icon="add-circle-outline" label="Create server" onPress={start} style={{ marginTop: spacing.xl }} />
      <Text style={styles.hint}>Geyser (Bedrock), playit.gg and mods are configured afterwards from the server.</Text>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{type} versions</Text>
            <FlatList
              data={versions || []}
              keyExtractor={v => v}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { setVersion(item === latest ? '' : item); setPickerOpen(false); }}
                >
                  <Text style={[styles.modalItemText, item === effectiveVersion && { color: colors.accent, fontWeight: '700' }]}>
                    {item}{item === latest ? '  (latest)' : ''}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: 60 },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  error: { color: colors.red, fontSize: 13, marginTop: spacing.md, lineHeight: 19 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: spacing.lg, marginBottom: spacing.xs, paddingBottom: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sectionStripe: { width: 3, height: 14, borderRadius: 2, backgroundColor: colors.accent },
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: colors.accent, textTransform: 'uppercase' },

  field: { marginTop: spacing.md },
  label: { color: colors.textSecondary, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: colors.bgInput, color: colors.textPrimary, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 11, fontSize: 15,
    borderWidth: 1, borderColor: colors.border,
  },
  versionRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  pickBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentDim,
  },
  pickBtnText: { color: colors.accent, fontWeight: '700', fontSize: 13 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  chipText: { color: colors.textSecondary, fontSize: 13 },
  chipTextActive: { color: colors.accent, fontWeight: '700' },

  toggleCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, marginTop: spacing.md,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  toggleLabel: { color: colors.textPrimary, fontSize: 14, flex: 1, paddingRight: spacing.sm },

  btn: {
    alignItems: 'center', justifyContent: 'center', minHeight: 46, marginTop: spacing.md,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentDim,
  },
  btnText: { color: colors.accent, fontWeight: '800', fontSize: 15 },
  btnGhost: { borderColor: colors.border, backgroundColor: 'transparent' },
  btnGhostText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  btnDisabled: { opacity: 0.45 },

  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginTop: spacing.md, gap: spacing.sm,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  stepIcon: { width: 22, alignItems: 'center' },
  stepGlyph: { color: colors.textMuted, fontSize: 16, fontWeight: '800' },
  stepLabel: { color: colors.textPrimary, fontSize: 14, flex: 1 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: spacing.xl },
  modalBox: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: colors.accent,
    textTransform: 'uppercase', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalItemText: { color: colors.textPrimary, fontSize: 15 },
});
