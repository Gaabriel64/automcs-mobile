import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, TextInput,
  TouchableOpacity, Modal, Alert, ActivityIndicator
} from 'react-native';
import { telepathService } from '../services/telepath';
import { colors, spacing, radius, fonts } from '../theme';
import Slider from '@react-native-community/slider';
import { useFocusEffect } from '@react-navigation/native';
import ServerManagement from '../components/ServerManagement';
import { cleanConfig, fetchFreshConfig } from '../utils/config';

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
      <Text style={styles.rowLabel}>Dedicated RAM</Text>
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
            <Text style={styles.sliderTick}>12 GB</Text>
          </View>
        </View>
        <Text style={styles.sliderValue}>{local === 0 ? 'Auto' : `${local} GB`}</Text>
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
              <Text style={styles.modalTitle}>Select</Text>
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
  { label: 'Survival', value: 0 },
  { label: 'Creative', value: 1 },
  { label: 'Adventure', value: 2 },
  { label: 'Spectator', value: 3 },
];
const DIFFICULTIES = [
  { label: 'Peaceful', value: 0 },
  { label: 'Easy', value: 1 },
  { label: 'Normal', value: 2 },
  { label: 'Hard', value: 3 },
];

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ServerSettingsScreen({ route, navigation }) {
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

  // Re-reads the server config (after an action that modifies it on the server: playit,
  // Geyser, autostart...) so it is never overwritten with a stale copy.
  const reloadCfg = useCallback(async () => {
    try {
      const cf = await telepathService._post('ServerObject/_sync_attr', { name: 'config_file' });
      if (cf) setCfg(cleanConfig(cf));
    } catch {}
  }, []);

  const saveProp = useCallback(async (key, value) => {
    const newProps = { ...props, [key]: value };
    setProps(newProps);
    try {
      // Config re-read right before writing: write_config replaces the whole file, a copy
      // kept since the screen loaded would undo the changes made in the meantime.
      const fresh = await fetchFreshConfig(telepathService).catch(() => cleanConfig(cfg));
      await telepathService._post('ServerObject/write_config', {
        remote_data: { config_file: fresh, server_properties: newProps },
      });
    } catch (e) {
      Alert.alert('Error', `${key}: ${e.message}`);
      setProps(prev => ({ ...prev, [key]: props[key] }));
    }
  }, [props, cfg]);

  const saveRam = useCallback(async (value) => {
    try {
      await telepathService._post('ServerObject/set_ram_limit', { value });
      await reloadCfg();
    } catch (e) {
      Alert.alert('RAM error', e.message);
    }
  }, [reloadCfg]);

  const saveAutoUpdate = useCallback(async (enabled) => {
    try {
      await telepathService._post('ServerObject/enable_auto_update', { enabled });
      await reloadCfg();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }, [reloadCfg]);

  const saveFlags = useCallback(async (flags) => {
    try {
      await telepathService._post('ServerObject/update_flags', { flags });
      await reloadCfg();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }, [reloadCfg]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Loading settings…</Text>
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
      <SectionHeader title="General" />
      <InputRow label="Message of the day" value={props?.motd} onSave={v => saveProp('motd', v)} />
      <InputRow label="World name" value={props?.['level-name']} onSave={v => saveProp('level-name', v)} />
      <InputRow label="Seed" value={props?.['level-seed']} onSave={v => saveProp('level-seed', v)} />
      <PickerRow label="Game mode" value={props?.gamemode} onSave={v => saveProp('gamemode', v)} items={GAMEMODES} />
      <PickerRow label="Difficulty" value={props?.difficulty} onSave={v => saveProp('difficulty', v)} items={DIFFICULTIES} />
      <SwitchRow label="Hardcore mode" value={isBool(props?.hardcore)} onSave={v => saveProp('hardcore', v)} />
      <InputRow label="Max players" value={String(props?.['max-players'] ?? '')} onSave={v => saveProp('max-players', parseInt(v) || 20)} keyboardType="number-pad" />
      <InputRow label="Port" value={String(props?.['server-port'] ?? '')} onSave={v => saveProp('server-port', parseInt(v) || 25565)} keyboardType="number-pad" />

      <SectionHeader title="Gameplay" />
      <SwitchRow label="PvP" value={isNotFalse(props?.pvp)} onSave={v => saveProp('pvp', v)} />
      <SwitchRow label="Command blocks" value={isBool(props?.['enable-command-block'])} onSave={v => saveProp('enable-command-block', v)} />
      <SwitchRow label="Allow flight" value={isBool(props?.['allow-flight'])} onSave={v => saveProp('allow-flight', v)} />
      <SwitchRow label="Nether" value={isNotFalse(props?.['allow-nether'])} onSave={v => saveProp('allow-nether', v)} />
      <SwitchRow label="Generate structures" value={isNotFalse(props?.['generate-structures'])} onSave={v => saveProp('generate-structures', v)} />
      <SwitchRow label="Animals" value={isNotFalse(props?.['spawn-animals'])} onSave={v => saveProp('spawn-animals', v)} />
      <SwitchRow label="Monsters" value={isNotFalse(props?.['spawn-monsters'])} onSave={v => saveProp('spawn-monsters', v)} />
      <SwitchRow label="NPCs" value={isNotFalse(props?.['spawn-npcs'])} onSave={v => saveProp('spawn-npcs', v)} />
      <InputRow label="View distance" value={String(props?.['view-distance'] ?? '')} onSave={v => saveProp('view-distance', parseInt(v) || 10)} keyboardType="number-pad" />
      <InputRow label="Simulation distance" value={String(props?.['simulation-distance'] ?? '')} onSave={v => saveProp('simulation-distance', parseInt(v) || 10)} keyboardType="number-pad" />

      <SectionHeader title="Network" />
      <SwitchRow label="Online mode" value={isNotFalse(props?.['online-mode'])} onSave={v => saveProp('online-mode', v)} />
      <SwitchRow label="Whitelist" value={isBool(props?.['white-list'])} onSave={v => saveProp('white-list', v)} />

      <SectionHeader title="auto-mcs" />
      <RamSlider value={g?.allocatedMemory ?? g?.allocatedmemory ?? ''} onSave={saveRam} />
      <SwitchRow label="Auto update" value={isNotFalse(g?.updateAuto ?? g?.updateauto)} onSave={saveAutoUpdate} />
      <InputRow label="Java flags" value={g?.customFlags ?? g?.customflags ?? ''} onSave={saveFlags} placeholder="-Xmx2G -Xms2G" />
      <InputRow
        label="Max backups"
        value={cfg?.bkup?.bkupMax ?? cfg?.general?.maxbackups ?? '5'}
        onSave={async (v) => {
          try {
            const fresh = await fetchFreshConfig(telepathService);
            const newCfg = { ...fresh, bkup: { ...(fresh?.bkup || {}), bkupMax: v } };
            await telepathService._post('ServerObject/write_config', {
              remote_data: { config_file: newCfg, server_properties: props },
            });
            setCfg(newCfg);
          } catch (e) {
            Alert.alert('Error', e.message);
          }
        }}
        keyboardType="number-pad"
        placeholder="5"
      />
      <TouchableOpacity
        style={styles.restoreLink}
        onPress={() => navigation.navigate('BackupList', { serverName })}
      >
        <Text style={styles.restoreLinkText}>📂 Manage backups</Text>
      </TouchableOpacity>

      <SectionHeader title="Advanced" />
      <InputRow label="IP address" value={props?.['server-ip'] ?? ''} onSave={v => saveProp('server-ip', v)} placeholder="all interfaces" />
      <InputRow label="Max build height" value={String(props?.['max-build-height'] ?? '')} onSave={v => saveProp('max-build-height', parseInt(v) || 256)} keyboardType="number-pad" />
      <InputRow label="Level type" value={props?.['level-type'] ?? ''} onSave={v => saveProp('level-type', v)} placeholder="normal" />
      <InputRow label="Max tick time (ms)" value={String(props?.['max-tick-time'] ?? '')} onSave={v => saveProp('max-tick-time', parseInt(v) || 60000)} keyboardType="number-pad" />
      <InputRow label="Spawn protection" value={String(props?.['spawn-protection'] ?? '')} onSave={v => saveProp('spawn-protection', Number.isNaN(parseInt(v, 10)) ? 16 : parseInt(v, 10))} keyboardType="number-pad" />
      <InputRow label="Network compression" value={String(props?.['network-compression-threshold'] ?? '')} onSave={v => saveProp('network-compression-threshold', parseInt(v) || 256)} keyboardType="number-pad" />
      <SwitchRow label="Snooper" value={isNotFalse(props?.['snooper-enabled'])} onSave={v => saveProp('snooper-enabled', v)} />
      <SwitchRow label="Enforce whitelist" value={isBool(props?.['enforce-whitelist'])} onSave={v => saveProp('enforce-whitelist', v)} />
      <SwitchRow label="Secure profiles" value={isNotFalse(props?.['enforce-secure-profile'])} onSave={v => saveProp('enforce-secure-profile', v)} />
      <InputRow label="Resource pack" value={props?.['resource-pack'] ?? ''} onSave={v => saveProp('resource-pack', v)} placeholder="URL" />

      <ServerManagement
        serverName={serverName}
        cfg={cfg}
        onCfgChanged={reloadCfg}
        navigation={navigation}
      />
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

  restoreLink: { paddingVertical: spacing.sm, marginTop: spacing.sm },
  restoreLinkText: { color: colors.accentLight, fontWeight: '600', fontSize: 13 },
});
