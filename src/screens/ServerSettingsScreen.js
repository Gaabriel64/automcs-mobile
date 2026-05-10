import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, TextInput,
  TouchableOpacity, Modal, Alert, ActivityIndicator, Platform
} from 'react-native';
import { telepathService } from '../services/telepath';
import { colors, spacing, radius } from '../theme';
import Slider from '@react-native-community/slider';

function RamSlider({ value, onSave }) {
  const [local, setLocal] = useState(value === 'auto' || value === '' ? 0 : Math.min(Math.max(parseInt(value) || 0, 0), 12));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
        {saved && !saving && <Text style={{ color: colors.green, fontSize: 12 }}>✓</Text>}
        <View style={{ flex: 1 }}>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={12}
            step={1}
            value={local}
            onSlidingComplete={commit}
            onValueChange={setLocal}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.accentLight}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Auto</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 10 }}>12 Go</Text>
          </View>
        </View>
        <Text style={{ color: colors.textPrimary, fontWeight: '600', minWidth: 40, textAlign: 'center' }}>
          {local === 0 ? 'Auto' : local + ' Go'}
        </Text>
      </View>
    </View>
  );
}

// ---------- Picker ----------
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
          <View style={styles.modalContent}>
            {items.map(item => (
              <TouchableOpacity
                key={String(item.value)}
                style={styles.modalItem}
                onPress={() => { onValueChange(item.value); setVisible(false); }}
              >
                <Text style={[styles.modalItemText, String(item.value) === String(selectedValue) && styles.modalItemSelected]}>
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

function SwitchRow({ label, value, onSave }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={value ? colors.accentLight : '#888'}
        value={!!value}
        onValueChange={v => onSave(v)}
      />
    </View>
  );
}

function InputRow({ label, value, onSave, keyboardType = 'default', placeholder = '' }) {
  const [local, setLocal] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {saving && <ActivityIndicator size="small" color={colors.accent} />}
        {saved && !saving && <Text style={{ color: colors.green, fontSize: 12 }}>✓</Text>}
        <TextInput
          style={styles.input}
          value={local}
          onChangeText={setLocal}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          returnKeyType="done"
        />
      </View>
    </View>
  );
}

function PickerRow({ label, value, onSave, items }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {saving && <ActivityIndicator size="small" color={colors.accent} />}
        {saved && !saving && <Text style={{ color: colors.green, fontSize: 12 }}>✓</Text>}
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

function SectionTitle({ title }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionText}>{title}</Text>
    </View>
  );
}

const GAMEMODES = [
  { label: 'Survie (0)', value: 0 },
  { label: 'Créatif (1)', value: 1 },
  { label: 'Aventure (2)', value: 2 },
  { label: 'Spectateur (3)', value: 3 },
];
const DIFFICULTIES = [
  { label: 'Paisible (0)', value: 0 },
  { label: 'Facile (1)', value: 1 },
  { label: 'Normal (2)', value: 2 },
  { label: 'Difficile (3)', value: 3 },
];

export default function ServerSettingsScreen({ route }) {
  const { serverName } = route.params;
  const [props, setProps] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [sp, cf] = await Promise.all([
          telepathService._post('ServerObject/_sync_attr', { name: 'server_properties' }),
          telepathService._post('ServerObject/_sync_attr', { name: 'config_file' }),
        ]);
        console.log('[Settings] server_properties keys:', Object.keys(sp || {}));
        console.log('[Settings] config_file:', JSON.stringify(cf || {}).slice(0, 300));
        setProps(sp || {});
        setCfg(cf || {});
      } catch (e) {
        console.warn('[Settings] load error:', e.message);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [serverName]);

  // Save server.properties via write_config(remote_data={...})
  // The key insight: remote_data must be wrapped as {remote_data: {...}}
  // because api_wrapper passes kwargs directly to ServerObject.write_config(remote_data)
  const saveProp = useCallback(async (key, value) => {
    const newProps = { ...props, [key]: value };
    setProps(newProps);
    try {
      console.log(`[Settings] saving prop ${key} =`, value);
      const result = await telepathService._post('ServerObject/write_config', {
        remote_data: {
          config_file: cfg,
          server_properties: newProps,
        }
      });
      console.log(`[Settings] write_config result:`, result);
    } catch (e) {
      console.warn(`[Settings] write_config error (${key}):`, e.message);
      Alert.alert('Erreur', `${key}: ${e.message}`);
      setProps(prev => ({ ...prev, [key]: props[key] }));
    }
  }, [props, cfg]);

  // Save auto-mcs config via dedicated endpoints
  const saveRam = useCallback(async (value) => {
    try {
      const result = await telepathService._post('ServerObject/set_ram_limit', { value });
      console.log('[Settings] set_ram_limit:', result);
      setCfg(prev => ({...prev, general: {...(prev?.general || {}), allocatedmemory: value}}));
    } catch (e) {
      Alert.alert('Erreur RAM', e.message);
    }
  }, []);

  const saveAutoUpdate = useCallback(async (enabled) => {
    try {
      const result = await telepathService._post('ServerObject/enable_auto_update', { enabled });
      console.log('[Settings] enable_auto_update:', result);
      setCfg(prev => ({...prev, general: {...(prev?.general || {}), updateauto: String(enabled)}}));
    } catch (e) {
      Alert.alert('Erreur auto-update', e.message);
    }
  }, []);

  const saveFlags = useCallback(async (flags) => {
    try {
      const result = await telepathService._post('ServerObject/update_flags', { flags });
      console.log('[Settings] update_flags:', result);
      setCfg(prev => ({...prev, general: {...(prev?.general || {}), customflags: flags}}));
    } catch (e) {
      Alert.alert('Erreur flags', e.message);
    }
  }, []);

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>Chargement...</Text>
    </View>
  );

  if (error) return (
    <View style={styles.centered}>
      <Text style={{ color: colors.red, textAlign: 'center', padding: spacing.lg }}>{error}</Text>
    </View>
  );

  const g = cfg?.general || {};
  const isBool = v => v === true || v === 'true';
  const isNotFalse = v => v !== false && v !== 'false';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

      <SectionTitle title="Général" />
      <InputRow label="Message du jour" value={props?.motd} onSave={v => saveProp('motd', v)} />
      <InputRow label="Nom du monde" value={props?.['level-name']} onSave={v => saveProp('level-name', v)} />
      <InputRow label="Graine" value={props?.['level-seed']} onSave={v => saveProp('level-seed', v)} />
      <PickerRow label="Mode de jeu" value={props?.gamemode} onSave={v => saveProp('gamemode', v)} items={GAMEMODES} />
      <PickerRow label="Difficulté" value={props?.difficulty} onSave={v => saveProp('difficulty', v)} items={DIFFICULTIES} />
      <SwitchRow label="Mode hardcore" value={isBool(props?.hardcore)} onSave={v => saveProp('hardcore', v)} />
      <InputRow label="Joueurs max" value={String(props?.['max-players'] ?? '')} onSave={v => saveProp('max-players', parseInt(v) || 20)} keyboardType="number-pad" />
      <InputRow label="Port" value={String(props?.['server-port'] ?? '')} onSave={v => saveProp('server-port', parseInt(v) || 25565)} keyboardType="number-pad" />

      <SectionTitle title="Gameplay" />
      <SwitchRow label="PvP" value={isNotFalse(props?.pvp)} onSave={v => saveProp('pvp', v)} />
      <SwitchRow label="Blocs de commande" value={isBool(props?.['enable-command-block'])} onSave={v => saveProp('enable-command-block', v)} />
      <SwitchRow label="Vol autorisé" value={isBool(props?.['allow-flight'])} onSave={v => saveProp('allow-flight', v)} />
      <SwitchRow label="Nether" value={isNotFalse(props?.['allow-nether'])} onSave={v => saveProp('allow-nether', v)} />
      <SwitchRow label="Générer structures" value={isNotFalse(props?.['generate-structures'])} onSave={v => saveProp('generate-structures', v)} />
      <SwitchRow label="Mode forcé" value={isBool(props?.['force-gamemode'])} onSave={v => saveProp('force-gamemode', v)} />
      <SwitchRow label="Animaux" value={isNotFalse(props?.['spawn-animals'])} onSave={v => saveProp('spawn-animals', v)} />
      <SwitchRow label="Monstres" value={isNotFalse(props?.['spawn-monsters'])} onSave={v => saveProp('spawn-monsters', v)} />
      <SwitchRow label="PNJs" value={isNotFalse(props?.['spawn-npcs'])} onSave={v => saveProp('spawn-npcs', v)} />
      <InputRow label="Distance de vue" value={String(props?.['view-distance'] ?? '')} onSave={v => saveProp('view-distance', parseInt(v) || 10)} keyboardType="number-pad" />
      <InputRow label="Simulation" value={String(props?.['simulation-distance'] ?? '')} onSave={v => saveProp('simulation-distance', parseInt(v) || 10)} keyboardType="number-pad" />

      <SectionTitle title="Connexion" />
      <SwitchRow label="Mode en ligne" value={isNotFalse(props?.['online-mode'])} onSave={v => saveProp('online-mode', v)} />
      <SwitchRow label="Whitelist" value={isBool(props?.['white-list'])} onSave={v => saveProp('white-list', v)} />

      <SectionTitle title="auto-mcs" />
      <InputRow
        label="RAM dédiée (Go)"
        value={g?.allocatedmemory ?? g?.allocatedMemory ?? ''}
        onSave={saveRam}
        keyboardType="numeric"
        placeholder="auto"
      />
      <SwitchRow
        label="Mise à jour auto"
        value={isNotFalse(g?.updateauto ?? g?.updateAuto)}
        onSave={saveAutoUpdate}
      />
      <InputRow
        label="Flags Java"
        value={g?.customflags ?? g?.customFlags ?? ''}
        onSave={saveFlags}
        placeholder="-Xmx2G -Xms2G"
      />

      <SectionTitle title="Avancé" />
      {/* Ces champs apparaissent dans les captures d'écran mais ne sont pas encore présents */}
      <InputRow
        label="Adresse IP"
        value={props?.['server-ip'] ?? ''}
        onSave={v => saveProp('server-ip', v)}
        placeholder="vide = toutes"
      />
      <InputRow
        label="Hauteur max"
        value={String(props?.['max-build-height'] ?? '')}
        onSave={v => saveProp('max-build-height', parseInt(v) || 256)}
        keyboardType="number-pad"
      />
      <InputRow
        label="Monde (level-type)"
        value={props?.['level-type'] ?? ''}
        onSave={v => saveProp('level-type', v)}
        placeholder="normal"
      />
      <InputRow
        label="Tick max (ms)"
        value={String(props?.['max-tick-time'] ?? '')}
        onSave={v => saveProp('max-tick-time', parseInt(v) || 60000)}
        keyboardType="number-pad"
      />
      <InputRow
        label="Protection spawn"
        value={String(props?.['spawn-protection'] ?? '')}
        onSave={v => saveProp('spawn-protection', parseInt(v) || 16)}
        keyboardType="number-pad"
      />
      <InputRow
        label="Compression réseau"
        value={String(props?.['network-compression-threshold'] ?? '')}
        onSave={v => saveProp('network-compression-threshold', parseInt(v) || 256)}
        keyboardType="number-pad"
      />
      <InputRow
        label="Taille max monde"
        value={String(props?.['max-world-size'] ?? '')}
        onSave={v => saveProp('max-world-size', parseInt(v) || 29999984)}
        keyboardType="number-pad"
      />
      <SwitchRow
        label="Snooper activé"
        value={isNotFalse(props?.['snooper-enabled'])}
        onSave={v => saveProp('snooper-enabled', v)}
      />
      <SwitchRow
        label="Whitelist stricte"
        value={isBool(props?.['enforce-whitelist'])}
        onSave={v => saveProp('enforce-whitelist', v)}
      />
      <SwitchRow
        label="Profils sécurisés"
        value={isNotFalse(props?.['enforce-secure-profile'])}
        onSave={v => saveProp('enforce-secure-profile', v)}
      />
      <InputRow
        label="Pack de ressource"
        value={props?.['resource-pack'] ?? ''}
        onSave={v => saveProp('resource-pack', v)}
        placeholder="URL ou vide"
      />
      <InputRow
        label="Hash pack ressource"
        value={props?.['resource-pack-hash'] ?? ''}
        onSave={v => saveProp('resource-pack-hash', v)}
        placeholder="SHA-1"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.md },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  section: {
    marginTop: spacing.lg, marginBottom: spacing.xs,
    paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sectionText: { color: colors.accent, fontWeight: '700', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', minHeight: 46,
  },
  rowLabel: { color: colors.textPrimary, fontSize: 14, flex: 1, paddingRight: spacing.sm },
  input: {
    backgroundColor: colors.bgInput, color: colors.textPrimary,
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6,
    fontSize: 13, minWidth: 110, textAlign: 'right',
    borderWidth: 1, borderColor: colors.border,
  },
  pickerBtn: {
    backgroundColor: colors.bgInput, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border, minWidth: 110,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6,
  },
  pickerValue: { color: colors.textPrimary, fontSize: 13 },
  pickerChevron: { color: colors.textSecondary, fontSize: 11 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
  modalContent: { backgroundColor: colors.bgCard, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  modalItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalItemText: { color: colors.textPrimary, fontSize: 15 },
  modalItemSelected: { color: colors.accentLight, fontWeight: '700' },
});
