// Création d'un serveur depuis le téléphone, comme l'assistant du desktop :
// nom, type, version (liste récupérée sur Internet par le téléphone), options de jeu,
// puis exécution des étapes sur la machine qui héberge auto-mcs.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, TextInput, TouchableOpacity,
  Modal, FlatList, Alert, ActivityIndicator, BackHandler,
} from 'react-native';
import { colors, spacing, radius } from '../theme';
import { telepathService } from '../services/telepath';
import { SERVER_TYPES, fetchVersions, compareVersions } from '../services/versionSources';
import { createServer, buildSteps, DEFAULT_SETTINGS } from '../services/createServer';

const INVALID_NAME = /[\\/:*?"<>|]/;

const GAMEMODES = [
  { label: 'Survie', value: 'survival' },
  { label: 'Créatif', value: 'creative' },
  { label: 'Aventure', value: 'adventure' },
];
const DIFFICULTIES = [
  { label: 'Pacifique', value: 'peaceful' },
  { label: 'Facile', value: 'easy' },
  { label: 'Normal', value: 'normal' },
  { label: 'Difficile', value: 'hard' },
  { label: 'Hardcore', value: 'hardcore' },
];
const LEVEL_TYPES = [
  { label: 'Normal', value: 'default' },
  { label: 'Superflat', value: 'flat' },
  { label: 'Grands biomes', value: 'large_biomes' },
  { label: 'Amplifié', value: 'amplified' },
];

// Types de monde disponibles selon la version (comme le desktop : < 1.3.1 normal seulement,
// < 1.7.2 normal ou superflat)
function levelTypesFor(version) {
  if (!version) return LEVEL_TYPES;
  if (compareVersions(version, '1.3.1') < 0) return LEVEL_TYPES.slice(0, 1);
  if (compareVersions(version, '1.7.2') < 0) return LEVEL_TYPES.slice(0, 2);
  return LEVEL_TYPES;
}

function Section({ title }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionStripe} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Chips({ items, value, onChange }) {
  return (
    <View style={styles.chips}>
      {items.map(it => {
        const active = it.value === value;
        return (
          <TouchableOpacity
            key={it.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(it.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{it.label}</Text>
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
  const [versions, setVersions] = useState(null);     // null = chargement, [] = indisponible
  const [pickerOpen, setPickerOpen] = useState(false);

  const [phase, setPhase]     = useState('form');      // form | creating | error
  const [stepStates, setStepStates] = useState([]);
  const [failure, setFailure] = useState('');

  const setting = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));
  const latest = versions && versions.length ? versions[0] : '';
  const effectiveVersion = version.trim() || latest;
  const steps = useMemo(() => buildSteps(type), [type]);

  // Charge la liste de versions du type choisi (en arrière-plan, sans bloquer le formulaire)
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

  // Pas de retour en arrière pendant la création : elle continue côté serveur
  useEffect(() => {
    navigation.setOptions({ headerLeft: phase === 'creating' ? () => null : undefined, gestureEnabled: phase !== 'creating' });
    if (phase !== 'creating') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [phase, navigation]);

  const validate = () => {
    const n = name.trim();
    if (!n) return 'Donne un nom au serveur.';
    if (INVALID_NAME.test(n) || /[. ]$/.test(n)) return 'Le nom contient un caractère interdit (\\ / : * ? " < > |) ou finit par un point ou un espace.';
    if (existingNames.some(e => String(e).toLowerCase() === n.toLowerCase())) return 'Un serveur porte déjà ce nom.';
    if (!effectiveVersion) return 'Indique une version (la liste est indisponible).';
    const p = parseInt(port, 10);
    if (!(p >= 1 && p <= 65535)) return 'Le port doit être compris entre 1 et 65535.';
    if (!(parseInt(settings.max_players, 10) >= 1)) return 'Le nombre de joueurs max doit être au moins 1.';
    if (!(parseInt(settings.random_tick_speed, 10) >= 0)) return 'La vitesse des ticks aléatoires doit être positive ou nulle.';
    return null;
  };

  const start = async () => {
    const problem = validate();
    if (problem) { Alert.alert('Vérifie le formulaire', problem); return; }

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
        Alert.alert('Serveur créé', `« ${name.trim()} » est prêt.`);
        navigation.popToTop();
      } catch (e) {
        setFailure(`${e.step ? `Étape « ${e.step.label} » : ` : ''}${e.message}`);
        setPhase('error');
      }
    };

    // Version absente de la liste : le desktop la refuse, ici on laisse tenter
    if (versions && versions.length && !versions.includes(effectiveVersion)) {
      Alert.alert(
        'Version introuvable',
        `${effectiveVersion} n'apparaît pas dans la liste ${type}. Essayer quand même ?`,
        [{ text: 'Annuler', style: 'cancel' }, { text: 'Essayer', onPress: run }],
      );
      return;
    }
    run();
  };

  // ── Création en cours / échec ──
  if (phase !== 'form') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{phase === 'error' ? 'La création a échoué' : `Création de « ${name.trim()} »…`}</Text>
        {phase === 'creating' ? (
          <Text style={styles.hint}>Garde l'app ouverte : certaines étapes (Java, téléchargement, installation) peuvent durer plusieurs minutes.</Text>
        ) : null}

        <View style={styles.card}>
          {steps.map((s, i) => {
            const st = stepStates[i] || 'pending';
            return (
              <View key={s.id} style={styles.stepRow}>
                <View style={styles.stepIcon}>
                  {st === 'running' ? <ActivityIndicator size="small" color={colors.accent} />
                    : <Text style={[styles.stepGlyph, st === 'done' && { color: colors.green }, st === 'error' && { color: colors.red }]}>
                        {st === 'done' ? '✓' : st === 'error' ? '✕' : '○'}
                      </Text>}
                </View>
                <Text style={[styles.stepLabel, st === 'pending' && { color: colors.textMuted }]}>{s.label}</Text>
              </View>
            );
          })}
        </View>

        {phase === 'error' ? (
          <View>
            <Text style={styles.error}>{failure}</Text>
            <Text style={styles.hint}>Un serveur a pu être créé partiellement : vérifie la liste des serveurs avant de réessayer.</Text>
            <TouchableOpacity style={styles.btn} onPress={() => setPhase('form')}>
              <Text style={styles.btnText}>Modifier et réessayer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => navigation.popToTop()}>
              <Text style={styles.btnGhostText}>Retour à la liste</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    );
  }

  // ── Formulaire ──
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Section title="Serveur" />
      <Field label="Nom">
        <TextBox value={name} onChangeText={setName} placeholder="Mon serveur" />
      </Field>

      <Field label="Type">
        <Chips items={SERVER_TYPES.map(t => ({ label: t.label, value: t.id }))} value={type} onChange={changeType} />
        {type === 'fabric' || type === 'quilt' ? (
          <Text style={styles.hint}>Fabric API n'est pas installé automatiquement : ajoute-le ensuite depuis l'onglet Mods.</Text>
        ) : null}
      </Field>

      <Field
        label="Version"
        hint={
          versions === null ? 'Recherche des versions sur Internet…'
          : versions.length ? `Vide = dernière version (${latest}).`
          : 'Liste indisponible : saisis la version à la main (ex. 1.21.4).'
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
          <TouchableOpacity
            style={[styles.pickBtn, !(versions && versions.length) && styles.btnDisabled]}
            disabled={!(versions && versions.length)}
            onPress={() => setPickerOpen(true)}
          >
            <Text style={styles.pickBtnText}>Liste</Text>
          </TouchableOpacity>
        </View>
      </Field>

      <Section title="Jeu" />
      <Field label="Mode de jeu"><Chips items={GAMEMODES} value={settings.gamemode} onChange={v => setting('gamemode', v)} /></Field>
      <Field label="Difficulté"><Chips items={DIFFICULTIES} value={settings.difficulty} onChange={v => setting('difficulty', v)} /></Field>
      <Field label="Type de monde">
        <Chips items={levelTypesFor(effectiveVersion)} value={settings.level_type} onChange={v => setting('level_type', v)} />
      </Field>
      <Field label="Graine (optionnel)"><TextBox value={settings.seed} onChangeText={v => setting('seed', v)} placeholder="aléatoire" autoCapitalize="none" /></Field>
      <Field label="Message du jour"><TextBox value={settings.motd} onChangeText={v => setting('motd', v)} /></Field>
      <Field label="Joueurs max"><TextBox value={settings.max_players} onChangeText={v => setting('max_players', v.replace(/\D/g, ''))} keyboardType="number-pad" /></Field>
      <Field label="Port"><TextBox value={port} onChangeText={v => setPort(v.replace(/\D/g, ''))} keyboardType="number-pad" /></Field>

      <ToggleRow label="Combat entre joueurs (PvP)" value={settings.pvp} onChange={v => setting('pvp', v)} />
      <ToggleRow label="Apparition des créatures" value={settings.spawn_creatures} onChange={v => setting('spawn_creatures', v)} />
      <ToggleRow label="Protection du spawn" value={settings.spawn_protection} onChange={v => setting('spawn_protection', v)} />
      <ToggleRow label="Blocs de commande" value={settings.command_blocks} onChange={v => setting('command_blocks', v)} />
      <ToggleRow label="Garder l'inventaire" value={settings.keep_inventory} onChange={v => setting('keep_inventory', v)} />
      <ToggleRow label="Cycle jour/météo" value={settings.daylight_weather_cycle} onChange={v => setting('daylight_weather_cycle', v)} />
      <Field label="Vitesse des ticks aléatoires">
        <TextBox value={settings.random_tick_speed} onChangeText={v => setting('random_tick_speed', v.replace(/\D/g, ''))} keyboardType="number-pad" />
      </Field>

      <TouchableOpacity style={[styles.btn, { marginTop: spacing.xl }]} onPress={start} activeOpacity={0.8}>
        <Text style={styles.btnText}>Créer le serveur</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>Geyser (Bedrock), playit.gg et les mods se configurent ensuite depuis le serveur.</Text>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Versions {type}</Text>
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
                    {item}{item === latest ? '  (dernière)' : ''}
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
    backgroundColor: colors.bgInput, color: colors.textPrimary, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 9, fontSize: 14,
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

  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(99,143,196,0.06)',
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
