import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet, Alert
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { telepathService } from '../services/telepath';
import { colors, spacing, radius, fonts } from '../theme';

// ── Segment control ───────────────────────────────────────────────────────────
function SegmentControl({ options, active, onSelect }) {
  return (
    <View style={segStyles.wrap}>
      {options.map((opt, i) => (
        <TouchableOpacity
          key={opt.key}
          style={[segStyles.seg, active === opt.key && segStyles.segActive]}
          onPress={() => onSelect(opt.key)}
        >
          <Text style={[segStyles.text, active === opt.key && segStyles.textActive]}>
            {opt.label.toUpperCase()}
          </Text>
          {active === opt.key && <View style={segStyles.bar} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const segStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  seg: {
    flex: 1, paddingVertical: spacing.sm + 2,
    alignItems: 'center', position: 'relative',
  },
  segActive: {},
  text: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1,
    color: colors.textMuted,
  },
  textActive: { color: colors.accent },
  bar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 2, backgroundColor: colors.accent,
  },
});

// ── Addon row (search results) ────────────────────────────────────────────────
function AddonRow({ item, isInstalled, onPress, onInstall, onDelete }) {
  return (
    <TouchableOpacity style={rowStyles.row} onPress={onPress} activeOpacity={0.8}>
      {/* Left accent */}
      <View style={[rowStyles.stripe, { backgroundColor: isInstalled ? colors.accent : colors.border }]} />
      <View style={rowStyles.body}>
        <View style={rowStyles.top}>
          <Text style={rowStyles.name} numberOfLines={1}>{item.name}</Text>
          {isInstalled && (
            <View style={rowStyles.installedBadge}>
              <Text style={rowStyles.installedText}>INSTALLÉ</Text>
            </View>
          )}
        </View>
        {item.subtitle || item.description ? (
          <Text style={rowStyles.desc} numberOfLines={2}>{item.subtitle || item.description}</Text>
        ) : null}
      </View>
      {isInstalled ? (
        <TouchableOpacity style={rowStyles.delBtn} onPress={onDelete}>
          <Text style={rowStyles.delText}>🗑</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={rowStyles.addBtn} onPress={onInstall}>
          <Text style={rowStyles.addText}>＋</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.border,
    overflow: 'hidden',
  },
  stripe: { width: 3, alignSelf: 'stretch' },
  body: { flex: 1, padding: spacing.md, paddingLeft: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  name: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  installedBadge: {
    borderWidth: 1, borderColor: colors.borderAccent,
    borderRadius: radius.xs, paddingHorizontal: 4, paddingVertical: 1,
  },
  installedText: { fontSize: 8, fontWeight: '800', color: colors.accent, letterSpacing: 0.8 },
  desc: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  addBtn: {
    width: 32, height: 32, margin: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.accentDim,
    borderWidth: 1, borderColor: colors.borderAccent,
    alignItems: 'center', justifyContent: 'center',
  },
  addText: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  delBtn: {
    width: 32, height: 32, margin: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(224,92,92,0.08)',
    borderWidth: 1, borderColor: 'rgba(224,92,92,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  delText: { fontSize: 14 },
});

// ── Installed addon row ───────────────────────────────────────────────────────
function InstalledRow({ item, onPress, onToggle, onDelete }) {
  const enabled = item.enabled !== false;
  return (
    <TouchableOpacity style={instStyles.row} onPress={onPress} activeOpacity={0.8}>
      <View style={[instStyles.stripe, { backgroundColor: enabled ? colors.green : colors.textMuted }]} />
      <View style={instStyles.body}>
        <Text style={instStyles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={instStyles.meta}>{item.author || 'Inconnu'} · v{item.addon_version || '?'}</Text>
      </View>
      <TouchableOpacity style={[instStyles.toggleBtn, enabled && instStyles.toggleBtnOn]} onPress={onToggle}>
        <Text style={[instStyles.toggleText, enabled && instStyles.toggleTextOn]}>
          {enabled ? 'ON' : 'OFF'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={instStyles.delBtn} onPress={onDelete}>
        <Text style={instStyles.delText}>🗑</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const instStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.border,
    overflow: 'hidden',
  },
  stripe: { width: 3, alignSelf: 'stretch' },
  body: { flex: 1, padding: spacing.md, paddingLeft: spacing.sm },
  name: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  meta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  toggleBtn: {
    paddingHorizontal: 10, paddingVertical: 5, marginRight: spacing.sm,
    borderRadius: radius.xs, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.bgInput,
  },
  toggleBtnOn: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.accentDim,
  },
  toggleText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: colors.textMuted },
  toggleTextOn: { color: colors.accent },
  delBtn: {
    width: 36, height: 36, margin: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(224,92,92,0.08)',
    borderWidth: 1, borderColor: 'rgba(224,92,92,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  delText: { fontSize: 14 },
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
      console.warn('Erreur chargement addons installés', e);
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
      Alert.alert('Succès', `${item.name} installé !`);
      loadInstalled();
    } catch (e) {
      Alert.alert('Erreur', `Installation échouée : ${e.message}`);
    }
  };

  const handleDeleteDirect = (item) => {
    Alert.alert('Supprimer', `Supprimer définitivement ${item.name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          await telepathService._post('AddonManager/delete_addon', { addon: item.id });
          loadInstalled();
        } catch (e) {
          Alert.alert('Erreur', e.message);
        }
      }},
    ]);
  };

  const handleToggle = async (item) => {
    const isEnabled = item.enabled !== false;
    try {
      await telepathService._post('AddonManager/addon_state', { addon: item.id, enabled: !isEnabled });
      loadInstalled();
    } catch (e) {
      Alert.alert('Erreur', e.message);
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
      if (!uploadRes.ok) throw new Error(await uploadRes.text() || `Upload échoué (${uploadRes.status})`);
      const uploadData = await uploadRes.json();
      await telepathService._post('AddonManager/import_addon', { addon_path: uploadData.path });
      await telepathService._get('main/clear_uploads');
      Alert.alert('Succès', `Mod ${file.name} importé !`);
      loadInstalled();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const SEGMENTS = [
    { key: 'search',    label: 'Rechercher' },
    { key: 'installed', label: 'Installés' },
    { key: 'import',    label: 'Importer' },
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
              placeholder="Nom du mod…"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
              {loading
                ? <ActivityIndicator color={colors.bg} size="small" />
                : <Text style={styles.searchBtnText}>→</Text>}
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
                  <Text style={styles.emptyIcon}>🔎</Text>
                  <Text style={styles.emptyText}>
                    {query ? 'Aucun résultat' : 'Recherche un mod par nom'}
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
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>Aucun mod installé</Text>
            </View>
          }
        />
      )}

      {/* ── IMPORT ── */}
      {mode === 'import' && (
        <View style={styles.importCenter}>
          <View style={styles.importBox}>
            <Text style={styles.importIcon}>📂</Text>
            <Text style={styles.importTitle}>Importer un mod</Text>
            <Text style={styles.importHint}>Sélectionne un fichier .jar depuis ton appareil</Text>
            <TouchableOpacity style={styles.importBtn} onPress={handlePickFile} disabled={loading}>
              {loading
                ? <ActivityIndicator color={colors.bg} size="small" />
                : <Text style={styles.importBtnText}>Choisir un fichier</Text>}
            </TouchableOpacity>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  searchRow: {
    flexDirection: 'row', gap: spacing.sm,
    padding: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1, backgroundColor: colors.bgInput,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.textPrimary, fontSize: 14,
    fontFamily: fonts.mono,
  },
  searchBtn: {
    width: 44, height: 44, borderRadius: radius.sm,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBtnText: { color: colors.bg, fontSize: 20, fontWeight: '800' },

  error: { color: colors.red, textAlign: 'center', padding: spacing.md, fontSize: 13 },

  empty: { alignItems: 'center', padding: spacing.xl * 2 },
  emptyIcon: { fontSize: 36, marginBottom: spacing.md },
  emptyText: { color: colors.textSecondary, fontSize: 14 },

  importCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  importBox: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center', width: '100%',
  },
  importIcon:  { fontSize: 40, marginBottom: spacing.md },
  importTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  importHint:  { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  importBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  importBtnText: { color: colors.bg, fontWeight: '800', fontSize: 14 },

  statusDot: { width: 6, height: 6, borderRadius: 3 },
});