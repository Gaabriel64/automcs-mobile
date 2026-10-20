import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Text, Icon, Button } from '../components/ui';
import { telepathService } from '../services/telepath';
import { colors, spacing, radius } from '../theme';

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
        console.warn('Could not get the server version', e);
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
        console.warn('Could not fetch the online info', e);
      }
    })();
  }, [modItem]);

  const displayItem = webData || modItem;
  const isSupported = serverVersion && displayItem.versions?.includes(serverVersion);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await telepathService._post('AddonManager/download_addon', { addon: modItem.id });
      Alert.alert('Success', `${modItem.name} was installed!`);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', `Could not install the mod: ${e.message}`);
    } finally {
      setInstalling(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete', `Permanently delete ${modItem.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setInstalling(true);
        try {
          await telepathService.deleteAddon(modItem);
          navigation.goBack();
        } catch (e) {
          Alert.alert('Error', e.message);
        } finally {
          setInstalling(false);
        }
      }},
    ]);
  };

  const handleToggle = async () => {
    setInstalling(true);
    try {
      await telepathService.setAddonState(modItem, !enabledState);
      setEnabledState(!enabledState);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setInstalling(false);
    }
  };

  if (loadingVersion) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Checking compatibility…</Text>
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
            <Text style={styles.author}>by {displayItem.author || 'Unknown'}</Text>
            {isInstalled ? (
              <View style={styles.statePill}>
                <View style={[styles.stateDot, { backgroundColor: enabledState ? colors.green : colors.textMuted }]} />
                <Text style={styles.stateText}>{enabledState ? 'Installed · enabled' : 'Installed · disabled'}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Compatibility banner ── */}
        {displayItem.versions && (
          isSupported ? (
            <View style={[styles.compatBanner, styles.compatOk]}>
              <Icon name="checkmark-circle" size={26} color={colors.green} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.compatTitle, { color: colors.green }]}>Compatible</Text>
                <Text style={styles.compatSub}>Supports Minecraft {serverVersion}</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.compatBanner, styles.compatWarn]}>
              <Icon name="alert-circle" size={26} color={colors.orange} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.compatTitle, { color: colors.orange }]}>Compatibility unknown</Text>
                <Text style={styles.compatSub} numberOfLines={2}>
                  Supported versions: {displayItem.versions.join(', ')}
                </Text>
              </View>
            </View>
          )
        )}

        {/* ── Description ── */}
        {(displayItem.subtitle || displayItem.description) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>
              {displayItem.subtitle || displayItem.description}
            </Text>
          </View>
        )}

        {/* ── Modrinth link ── */}
        {displayItem.url && (
          <TouchableOpacity style={styles.linkBtn} onPress={() => Linking.openURL(displayItem.url)} activeOpacity={0.75}>
            <Icon name="open-outline" size={18} color={colors.accent} />
            <Text style={styles.linkBtnText}>View on Modrinth</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: spacing.xl * 2 }} />
      </ScrollView>

      {/* ── Bottom action area ── */}
      <View style={styles.actions}>
        {isInstalled ? (
          <>
            <Button
              style={styles.actionBtn}
              variant="secondary"
              icon={enabledState ? 'pause' : 'play'}
              label={enabledState ? 'Disable' : 'Enable'}
              onPress={handleToggle}
              loading={installing}
            />
            <Button
              style={styles.actionBtn}
              variant="danger"
              icon="trash-outline"
              label="Delete"
              onPress={handleDelete}
              loading={installing}
            />
          </>
        ) : (
          <Button
            style={styles.actionBtn}
            icon="download-outline"
            label="Install"
            onPress={handleInstall}
            loading={installing}
          />
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
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  modIcon: {
    width: 64, height: 64, borderRadius: radius.lg,
    backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center',
  },
  modIconText: { fontSize: 28, fontWeight: '800', color: colors.accent },
  headerText: { flex: 1, gap: 2 },
  name: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  author: { fontSize: 14, color: colors.textSecondary },
  statePill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  stateDot: { width: 8, height: 8, borderRadius: 4 },
  stateText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },

  // Compatibility
  compatBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1,
  },
  compatOk:   { backgroundColor: 'rgba(56,224,136,0.10)', borderColor: 'rgba(56,224,136,0.35)' },
  compatWarn: { backgroundColor: 'rgba(255,164,92,0.10)', borderColor: 'rgba(255,164,92,0.35)' },
  compatTitle: { fontSize: 15, fontWeight: '800' },
  compatSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  // About
  section: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: colors.accent, marginBottom: spacing.sm, textTransform: 'uppercase' },
  description: { fontSize: 15, color: colors.textPrimary, lineHeight: 22 },

  linkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderAccent, backgroundColor: colors.accentDim,
  },
  linkBtnText: { color: colors.accent, fontSize: 15, fontWeight: '700' },

  // Actions
  actions: {
    flexDirection: 'row', gap: spacing.sm, padding: spacing.md,
    backgroundColor: colors.bgCard, borderTopWidth: 1, borderTopColor: colors.border,
  },
  actionBtn: { flex: 1 },
});
