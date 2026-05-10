import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Linking, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { telepathService } from '../services/telepath';
import { colors, spacing, radius, fonts } from '../theme';

export default function ModDetailScreen({ route, navigation }) {
  const { modItem, serverName, serverType, isInstalled, addonEnabled } = route.params;
  const [installing, setInstalling]   = useState(false);
  const [webData, setWebData]         = useState(null);
  const [enabledState, setEnabledState] = useState(addonEnabled ?? false);
  const [serverVersion, setServerVersion] = useState(null);
  const [loadingVersion, setLoadingVersion] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const version = await telepathService._post('ServerObject/_sync_attr', { name: 'version' });
        setServerVersion(version?.trim());
      } catch (e) {
        console.warn('Impossible de récupérer la version', e);
      } finally {
        setLoadingVersion(false);
      }
    })();
  }, [serverName]);

  useEffect(() => {
    (async () => {
      if (modItem.url || !modItem.id) return;
      try {
        const online = await telepathService._post('AddonManager/get_addon', {
          addon_name: modItem.id, online: true,
        });
        if (online?.url) setWebData(online);
      } catch (e) {
        console.warn('Impossible de récupérer les infos en ligne', e);
      }
    })();
  }, [modItem]);

  const displayItem = webData || modItem;
  const isSupported = serverVersion && displayItem.versions?.includes(serverVersion);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await telepathService._post('AddonManager/download_addon', { addon: modItem.id });
      Alert.alert('Succès', `${modItem.name} a bien été installé !`);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Erreur', `Impossible d'installer le mod : ${e.message}`);
    } finally {
      setInstalling(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Supprimer', `Supprimer définitivement ${modItem.name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        setInstalling(true);
        try {
          await telepathService._post('AddonManager/delete_addon', { addon: modItem.id });
          navigation.goBack();
        } catch (e) {
          Alert.alert('Erreur', e.message);
        } finally {
          setInstalling(false);
        }
      }},
    ]);
  };

  const handleToggle = async () => {
    setInstalling(true);
    try {
      await telepathService._post('AddonManager/addon_state', { addon: modItem.id, enabled: !enabledState });
      setEnabledState(!enabledState);
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setInstalling(false);
    }
  };

  if (loadingVersion) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Vérification de compatibilité…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.modIcon}>
            <Text style={styles.modIconText}>{displayItem.name?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name}>{displayItem.name}</Text>
            <Text style={styles.author}>par {displayItem.author || 'Inconnu'}</Text>
          </View>
        </View>

        {/* ── Compatibility banner ── */}
        {displayItem.versions && (
          isSupported ? (
            <View style={[styles.compatBanner, styles.compatOk]}>
              <Text style={styles.compatIcon}>✓</Text>
              <View>
                <Text style={[styles.compatTitle, { color: colors.green }]}>COMPATIBLE</Text>
                <Text style={styles.compatSub}>Supporte Minecraft {serverVersion}</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.compatBanner, styles.compatWarn]}>
              <Text style={styles.compatIcon}>!</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.compatTitle, { color: colors.orange }]}>COMPATIBILITÉ INCONNUE</Text>
                <Text style={styles.compatSub} numberOfLines={2}>
                  Versions supportées : {displayItem.versions.join(', ')}
                </Text>
              </View>
            </View>
          )
        )}

        {/* ── Description ── */}
        {(displayItem.subtitle || displayItem.description) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>À PROPOS</Text>
            <Text style={styles.description}>
              {displayItem.subtitle || displayItem.description}
            </Text>
          </View>
        )}

        {/* ── Modrinth link ── */}
        {displayItem.url && (
          <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL(displayItem.url)}>
            <Text style={styles.linkBtnText}>↗ Voir sur Modrinth</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: spacing.xl * 2 }} />
      </ScrollView>

      {/* ── Bottom action area ── */}
      <View style={styles.actions}>
        {isInstalled && (
          <TouchableOpacity
            style={[styles.toggleBtn, enabledState ? styles.toggleBtnOn : styles.toggleBtnOff, installing && styles.actionDisabled]}
            onPress={handleToggle}
            disabled={installing}
          >
            {installing
              ? <ActivityIndicator color={colors.accent} size="small" />
              : <Text style={styles.toggleBtnText}>{enabledState ? '⏸ Désactiver' : '▶ Activer'}</Text>}
          </TouchableOpacity>
        )}

        {isInstalled ? (
          <TouchableOpacity
            style={[styles.deleteBtn, installing && styles.actionDisabled]}
            onPress={handleDelete}
            disabled={installing}
          >
            {installing
              ? <ActivityIndicator color={colors.red} size="small" />
              : <Text style={styles.deleteBtnText}>🗑  Supprimer</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.installBtn, installing && styles.actionDisabled]}
            onPress={handleInstall}
            disabled={installing}
          >
            {installing
              ? <ActivityIndicator color={colors.bg} size="small" />
              : <Text style={styles.installBtnText}>📦  Installer</Text>}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: spacing.md },
  loadingText: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.sm },
  scroll: { padding: spacing.lg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginBottom: spacing.lg,
  },
  modIcon: {
    width: 56, height: 56, borderRadius: radius.md,
    backgroundColor: colors.accentDim,
    borderWidth: 1, borderColor: colors.borderAccent,
    alignItems: 'center', justifyContent: 'center',
  },
  modIconText: { fontSize: 26, fontWeight: '800', color: colors.accent },
  headerText: { flex: 1 },
  name: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 2 },
  author: { fontSize: 12, color: colors.textSecondary },

  // Compat banner
  compatBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderWidth: 1, borderRadius: radius.sm,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  compatOk: {
    backgroundColor: 'rgba(76,175,135,0.08)',
    borderColor: 'rgba(76,175,135,0.35)',
  },
  compatWarn: {
    backgroundColor: 'rgba(255,152,0,0.08)',
    borderColor: 'rgba(255,152,0,0.35)',
  },
  compatIcon: {
    width: 28, height: 28, borderRadius: 14,
    textAlign: 'center', lineHeight: 28,
    fontWeight: '800', fontSize: 14,
    color: colors.bg,
    backgroundColor: colors.green,
    overflow: 'hidden',
  },
  compatTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  compatSub:   { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  // Section
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.5,
    color: colors.textSecondary, textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: 14, color: colors.textSecondary, lineHeight: 22,
  },

  // Link
  linkBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
  },
  linkBtnText: { color: colors.accentLight, fontWeight: '600', fontSize: 13 },

  // Actions
  actions: {
    padding: spacing.md, gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  toggleBtn: {
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm, alignItems: 'center',
    borderWidth: 1,
  },
  toggleBtnOn: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.accentDim,
  },
  toggleBtnOff: {
    borderColor: colors.border,
    backgroundColor: colors.bgInput,
  },
  toggleBtnText: { color: colors.accent, fontWeight: '700', fontSize: 14 },

  installBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm, paddingVertical: spacing.md,
    alignItems: 'center',
  },
  installBtnText: { color: colors.bg, fontSize: 15, fontWeight: '800' },

  deleteBtn: {
    borderWidth: 1, borderColor: 'rgba(224,92,92,0.4)',
    backgroundColor: 'rgba(224,92,92,0.08)',
    borderRadius: radius.sm, paddingVertical: spacing.md,
    alignItems: 'center',
  },
  deleteBtnText: { color: colors.red, fontSize: 15, fontWeight: '700' },

  actionDisabled: { opacity: 0.4 },
});