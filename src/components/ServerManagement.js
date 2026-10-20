// Server management: autostart, playit.gg, Geyser (Bedrock), rename, delete.
// Mirrors what the auto-mcs desktop "Settings" page does, by calling the same
// ServerObject / AddonManager methods through Telepath.
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Text, TextInput, Button as UIButton, SectionTitle } from './ui';
import { telepathService } from '../services/telepath';
import { fetchFreshConfig } from '../utils/config';
import { colors, spacing, radius } from '../theme';

// URL opened by the desktop to get the code (playit.manager.setup_url)
const PLAYIT_SETUP_URL =
  'https://playit.gg/account/setup/wizard/new-account/third-party/third-party-code?partner=auto-mcs';

// Types for which auto-mcs offers Geyser (AddonManager.check_geyser / reload_config)
const GEYSER_TYPES = ['spigot', 'paper', 'purpur', 'fabric', 'quilt', 'neoforge'];
const INVALID_NAME = /[\\/:*?"<>|]/;

const isTrue = v => v === true || String(v).toLowerCase() === 'true';

// Compares two versions like "1.20.4": true if a >= b
function versionAtLeast(a, b) {
  const pa = String(a || '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return true;
}

const notSupported = e => /404|not found/i.test(String(e?.message || ''));

function ToggleRow({ label, hint, value, onChange, disabled, loading }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: spacing.sm }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <Switch
          disabled={disabled}
          trackColor={{ false: colors.bgInput, true: colors.accentDim }}
          thumbColor={value ? colors.accent : colors.textMuted}
          ios_backgroundColor={colors.bgInput}
          value={!!value}
          onValueChange={onChange}
        />
      )}
    </View>
  );
}

// Adapter over the shared button: `danger` = outlined red, `primary` = brand green
function Button({ label, onPress, disabled, danger, primary, loading, icon }) {
  return (
    <UIButton
      label={label}
      icon={icon}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      variant={danger ? 'danger' : primary ? 'primary' : 'secondary'}
      style={{ marginTop: spacing.sm }}
    />
  );
}

export default function ServerManagement({ serverName, cfg, onCfgChanged, navigation }) {
  const [running, setRunning]       = useState(null);
  const [type, setType]             = useState('');
  const [version, setVersion]       = useState('');
  const [proxyLinked, setProxyLinked] = useState(null);
  // Real state of the switches, read from the server (null = unknown / not supported)
  const [flags, setFlags]           = useState({ proxy: null, geyser: null, autostart: null });
  const [busy, setBusy]             = useState('');
  const [code, setCode]             = useState('');
  const [newName, setNewName]       = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const g = cfg?.general || {};
  // Source of truth: server attributes (proxy_enabled, geyser_enabled, autostart), the ones
  // it uses at launch. Falls back to the .ini, whose keys keep their exact case.
  const proxyOn     = flags.proxy     ?? isTrue(g.enableProxy);
  const geyserOn    = flags.geyser    ?? isTrue(g.enableGeyser);
  const autostartOn = flags.autostart ?? isTrue(g.autostart);
  const geyserSupported =
    GEYSER_TYPES.includes(String(type).toLowerCase()) && versionAtLeast(version, '1.13.2');

  // Bind our device to this server before any action (like the desktop app does)
  const ensureOpen = useCallback(() => telepathService.openServer(serverName), [serverName]);

  // Re-reads the attribute of each switch; keeps the old value if the read fails
  // (e.g. `autostart` does not exist before auto-mcs 1.3).
  const readFlags = useCallback(async () => {
    const [p, ge, a] = await Promise.allSettled([
      telepathService.getServerAttr('proxy_enabled'),
      telepathService.getServerAttr('geyser_enabled'),
      telepathService.getServerAttr('autostart'),
    ]);
    setFlags(prev => ({
      proxy:     p.status  === 'fulfilled' ? isTrue(p.value)  : prev.proxy,
      geyser:    ge.status === 'fulfilled' ? isTrue(ge.value) : prev.geyser,
      autostart: a.status  === 'fulfilled' ? isTrue(a.value)  : prev.autostart,
    }));
  }, []);

  const refreshState = useCallback(async () => {
    try { await ensureOpen(); } catch {}
    readFlags();
    const [r, t, v, p] = await Promise.allSettled([
      telepathService.getServerAttr('running'),
      telepathService.getServerAttr('type'),
      telepathService.getServerAttr('version'),
      telepathService.proxyInstalled(),
    ]);
    if (r.status === 'fulfilled') setRunning(!!r.value);
    if (t.status === 'fulfilled') setType(String(t.value || ''));
    if (v.status === 'fulfilled') setVersion(String(v.value || ''));
    setProxyLinked(p.status === 'fulfilled' ? !!p.value : 'error');
  }, [ensureOpen, readFlags]);

  useEffect(() => { refreshState(); }, [refreshState]);

  // Runs an action while blocking the others, with a readable error message
  const run = useCallback(async (key, fn, errorTitle = 'Error') => {
    if (busy) return false;
    setBusy(key);
    try {
      await ensureOpen();
      await fn();
      return true;
    } catch (e) {
      if (notSupported(e)) {
        Alert.alert('Not supported', 'This version of auto-mcs does not offer this feature.');
      } else {
        Alert.alert(errorTitle, e.message);
      }
      return false;
    } finally {
      setBusy('');
    }
  }, [busy, ensureOpen]);

  // Writes a [general] value starting from the FRESH server config,
  // so a setting changed in the meantime is never overwritten.
  const setConfigValue = async (key, value) => {
    const [cf, sp] = await Promise.all([
      fetchFreshConfig(telepathService),
      telepathService.getServerAttr('server_properties'),
    ]);
    const next = { ...cf, general: { ...(cf?.general || {}), [key]: String(value) } };
    await telepathService._post('ServerObject/write_config', {
      remote_data: { config_file: next, server_properties: sp },
    });
  };

  const requireStopped = (what) => {
    if (running) {
      Alert.alert('Server running', `Stop the server before you ${what}.`);
      return false;
    }
    return true;
  };

  // ── Autostart ──
  const toggleAutostart = v => run('autostart', async () => {
    await telepathService.setAutostart(v);
    setFlags(f => ({ ...f, autostart: v }));
    await readFlags();
    await onCfgChanged?.();
  });

  // ── playit.gg ──
  const toggleProxy = v => run('proxy', async () => {
    await telepathService.setProxy(v);
    setFlags(f => ({ ...f, proxy: v }));
    await readFlags();
    await onCfgChanged?.();
    if (running) Alert.alert('Restart required', 'Restart the server to apply this change.');
  });

  const linkPlayit = async () => {
    const c = code.trim();
    if (!c) { Alert.alert('Missing code', 'Paste the code shown on playit.gg.'); return; }
    const ok = await run('link', async () => {
      const linked = await telepathService.linkPlayit(c);
      if (!linked) throw new Error('Linking failed: invalid code, or the server has no Internet access.');
      await telepathService.setProxy(true);
      setFlags(f => ({ ...f, proxy: true }));
      await readFlags();
      await onCfgChanged?.();
    }, 'playit.gg');
    if (ok) { setCode(''); setProxyLinked(true); Alert.alert('playit.gg', 'Account linked, proxy enabled for this server.'); }
  };

  const openPlayitPanel = () => run('panel', async () => {
    const url = await telepathService.getPlayitUrl();
    if (!url) throw new Error('The playit panel is not available yet.');
    await Linking.openURL(String(url));
  }, 'playit.gg');

  const unlinkPlayit = () => {
    Alert.alert(
      'Unlink playit.gg?',
      'The account is linked to the machine hosting auto-mcs: all of its servers will lose their playit address.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink', style: 'destructive',
          onPress: async () => {
            const ok = await run('unlink', async () => {
              const done = await telepathService.unlinkPlayit();
              if (!done) throw new Error('Could not unlink the account.');
              await readFlags();
              await onCfgChanged?.();
            }, 'playit.gg');
            if (ok) setProxyLinked(false);
          },
        },
      ],
    );
  };

  // ── Geyser (Bedrock) ──
  const toggleGeyser = v => {
    if (!requireStopped('change Geyser')) return;
    Alert.alert(
      v ? 'Enable Bedrock support?' : 'Disable Bedrock support?',
      v
        ? 'Geyser, Floodgate and ViaVersion will be downloaded to the server. This can take a few minutes.'
        : 'Geyser, Floodgate and ViaVersion will be removed from the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => run('geyser', async () => {
            await telepathService.installGeyser(v);
            await setConfigValue('enableGeyser', v);
            await telepathService.reloadConfig();   // recomputes geyser_enabled on the server
            setFlags(f => ({ ...f, geyser: v }));
            await readFlags();
            await onCfgChanged?.();
          }, 'Geyser'),
        },
      ],
    );
  };

  // ── Rename ──
  const renameServer = async () => {
    const name = newName.trim();
    if (!requireStopped('rename the server')) return;
    if (!name || name === serverName) return;
    if (INVALID_NAME.test(name) || /[. ]$/.test(name)) {
      Alert.alert('Invalid name', 'Avoid the characters \\ / : * ? " < > | and a trailing dot or space.');
      return;
    }
    const ok = await run('rename', async () => {
      const list = await telepathService.getServerList();
      const taken = (Array.isArray(list) ? list : []).some(s => String(s?.name || '').toLowerCase() === name.toLowerCase());
      if (taken) throw new Error('A server with this name already exists.');
      await telepathService.renameServer(name);
    }, 'Rename');
    if (ok) {
      Alert.alert('Server renamed', `"${serverName}" is now called "${name}".`);
      navigation.popToTop();
    }
  };

  // ── Delete ──
  const deleteServer = async () => {
    if (!requireStopped('delete the server')) return;
    if (confirmName !== serverName) return;
    const ok = await run('delete', async () => {
      const done = await telepathService.deleteServer();
      if (done === false) throw new Error('Deletion failed (is the server still running?).');
    }, 'Delete');
    if (ok) {
      Alert.alert('Server deleted', `"${serverName}" was deleted.`);
      navigation.popToTop();
    }
  };

  const loadingState = running === null;

  return (
    <View>
      <SectionTitle title="Startup" icon="power-outline" />
      <View style={styles.groupCard}>
      <ToggleRow
        label="Start with auto-mcs"
        hint="Starts this server automatically when auto-mcs starts (auto-mcs 1.3+)"
        value={autostartOn}
        onChange={toggleAutostart}
        loading={busy === 'autostart'}
        disabled={!!busy}
      />
      </View>

      <SectionTitle title="playit.gg" icon="globe-outline" />
      {proxyLinked === null ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.md }} />
      ) : proxyLinked === 'error' ? (
        <View style={styles.card}>
          <Text style={styles.cardText}>
            Could not check playit.gg on this server (no response). Try again in a moment.
          </Text>
          <Button icon="refresh" label="Retry" onPress={() => { setProxyLinked(null); refreshState(); }} />
        </View>
      ) : proxyLinked ? (
        <View style={styles.groupCard}>
          <ToggleRow
            label="Enable playit proxy"
            hint="Gives this server a public address, without opening a port"
            value={proxyOn}
            onChange={toggleProxy}
            loading={busy === 'proxy'}
            disabled={!!busy}
          />
          <Button icon="open-outline" label="Open the playit panel" onPress={openPlayitPanel} loading={busy === 'panel'} disabled={!!busy} />
          <Button icon="unlink" label="Unlink the playit account" onPress={unlinkPlayit} loading={busy === 'unlink'} disabled={!!busy} danger />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardText}>
            playit.gg is not set up yet. 1) Open the site and create or sign in to your account,
            2) copy the code shown, 3) paste it here, then authorize.
          </Text>
          <Button icon="open-outline" label="1 · Open playit.gg" onPress={() => Linking.openURL(PLAYIT_SETUP_URL)} disabled={!!busy} />
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="Paste the code here…"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button primary icon="checkmark" label="3 · Authorize" onPress={linkPlayit} loading={busy === 'link'} disabled={!!busy || !code.trim()} />
          <Text style={styles.hint}>Installing the playit agent on the server can take a minute.</Text>
        </View>
      )}

      <SectionTitle title="Bedrock (Geyser)" icon="phone-portrait-outline" />
      <View style={styles.groupCard}>
      <ToggleRow
        label="Bedrock support"
        hint={
          loadingState ? 'Loading…'
          : geyserSupported ? 'Installs Geyser, Floodgate and ViaVersion. Server must be stopped.'
          : `Unavailable for ${type || 'this type'} ${version}`.trim()
        }
        value={geyserOn}
        onChange={toggleGeyser}
        loading={busy === 'geyser'}
        disabled={!!busy || !geyserSupported}
      />
      </View>

      <SectionTitle title="Rename" icon="create-outline" />
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          value={newName}
          onChangeText={setNewName}
          placeholder={serverName}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
        />
        <Button
          icon="create-outline"
          label="Rename the server"
          onPress={renameServer}
          loading={busy === 'rename'}
          disabled={!!busy || !newName.trim() || newName.trim() === serverName}
        />
        {running ? <Text style={styles.hint}>The server must be stopped.</Text> : null}
      </View>

      <SectionTitle title="Danger zone" icon="warning-outline" color={colors.red} />
      {!showDelete ? (
        <Button icon="trash-outline" label="Delete this server…" onPress={() => setShowDelete(true)} disabled={!!busy} danger />
      ) : (
        <View style={[styles.card, styles.cardDanger]}>
          <Text style={styles.cardText}>
            This action is permanent. auto-mcs tries to back up the server before deleting it
            (depending on free disk space). Type the exact server name to confirm:
          </Text>
          <Text style={styles.confirmName}>{serverName}</Text>
          <TextInput
            style={styles.input}
            value={confirmName}
            onChangeText={setConfirmName}
            placeholder="Server name"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            icon="trash"
            label="Delete permanently"
            onPress={deleteServer}
            loading={busy === 'delete'}
            disabled={!!busy || confirmName !== serverName}
            danger
          />
          <Button label="Cancel" onPress={() => { setShowDelete(false); setConfirmName(''); }} disabled={!!busy} />
          {running ? <Text style={styles.hint}>The server must be stopped.</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: spacing.xl, marginBottom: spacing.xs, paddingBottom: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sectionStripe: { width: 3, height: 14, borderRadius: 2, backgroundColor: colors.accent },
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: colors.accent, textTransform: 'uppercase' },

  groupCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, minHeight: 52,
  },
  rowLabel: { color: colors.textPrimary, fontSize: 15 },
  hint: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm, marginTop: spacing.sm,
  },
  cardDanger: { borderColor: colors.red },
  cardText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  confirmName: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },

  input: {
    backgroundColor: colors.bgInput, color: colors.textPrimary, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 8, fontSize: 14,
    borderWidth: 1, borderColor: colors.border,
  },

  btn: {
    alignItems: 'center', justifyContent: 'center', minHeight: 42,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent,
    backgroundColor: colors.accentDim, marginTop: spacing.sm, paddingHorizontal: spacing.md,
  },
  btnDanger: { borderColor: colors.red, backgroundColor: 'transparent' },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  btnTextDanger: { color: colors.red },
});
