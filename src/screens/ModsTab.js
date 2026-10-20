import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { Text, TextInput, Icon, Button } from '../components/ui';
import * as DocumentPicker from 'expo-document-picker';
import { telepathService } from '../services/telepath';
import { colors, spacing, radius } from '../theme';

// ── Segment control ───────────────────────────────────────────────────────────
function SegmentControl({ options, active, onSelect }) {
  return (
    <View style={segStyles.wrap}>
      {options.map((opt) => {
        const on = active === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[segStyles.seg, on && segStyles.segActive]}
            onPress={() => onSelect(opt.key)}
            activeOpacity={0.8}
          >
            <Text style={[segStyles.text, on && segStyles.textActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const segStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', gap: 4, margin: spacing.md, marginBottom: spacing.sm,
    padding: 4, borderRadius: radius.md, backgroundColor: colors.bgInput,
  },
  seg: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm },
  segActive: { backgroundColor: colors.indigo },
  text: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  textActive: { color: colors.textPrimary },
});

// ── Addon row (search results) ────────────────────────────────────────────────
function AddonRow({ item, isInstalled, onPress, onInstall, onDelete }) {
  return (
    <TouchableOpacity style={rowStyles.row} onPress={onPress} activeOpacity={0.85}>
      <View style={[rowStyles.iconBox, isInstalled && { backgroundColor: colors.accentDim }]}>
        <Icon name="extension-puzzle" size={20} color={isInstalled ? colors.accent : colors.textSecondary} />
      </View>
      <View style={rowStyles.body}>
        <View style={rowStyles.top}>
          <Text style={rowStyles.name} numberOfLines={1}>{item.name}</Text>
          {isInstalled ? (
            <View style={rowStyles.installedBadge}>
              <Text style={rowStyles.installedText}>Installed</Text>
            </View>
          ) : null}
        </View>
        {item.subtitle || item.description ? (
          <Text style={rowStyles.desc} numberOfLines={2}>{item.subtitle || item.description}</Text>
        ) : null}
      </View>
      {isInstalled ? (
        <TouchableOpacity style={[rowStyles.actionBtn, rowStyles.delBtn]} onPress={onDelete} activeOpacity={0.7}>
          <Icon name="trash-outline" size={18} color={colors.red} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[rowStyles.actionBtn, rowStyles.addBtn]} onPress={onInstall} activeOpacity={0.7}>
          <Icon name="download-outline" size={18} color={colors.accent} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.md, marginBottom: spacing.sm, padding: spacing.md,
  },
  iconBox: {
    width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.bgRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, gap: 3 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  installedBadge: { backgroundColor: colors.accentDim, borderRadius: radius.xs, paddingHorizontal: 6, paddingVertical: 2 },
  installedText: { fontSize: 10, fontWeight: '800', color: colors.accent },
  desc: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  actionBtn: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  addBtn: { backgroundColor: colors.accentDim },
  delBtn: { backgroundColor: 'rgba(255,107,143,0.12)' },
});

// ── Installed addon row ───────────────────────────────────────────────────────
function InstalledRow({ item, onPress, onToggle, onDelete }) {
  const enabled = item.enabled !== false;
  return (
    <TouchableOpacity style={instStyles.row} onPress={onPress} activeOpacity={0.85}>
      <View style={[instStyles.iconBox, { backgroundColor: enabled ? colors.accentDim : colors.bgRaised }]}>
        <Icon name="extension-puzzle" size={20} color={enabled ? colors.accent : colors.textMuted} />
      </View>
      <View style={instStyles.body}>
        <Text style={[instStyles.name, !enabled && { color: colors.textSecondary }]} numberOfLines={1}>{item.name}</Text>
        <Text style={instStyles.meta} numberOfLines={1}>{item.author || 'Unknown'} · v{item.addon_version || '?'}</Text>
      </View>
      <TouchableOpacity style={[instStyles.toggleBtn, enabled && instStyles.toggleBtnOn]} onPress={onToggle} activeOpacity={0.75}>
        <Icon name={enabled ? 'checkmark-circle' : 'pause-circle-outline'} size={16} color={enabled ? colors.accent : colors.textMuted} />
        <Text style={[instStyles.toggleText, enabled && instStyles.toggleTextOn]}>{enabled ? 'On' : 'Off'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={instStyles.delBtn} onPress={onDelete} activeOpacity={0.7}>
        <Icon name="trash-outline" size={18} color={colors.red} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const instStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2,
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.md, marginBottom: spacing.sm, padding: spacing.md,
  },
  iconBox: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: radius.sm, backgroundColor: colors.bgRaised,
  },
  toggleBtnOn: { backgroundColor: colors.accentDim },
  toggleText: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  toggleTextOn: { color: colors.accent },
  delBtn: {
    width: 38, height: 38, borderRadius: radius.md,
    backgroundColor: 'rgba(255,107,143,0.12)', alignItems: 'center', justifyContent: 'center',
  },
});

// ── Main component ────────────────────────────────────────────────────────────
export default function ModsTab({ serverName, serverType, navigation, refreshKey }) {
  const [mode, setMode]         = useState('search');
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [installedAddons, setInstalledAddons] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const loadInstalled = async () => {
    try {
      const data = await telepathService._get('AddonManager/return_single_list');
      setInstalledAddons(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Failed to load installed addons', e);
    }
  };

  useEffect(() => { loadInstalled(); }, []);
  useEffect(() => { loadInstalled(); }, [refreshKey]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await telepathService._post('AddonManager/search_addons', { query: query.trim() });
      let filtered = Array.isArray(res) ? res : [];
      if (serverType) filtered = filtered.filter(item => item.type?.toLowerCase() === serverType);
      setResults(filtered);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInstallDirect = async (item) => {
    try {
      await telepathService._post('AddonManager/download_addon', { addon: item.id });
      Alert.alert('Success', `${item.name} installed!`);
      loadInstalled();
    } catch (e) {
      Alert.alert('Error', `Install failed: ${e.message}`);
    }
  };

  const handleDeleteDirect = (item) => {
    Alert.alert('Delete', `Permanently delete ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await telepathService.deleteAddon(item);
          loadInstalled();
        } catch (e) {
          Alert.alert('Error', e.message);
        }
      }},
    ]);
  };

  const handleToggle = async (item) => {
    const isEnabled = item.enabled !== false;
    try {
      await telepathService.setAddonState(item, !isEnabled);
      loadInstalled();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handlePickFile = async () => {
    try {
      const pickResult = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (pickResult.canceled) return;
      const file = pickResult.assets[0];
      setLoading(true); setError('');
      const formData = new FormData();
      formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
      const uploadRes = await fetch(`${telepathService.baseUrl}/main/upload_file?is_dir=false`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${telepathService.token}` },
        body: formData,
      });
      if (!uploadRes.ok) throw new Error(await uploadRes.text() || `Upload failed (${uploadRes.status})`);
      const uploadData = await uploadRes.json();
      await telepathService._post('AddonManager/import_addon', { addon_path: uploadData.path });
      await telepathService._get('main/clear_uploads');
      Alert.alert('Success', `Mod ${file.name} imported!`);
      loadInstalled();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const SEGMENTS = [
    { key: 'search',    label: 'Search' },
    { key: 'installed', label: 'Installed' },
    { key: 'import',    label: 'Import' },
  ];

  return (
    <View style={styles.container}>
      <SegmentControl options={SEGMENTS} active={mode} onSelect={setMode} />

      {/* ── SEARCH ── */}
      {mode === 'search' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Mod name…"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading} activeOpacity={0.8}>
              {loading
                ? <ActivityIndicator color={colors.onAccent} size="small" />
                : <Icon name="search" size={20} color={colors.onAccent} />}
            </TouchableOpacity>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isInstalled = installedAddons.some(a => a.id === item.id || a.name?.toLowerCase() === item.name?.toLowerCase());
              return (
                <AddonRow
                  item={item}
                  isInstalled={isInstalled}
                  onPress={() => navigation.navigate('ModDetail', { modItem: item, serverName, serverType, isInstalled })}
                  onInstall={() => handleInstallDirect(item)}
                  onDelete={() => handleDeleteDirect(item)}
                />
              );
            }}
            ListEmptyComponent={
              !loading && (
                <View style={styles.empty}>
                  <View style={styles.emptyIconWrap}><Icon name="search" size={30} color={colors.textMuted} /></View>
                  <Text style={styles.emptyText}>
                    {query ? 'No results' : 'Search for a mod by name'}
                  </Text>
                </View>
              )
            }
          />
        </View>
      )}

      {/* ── INSTALLED ── */}
      {mode === 'installed' && (
        <FlatList
          data={installedAddons}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <InstalledRow
              item={item}
              onPress={() => navigation.navigate('ModDetail', {
                modItem: item, serverName, serverType,
                isInstalled: true, addonEnabled: item.enabled !== false,
              })}
              onToggle={() => handleToggle(item)}
              onDelete={() => handleDeleteDirect(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}><Icon name="cube-outline" size={30} color={colors.textMuted} /></View>
              <Text style={styles.emptyText}>No mods installed</Text>
            </View>
          }
        />
      )}

      {/* ── IMPORT ── */}
      {mode === 'import' && (
        <View style={styles.importCenter}>
          <View style={styles.importBox}>
            <View style={styles.emptyIconWrap}><Icon name="folder-open-outline" size={30} color={colors.accent} /></View>
            <Text style={styles.importTitle}>Import a mod</Text>
            <Text style={styles.importHint}>Select a .jar file from your device</Text>
            <Button label="Choose a file" icon="document-outline" onPress={handlePickFile} loading={loading} disabled={loading} />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  searchRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  searchInput: {
    flex: 1, backgroundColor: colors.bgInput,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    color: colors.textPrimary, fontSize: 15,
  },
  searchBtn: {
    width: 46, height: 46, borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  error: { color: colors.red, textAlign: 'center', padding: spacing.md, fontSize: 13 },

  empty: { alignItems: 'center', padding: spacing.xl * 2, gap: spacing.sm },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.bgCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs,
  },
  emptyText: { color: colors.textSecondary, fontSize: 15 },

  importCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  importBox: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    padding: spacing.xl, gap: spacing.sm,
    alignItems: 'center', width: '100%',
  },
  importTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  importHint:  { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
});
