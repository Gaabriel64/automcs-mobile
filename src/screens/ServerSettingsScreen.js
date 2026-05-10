import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, TextInput,
  TouchableOpacity, Modal, Alert, ActivityIndicator
} from 'react-native';
import { telepathService } from '../services/telepath';
import { colors, spacing, radius, fonts } from '../theme';
import Slider from '@react-native-community/slider';

// ── RAM Slider ────────────────────────────────────────────────────────────────
function RamSlider({ value, onSave }) {
  const [local, setLocal]   = useState(value === 'auto' || value === '' ? 0 : Math.min(Math.max(parseInt(value) || 0, 0), 12));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    setLocal(value === 'auto' || value === '' ? 0 : Math.min(Math.max(parseInt(value) || 0, 0), 12));
  }, [value]);

  const commit = async (val) => {
    setLocal(val);
    const newValue = val === 0 ? 'auto' : String(val);
    setSaving(true);
    await onSave(newValue);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>RAM dédiée</Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {saving && <ActivityIndicator size="small" color={colors.accent} />}
        {saved && !saving && <Text style={styles.savedMark}>✓</Text>}
        <View style={{ flex: 1 }}>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0} maximumValue={12} step={1}
            value={local}
            onSlidingComplete={commit}
            onValueChange={setLocal}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.accent}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.sliderTick}>Auto</Text>
            <Text style={styles.sliderTick}>12 Go</Text>
          </View>
        </View>
        <Text style={styles.sliderValue}>{local === 0 ? 'Auto' : `${local} Go`}</Text>
      </View>
    </View>
  );
}

// ── Picker ────────────────────────────────────────────────────────────────────
function SimplePicker({ selectedValue, onValueChange, items }) {
  const [visible, setVisible] = useState(false);
  const selected = items.find(i => String(i.value) === String(selectedValue));

  return (
    <>
      <TouchableOpacity style={styles.pickerBtn} onPress={() => setVisible(true)}>
        <Text style={styles.pickerValue}>{selected?.label ?? String(selectedValue ?? '—')}</Text>
        <Text style={styles.pickerChevron}>▾</Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={styles.modalStripe} />
              <Text style={styles.modalTitle}>Sélectionner</Text>
            </View>
            {items.map(item => (
              <TouchableOpacity
                key={String(item.value)}
                style={[styles.modalItem, String(item.value) === String(selectedValue) && styles.modalItemActive]}
                onPress={() => { onValueChange(item.value); setVisible(false); }}
              >
                {String(item.value) === String(selectedValue) && <View style={styles.modalItemDot} />}
                <Text style={[styles.modalItemText, String(item.value) === String(selectedValue) && styles.modalItemTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ── Row primitives ────────────────────────────────────────────────────────────
function SwitchRow({ label, value, onSave }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        trackColor={{ false: colors.bgInput, true: colors.accentDim }}
        thumbColor={value ? colors.accent : colors.textMuted}
        ios_backgroundColor={colors.bgInput}
        value={!!value}
        onValueChange={v => onSave(v)}
      />
    </View>
  );
}

function InputRow({ label, value, onSave, keyboardType = 'default', placeholder = '' }) {
  const [local, setLocal]   = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  useEffect(() => { setLocal(String(value ?? '')); }, [value]);

  const commit = async () => {
    if (local === String(value ?? '')) return;
    setSaving(true);
    await onSave(local);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        {saving && <ActivityIndicator size="small" color={colors.accent} />}
        {saved && !saving && <Text style={styles.savedMark}>✓</Text>}
        <TextInput
          style={styles.input}
          value={local}
          onChangeText={setLocal}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
        />
      </View>
    </View>
  );
}

function PickerRow({ label, value, onSave, items }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        {saving && <ActivityIndicator size="small" color={colors.accent} />}
        {saved && !saving && <Text style={styles.savedMark}>✓</Text>}
        <SimplePicker
          selectedValue={value}
          onValueChange={async v => {
            setSaving(true);
            await onSave(v);
            setSaving(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }}
          items={items}
        />
      </View>
    </View>
  );
}

// ── Section title ─────────────────────────────────────────────────────────────
function SectionHeader({ title }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionStripe} />
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
    </View>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const GAMEMODES = [
  { label: 'Survie', value: 0 },
  { label: 'Créatif', value: 1 },
  { label: 'Aventure', value: 2 },
  { label: 'Spectateur', value: 3 },
];
const DIFFICULTIES = [
  { label: 'Paisible', value: 0 },
  { label: 'Facile', value: 1 },
  { label: 'Normal', value: 2 },
  { label: 'Difficile', value: 3 },
];

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ServerSettingsScreen({ route }) {
  const { serverName } = route.params;
  const [props, setProps]   = useState(null);
  const [cfg, setCfg]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [sp, cf] = await Promise.all([
          telepathService._post('ServerObject/_sync_attr', { name: 'server_properties' }),
          telepathService._post('ServerObject/_sync_attr', { name: 'config_file' }),
        ]);
        setProps(sp || {}); setCfg(cf || {});
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [serverName]);

  const saveProp = useCallback(async (key, value) => {
    const newProps = { ...props, [key]: value };
    setProps(newProps);
    try {
      await telepathService._post('ServerObject/write_config', {
        remote_data: { config_file: cfg, server_properties: newProps },
      });
    } catch (e) {
      Alert.alert('Erreur', `${key}: ${e.message}`);
      setProps(prev => ({ ...prev, [key]: props[key] }));
    }
  }, [props, cfg]);

  const saveRam = useCallback(async (value) => {
    try {
      await telepathService._post('ServerObject/set_ram_limit', { value });
      setCfg(prev => ({ ...prev, general: { ...(prev?.general || {}), allocatedmemory: value } }));
    } catch (e) {
      Alert.alert('Erreur RAM', e.message);
    }
  }, []);

  const saveAutoUpdate = useCallback(async (enabled) => {
    try {
      await telepathService._post('ServerObject/enable_auto_update', { enabled });
      setCfg(prev => ({ ...prev, general: { ...(prev?.general || {}), updateauto: String(enabled) } }));
    } catch (e) {
      Alert.alert('Erreur', e.message);
    }
  }, []);

  const saveFlags = useCallback(async (flags) => {
    try {
      await telepathService._post('ServerObject/update_flags', { flags });
      setCfg(prev => ({ ...prev, general: { ...(prev?.general || {}), customflags: flags } }));
    } catch (e) {
      Alert.alert('Erreur', e.message);
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Chargement des paramètres…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 36 }}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const g = cfg?.general || {};
  const isBool    = v => v === true || v === 'true';
  const isNotFalse = v => v !== false && v !== 'false';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <SectionHeader title="Général" />
      <InputRow label="Message du jour" value={props?.motd} onSave={v => saveProp('motd', v)} />
      <InputRow label="Nom du monde" value={props?.['level-name']} onSave={v => saveProp('level-name', v)} />
      <InputRow label="Graine" value={props?.['level-seed']} onSave={v => saveProp('level-seed', v)} />
      <PickerRow label="Mode de jeu" value={props?.gamemode} onSave={v => saveProp('gamemode', v)} items={GAMEMODES} />
      <PickerRow label="Difficulté" value={props?.difficulty} onSave={v => saveProp('difficulty', v)} items={DIFFICULTIES} />
      <SwitchRow label="Mode hardcore" value={isBool(props?.hardcore)} onSave={v => saveProp('hardcore', v)} />
      <InputRow label="Joueurs max" value={String(props?.['max-players'] ?? '')} onSave={v => saveProp('max-players', parseInt(v) || 20)} keyboardType="number-pad" />
      <InputRow label="Port" value={String(props?.['server-port'] ?? '')} onSave={v => saveProp('server-port', parseInt(v) || 25565)} keyboardType="number-pad" />

      <SectionHeader title="Gameplay" />
      <SwitchRow label="PvP" value={isNotFalse(props?.pvp)} onSave={v => saveProp('pvp', v)} />
      <SwitchRow label="Blocs de commande" value={isBool(props?.['enable-command-block'])} onSave={v => saveProp('enable-command-block', v)} />
      <SwitchRow label="Vol autorisé" value={isBool(props?.['allow-flight'])} onSave={v => saveProp('allow-flight', v)} />
      <SwitchRow label="Nether" value={isNotFalse(props?.['allow-nether'])} onSave={v => saveProp('allow-nether', v)} />
      <SwitchRow label="Générer structures" value={isNotFalse(props?.['generate-structures'])} onSave={v => saveProp('generate-structures', v)} />
      <SwitchRow label="Animaux" value={isNotFalse(props?.['spawn-animals'])} onSave={v => saveProp('spawn-animals', v)} />
      <SwitchRow label="Monstres" value={isNotFalse(props?.['spawn-monsters'])} onSave={v => saveProp('spawn-monsters', v)} />
      <SwitchRow label="PNJs" value={isNotFalse(props?.['spawn-npcs'])} onSave={v => saveProp('spawn-npcs', v)} />
      <InputRow label="Distance de vue" value={String(props?.['view-distance'] ?? '')} onSave={v => saveProp('view-distance', parseInt(v) || 10)} keyboardType="number-pad" />
      <InputRow label="Simulation" value={String(props?.['simulation-distance'] ?? '')} onSave={v => saveProp('simulation-distance', parseInt(v) || 10)} keyboardType="number-pad" />

      <SectionHeader title="Connexion" />
      <SwitchRow label="Mode en ligne" value={isNotFalse(props?.['online-mode'])} onSave={v => saveProp('online-mode', v)} />
      <SwitchRow label="Whitelist" value={isBool(props?.['white-list'])} onSave={v => saveProp('white-list', v)} />

      <SectionHeader title="auto-mcs" />
      <RamSlider value={g?.allocatedmemory ?? g?.allocatedMemory ?? ''} onSave={saveRam} />
      <SwitchRow label="Mise à jour auto" value={isNotFalse(g?.updateauto ?? g?.updateAuto)} onSave={saveAutoUpdate} />
      <InputRow label="Flags Java" value={g?.customflags ?? g?.customFlags ?? ''} onSave={saveFlags} placeholder="-Xmx2G -Xms2G" />

      <SectionHeader title="Avancé" />
      <InputRow label="Adresse IP" value={props?.['server-ip'] ?? ''} onSave={v => saveProp('server-ip', v)} placeholder="toutes les interfaces" />
      <InputRow label="Hauteur max" value={String(props?.['max-build-height'] ?? '')} onSave={v => saveProp('max-build-height', parseInt(v) || 256)} keyboardType="number-pad" />
      <InputRow label="Level type" value={props?.['level-type'] ?? ''} onSave={v => saveProp('level-type', v)} placeholder="normal" />
      <InputRow label="Tick max (ms)" value={String(props?.['max-tick-time'] ?? '')} onSave={v => saveProp('max-tick-time', parseInt(v) || 60000)} keyboardType="number-pad" />
      <InputRow label="Protection spawn" value={String(props?.['spawn-protection'] ?? '')} onSave={v => saveProp('spawn-protection', parseInt(v) || 16)} keyboardType="number-pad" />
      <InputRow label="Compression réseau" value={String(props?.['network-compression-threshold'] ?? '')} onSave={v => saveProp('network-compression-threshold', parseInt(v) || 256)} keyboardType="number-pad" />
      <SwitchRow label="Snooper" value={isNotFalse(props?.['snooper-enabled'])} onSave={v => saveProp('snooper-enabled', v)} />
      <SwitchRow label="Whitelist stricte" value={isBool(props?.['enforce-whitelist'])} onSave={v => saveProp('enforce-whitelist', v)} />
      <SwitchRow label="Profils sécurisés" value={isNotFalse(props?.['enforce-secure-profile'])} onSave={v => saveProp('enforce-secure-profile', v)} />
      <InputRow label="Pack de ressource" value={props?.['resource-pack'] ?? ''} onSave={v => saveProp('resource-pack', v)} placeholder="URL" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.md, paddingBottom: 60 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: spacing.md },
  loadingText: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.sm },
  errorText: { color: colors.red, textAlign: 'center', paddingHorizontal: spacing.lg, fontSize: 14 },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: spacing.xl, marginBottom: spacing.xs,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sectionStripe: { width: 3, height: 14, borderRadius: 2, backgroundColor: colors.accent },
  sectionTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 2,
    color: colors.accent, textTransform: 'uppercase',
  },

  // Row
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, minHeight: 46,
    borderBottomWidth: 1, borderBottomColor: 'rgba(99,143,196,0.06)',
  },
  rowLabel: { color: colors.textPrimary, fontSize: 14, flex: 1, paddingRight: spacing.sm },

  // Input
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: {
    backgroundColor: colors.bgInput, color: colors.textPrimary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    fontSize: 13, minWidth: 110, textAlign: 'right',
    borderWidth: 1, borderColor: colors.border,
    fontFamily: fonts.mono,
  },

  // Picker
  pickerBtn: {
    backgroundColor: colors.bgInput, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border, minWidth: 110,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6,
  },
  pickerValue:   { color: colors.textPrimary, fontSize: 13 },
  pickerChevron: { color: colors.textSecondary, fontSize: 11 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', padding: spacing.xl,
  },
  modalBox: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalStripe: { width: 3, height: 14, borderRadius: 2, backgroundColor: colors.accent },
  modalTitle:  {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.5,
    color: colors.accent, textTransform: 'uppercase',
  },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalItemActive: { backgroundColor: colors.accentDim },
  modalItemDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.accent,
  },
  modalItemText: { color: colors.textPrimary, fontSize: 15 },
  modalItemTextActive: { color: colors.accent, fontWeight: '700' },

  // Feedback
  savedMark: { color: colors.green, fontSize: 12, fontWeight: '700' },
  sliderTick: { color: colors.textMuted, fontSize: 10 },
  sliderValue: { color: colors.textPrimary, fontWeight: '700', minWidth: 48, textAlign: 'center', fontSize: 13 },
});
