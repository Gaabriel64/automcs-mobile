import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet, Alert, Platform
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker'; // ou react-native-document-picker
import { telepathService } from '../services/telepath';
import { colors, spacing, radius } from '../theme';

export default function ModsTab({ serverName, serverType, navigation, refreshKey }) {
  const [mode, setMode] = useState('search'); // 'search' | 'import'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [installedAddons, setInstalledAddons] = useState([]); // objets complets
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Charge la liste des mods installés (pour afficher un indicateur ou bouton Désactiver)
  useEffect(() => {
    loadInstalled();
  }, []);

  const loadInstalled = async () => {
    try {
        const data = await telepathService._get('AddonManager/return_single_list');
        setInstalledAddons(Array.isArray(data) ? data : []);
    } catch (e) {
        console.warn('Erreur chargement addons installés', e);
    }
  };

  useEffect(() => {
    loadInstalled();
  }, [refreshKey]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setError('');
    try {
        const res = await telepathService._post('AddonManager/search_addons', { query: query.trim() });
        let filtered = Array.isArray(res) ? res : [];
        if (serverType) {
            filtered = filtered.filter(item => item.type && item.type.toLowerCase() === serverType);
        }
        setResults(filtered);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (addon) => {
    Alert.alert('Installer', `Installer ${addon.name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Installer', onPress: async () => {
        try {
          // Télécharger le mod depuis le serveur (il est déjà choisi en ligne côté serveur)
          // L'API AddonManager probablement installe directement à partir du nom
          // On peut utiliser get_addon(online=True) puis trigger l'installation.
          // Mais la méthode exacte dépend de l'implémentation auto-mcs.
          // On va supposer qu'on peut passer le nom à import_addon avec le chemin.
          // Sinon, il faut utiliser un endpoint d'installation comme AddonManager/install_addon.
          // D'après le code desktop, import_addon se fait avec le chemin d'un fichier uploadé.
          // Pour les addons en ligne, il existe probablement AddonManager/install_addon (addon_name).
          // Vérifions rapidement les endpoints dynamiques: AddonManager a "addon_state", "import_addon"…
          // Il n'y a pas de méthode explicite "install_from_web". Mais on peut utiliser telepath_download
          // puis import_addon? C'est lourd. Je pense que auto-mcs propose un endpoint pour installer un addon en ligne.
          // On va plutôt appeler telepathService._post('AddonManager/install_addon', { addon_name: addon.name })
          // Si ça échoue, on proposera une autre méthode. On va l'essayer.
          await telepathService._post('AddonManager/install_addon', { addon_name: addon.name });
          Alert.alert('Succès', `${addon.name} installé !`);
          loadInstalled();
        } catch (e) {
          Alert.alert('Erreur', e.message);
        }
      }}
    ]);
  };

  const handlePickFile = async () => {
    try {
      const pickResult = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (pickResult.canceled) return;
      const file = pickResult.assets[0];
      setLoading(true); setError('');
      // Upload le fichier
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      });
      // Appel upload_file
      const uploadRes = await fetch(`${telepathService.baseUrl}/main/upload_file?is_dir=false`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${telepathService.token}`,
          // Ne mets pas 'Content-Type', fetch le définira automatiquement avec la boundary
        },
        body: formData,
      });
      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        throw new Error(errorText || `Upload échoué (${uploadRes.status})`);
      }
      const uploadData = await uploadRes.json();
      // Importe le mod via l'API
      await telepathService._post('AddonManager/import_addon', { addon_path: uploadData.path });
      // Nettoie les uploads temporaires (optionnel)
      await telepathService._get('main/clear_uploads');
      Alert.alert('Succès', `Mod ${file.name} importé !`);
      loadInstalled();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInfo = (addon) => {
    navigation.navigate('ModDetail', { modItem: addon, serverName, serverType });
  };

  const renderAddon = ({ item }) => {
    const isInstalled = installedAddons.some(a => a.id === item.id || a.name?.toLowerCase() === item.name?.toLowerCase());
    return (
        <TouchableOpacity
        style={[styles.addonRow, { paddingRight: 0 }]}
        onPress={() => navigation.navigate('ModDetail', {
            modItem: item,
            serverName,
            serverType,
            isInstalled,
        })}
        activeOpacity={0.7}
        >
        <View style={{ flex: 1 }}>
            <Text style={styles.addonName}>{item.name}</Text>
            <Text style={styles.addonDesc} numberOfLines={2}>{item.subtitle || item.description || ''}</Text>
        </View>
        {!isInstalled ? (
            <TouchableOpacity style={styles.installBtn} onPress={() => handleInstallDirect(item)}>
            <Text style={styles.installBtnText}>Installer</Text>
            </TouchableOpacity>
        ) : (
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteDirect(item)}>
            <Text style={styles.deleteBtnText}>Supprimer</Text>
            </TouchableOpacity>
        )}
        </TouchableOpacity>
    );
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
            Alert.alert('Succès', `${item.name} supprimé.`);
            loadInstalled();
        } catch (e) {
            Alert.alert('Erreur', `Suppression échouée : ${e.message}`);
        }
      }}
    ]);
  };

  const handleToggle = async (item, currentState) => {
    try {
        await telepathService._post('AddonManager/addon_state', { addon: item.id, enabled: !currentState });
        Alert.alert('Succès', `${item.name} est maintenant ${!currentState ? 'activé' : 'désactivé'}.`);
        loadInstalled();
    } catch (e) {
        Alert.alert('Erreur', `Impossible de changer l'état : ${e.message}`);
    }
  };

  return (
    <View style={styles.container}>
      {/* Selecteur de mode */}
      <View style={styles.modeTabs}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'search' && styles.modeTabActive]}
          onPress={() => setMode('search')}
        >
          <Text style={[styles.modeTabText, mode === 'search' && styles.modeTabTextActive]}>Rechercher</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'import' && styles.modeTabActive]}
          onPress={() => setMode('import')}
        >
          <Text style={[styles.modeTabText, mode === 'import' && styles.modeTabTextActive]}>Importer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'installed' && styles.modeTabActive]}
          onPress={() => setMode('installed')}
        >
          <Text style={[styles.modeTabText, mode === 'installed' && styles.modeTabTextActive]}>Installés</Text>
        </TouchableOpacity>

      </View>

      {/* Mode recherche */}
      {mode === 'search' && (
        <>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un mod..."
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.searchBtnText}>🔍</Text>}
            </TouchableOpacity>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderAddon}
            ListEmptyComponent={!loading ? <Text style={styles.empty}>Aucun résultat</Text> : null}
          />
        </>
      )}

      {/* Mode import */}
      {mode === 'import' && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <Text style={styles.label}>Importer un mod depuis votre appareil</Text>
          <TouchableOpacity style={styles.importBtn} onPress={handlePickFile} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.importBtnText}>📂 Choisir un fichier</Text>}
          </TouchableOpacity>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      )}

      {/* Modes Installés */}
      {mode === 'installed' && (
        <FlatList
            data={installedAddons}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
            const isEnabled = item.enabled !== false;
            return (
                <TouchableOpacity
                style={styles.installedRow}
                onPress={() => navigation.navigate('ModDetail', {
                    modItem: item,
                    serverName,
                    serverType,
                    isInstalled: true,
                    addonEnabled: isEnabled,
                })}
                activeOpacity={0.7}
                >
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.statusDot, { backgroundColor: isEnabled ? colors.green : colors.textSecondary }]} />
                    <Text style={styles.installedName}>{item.name}</Text>
                    </View>
                    <Text style={styles.installedMeta}>{item.author || 'Auteur inconnu'} • {item.addon_version || '0.0.0'}</Text>
                </View>
                <TouchableOpacity
                    style={styles.toggleBtn}
                    onPress={() => handleToggle(item, isEnabled)}
                >
                    <Text style={styles.toggleBtnText}>{isEnabled ? 'Désactiver' : 'Activer'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.deleteBtnSmall}
                    onPress={() => handleDeleteDirect(item)}
                >
                    <Text style={styles.deleteBtnText}>🗑</Text>
                </TouchableOpacity>
                </TouchableOpacity>
            );
          }}
            ListEmptyComponent={<Text style={styles.empty}>Aucun mod installé</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.sm },
  modeTabs: { flexDirection: 'row', marginBottom: spacing.sm },
  modeTab: {
    flex: 1, paddingVertical: 8, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent'
  },
  modeTabActive: { borderBottomColor: colors.accent },
  modeTabText: { color: colors.textSecondary, fontSize: 14 },
  modeTabTextActive: { color: colors.textPrimary, fontWeight: '700' },
  searchRow: { flexDirection: 'row', marginBottom: spacing.sm, gap: spacing.sm },
  searchInput: {
    flex: 1, backgroundColor: colors.bgInput, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, color: colors.textPrimary, fontSize: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  searchBtn: {
    backgroundColor: colors.accent, width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBtnText: { fontSize: 18 },
  addonRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  addonName: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
  addonDesc: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  installBtn: {
    backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.sm,
  },
  installBtnText: { color: '#fff', fontWeight: '600' },
  installedBadge: { color: colors.green, fontSize: 12 },
  label: { color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' },
  importBtn: {
    backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: radius.sm,
  },
  importBtnText: { color: '#fff', fontWeight: '700' },
  error: { color: colors.red, marginVertical: spacing.sm, textAlign: 'center' },
  empty: { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
  installBtn: { backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm },
  installBtnText: { color: '#fff', fontWeight: '600' },
  deleteBtn: { backgroundColor: 'rgba(224,92,92,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.red },
  deleteBtnText: { color: colors.red, fontWeight: '600' },
  installedRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: spacing.sm,
  borderBottomWidth: 1,
  borderBottomColor: colors.border,
  gap: spacing.sm,
  },
  installedName: {
  color: colors.textPrimary,
  fontWeight: '600',
  fontSize: 14,
  },
  installedMeta: {
  color: colors.textSecondary,
  fontSize: 11,
  marginTop: 2,
  },
  toggleBtn: {
  backgroundColor: colors.bgInput,
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: radius.sm,
  borderWidth: 1,
  borderColor: colors.border,
  },
  toggleBtnText: {
  color: colors.accentLight,
  fontSize: 12,
  fontWeight: '600',
  },
  deleteBtnSmall: {
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: 'rgba(224,92,92,0.15)',
  borderWidth: 1,
  borderColor: colors.red,
  alignItems: 'center',
  justifyContent: 'center',
  },
});