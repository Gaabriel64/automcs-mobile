import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Linking, Alert, ActivityIndicator
} from 'react-native';
import { telepathService } from '../services/telepath';
import { colors, spacing, radius } from '../theme';

export default function ModDetailScreen({ route, navigation }) {
  const { modItem, serverName, serverType, isInstalled, addonEnabled } = route.params;
  const [installing, setInstalling] = useState(false);
  const [webData, setWebData] = useState(null);
  const [enabledState, setEnabledState] = useState(addonEnabled ?? false);
  const [serverVersion, setServerVersion] = useState(null); // ex: "1.21.1"
  const [loadingVersion, setLoadingVersion] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Récupère la version du serveur depuis l’API (le serveur a déjà été ouvert)
        const version = await telepathService._post('ServerObject/_sync_attr', { name: 'version' });
        setServerVersion(version?.trim());
      } catch (e) {
        console.warn('Impossible de récupérer la version du serveur', e);
      } finally {
        setLoadingVersion(false);
      }
    })();
  }, [serverName]);

  useEffect(() => {
    (async () => {
      // Ne rien faire si on a déjà une URL (objet web) ou si pas d'id
      if (modItem.url || !modItem.id) return;
      try {
        const online = await telepathService._post('AddonManager/get_addon', {
          addon_name: modItem.id, // ou modItem.name
          online: true,
        });
        if (online && online.url) {
          setWebData(online);
        }
      } catch (e) {
        console.warn('Impossible de récupérer les infos en ligne', e);
      }
    })();
  }, [modItem]);

  const displayItem = webData || modItem;
  // Vérifie si la version du serveur est dans les versions supportées
  const isSupported = serverVersion && displayItem.versions && displayItem.versions.includes(serverVersion);

  const openModrinth = () => {
    if (displayItem.url) {
      Linking.openURL(displayItem.url);
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const result = await telepathService._post('AddonManager/download_addon', { addon: modItem.id });
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
            Alert.alert('Succès', `${modItem.name} supprimé.`);
            navigation.goBack();
        } catch (e) {
            Alert.alert('Erreur', `Suppression échouée : ${e.message}`);
        } finally {
            setInstalling(false);
        }
      }}
    ]);
  };

  const handleToggleState = async () => {
    setInstalling(true);
    try {
        await telepathService._post('AddonManager/addon_state', { addon: modItem.id, enabled: !enabledState });
        setEnabledState(!enabledState);
        Alert.alert('Succès', `${modItem.name} est maintenant ${!enabledState ? 'activé' : 'désactivé'}.`);
    } catch (e) {
        Alert.alert('Erreur', `Impossible de changer l'état : ${e.message}`);
    } finally {
        setInstalling(false);
    }
  };

  if (loadingVersion) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>Vérification de la compatibilité…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{displayItem.name}</Text>
        <Text style={styles.author}>par {displayItem.author || 'Inconnu'}</Text>
      </View>

      {/* Bandeau de compatibilité */}
      {isSupported ? (
        <View style={styles.compatBannerSupported}>
          <Text style={styles.compatTextSupported}>✅ Supporté !</Text>
        </View>
      ) : (
        <View style={styles.compatBannerUnsupported}>
          <Text style={styles.compatTextUnsupported}>⚠️ Non supporté :</Text>
          {displayItem.versions && (
            <Text style={styles.versionsList}>
              {displayItem.versions.join(', ')}
            </Text>
          )}
        </View>
      )}

      <Text style={styles.description}>
        {displayItem.subtitle || displayItem.description || 'Aucune description'}
      </Text>

      <TouchableOpacity style={styles.linkBtn} onPress={openModrinth}>
        <Text style={styles.linkBtnText}>↗ Voir sur Modrinth</Text>
      </TouchableOpacity>

      {isInstalled && (
        <TouchableOpacity
            style={[styles.toggleBtnDetail, installing && styles.installBtnDisabled]}
            onPress={handleToggleState}
            disabled={installing}
        >
            <Text style={styles.toggleBtnDetailText}>
                {enabledState ? 'Désactiver' : 'Activer'}
            </Text>
        </TouchableOpacity>
      )}

      {isInstalled ? (
        <TouchableOpacity
            style={[styles.deleteBtn, installing && styles.deleteBtnDisabled]}
            onPress={handleDelete}
            disabled={installing}
        >
            {installing ? (
            <ActivityIndicator color="#fff" />
            ) : (
            <Text style={styles.deleteBtnText}>🗑️ Supprimer</Text>
            )}
        </TouchableOpacity>
        ) : (
        <TouchableOpacity
            style={[styles.installBtn, installing && styles.installBtnDisabled]}
            onPress={handleInstall}
            disabled={installing}
        >
            {installing ? (
            <ActivityIndicator color="#fff" />
            ) : (
            <Text style={styles.installBtnText}>📦 Installer</Text>
            )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  header: {
    marginBottom: spacing.md,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  author: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  compatBannerSupported: {
    backgroundColor: 'rgba(76,175,135,0.15)',
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  compatTextSupported: {
    color: colors.green,
    fontWeight: '700',
    fontSize: 14,
  },
  compatBannerUnsupported: {
    backgroundColor: 'rgba(255,152,0,0.1)',
    borderWidth: 1,
    borderColor: colors.orange, // Assure‑toi d’avoir cette couleur dans theme.js, sinon remplace par '#ff9800'
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  compatTextUnsupported: {
    color: '#ff9800',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
  },
  versionsList: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  linkBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgInput,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  linkBtnText: {
    color: colors.accentLight,
    fontWeight: '600',
  },
  installBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: spacing.xl,
  },
  installBtnDisabled: {
    opacity: 0.4,
  },
  installBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteBtn: {
  backgroundColor: 'rgba(224,92,92,0.15)',
  borderRadius: radius.sm,
  paddingVertical: spacing.md,
  alignItems: 'center',
  marginTop: 'auto',
  marginBottom: spacing.xl,
  borderWidth: 1,
  borderColor: colors.red,
  },
  deleteBtnDisabled: {
  opacity: 0.4,
  },
  deleteBtnText: {
  color: colors.red,
  fontSize: 16,
  fontWeight: '700',
  },
  toggleBtnDetail: {
  backgroundColor: colors.bgInput,
  borderRadius: radius.sm,
  paddingVertical: spacing.sm,
  alignItems: 'center',
  marginBottom: spacing.md,
  borderWidth: 1,
  borderColor: colors.border,
  },
  toggleBtnDetailText: {
  color: colors.accentLight,
  fontWeight: '600',
  },
});