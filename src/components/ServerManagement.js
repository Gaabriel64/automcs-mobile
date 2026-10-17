// Gestion du serveur : démarrage auto, playit.gg, Geyser (Bedrock), renommer, supprimer.
// Reproduit ce que fait la page « Paramètres » du desktop d'auto-mcs, en appelant les
// mêmes méthodes de ServerObject / AddonManager via Telepath.
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Switch, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Linking,
} from 'react-native';
import { telepathService } from '../services/telepath';
import { fetchFreshConfig } from '../utils/config';
import { colors, spacing, radius } from '../theme';

// URL ouverte par le desktop pour obtenir le code (playit.manager.setup_url)
const PLAYIT_SETUP_URL =
  'https://playit.gg/account/setup/wizard/new-account/third-party/third-party-code?partner=auto-mcs';

// Types pour lesquels auto-mcs propose Geyser (AddonManager.check_geyser / reload_config)
const GEYSER_TYPES = ['spigot', 'paper', 'purpur', 'fabric', 'quilt', 'neoforge'];
const INVALID_NAME = /[\\/:*?"<>|]/;

const isTrue = v => v === true || String(v).toLowerCase() === 'true';

// Compare deux versions « 1.20.4 » : vrai si a >= b
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

function Section({ title }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionStripe} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

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

function Button({ label, onPress, disabled, danger, loading }) {
  return (
    <TouchableOpacity
      style={[styles.btn, danger && styles.btnDanger, (disabled || loading) && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading
        ? <ActivityIndicator color={danger ? colors.red : colors.accent} />
        : <Text style={[styles.btnText, danger && styles.btnTextDanger]}>{label}</Text>}
    </TouchableOpacity>
  );
}

export default function ServerManagement({ serverName, cfg, onCfgChanged, navigation }) {
  const [running, setRunning]       = useState(null);
  const [type, setType]             = useState('');
  const [version, setVersion]       = useState('');
  const [proxyLinked, setProxyLinked] = useState(null);
  // État réel des interrupteurs, lu sur le serveur (null = inconnu / non pris en charge)
  const [flags, setFlags]           = useState({ proxy: null, geyser: null, autostart: null });
  const [busy, setBusy]             = useState('');
  const [code, setCode]             = useState('');
  const [newName, setNewName]       = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const g = cfg?.general || {};
  // Source de vérité : attributs du serveur (proxy_enabled, geyser_enabled, autostart), ceux
  // qu'il utilise au lancement. Repli sur le .ini, dont les clés respectent la casse exacte.
  const proxyOn     = flags.proxy     ?? isTrue(g.enableProxy);
  const geyserOn    = flags.geyser    ?? isTrue(g.enableGeyser);
  const autostartOn = flags.autostart ?? isTrue(g.autostart);
  const geyserSupported =
    GEYSER_TYPES.includes(String(type).toLowerCase()) && versionAtLeast(version, '1.13.2');

  // Associe notre appareil à ce serveur avant toute action (comme le fait l'app desktop)
  const ensureOpen = useCallback(() => telepathService.openServer(serverName), [serverName]);

  // Relit les attributs de chaque interrupteur ; garde l'ancienne valeur si la lecture échoue
  // (ex. `autostart` n'existe pas avant auto-mcs 1.3).
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

  // Exécute une action en bloquant les autres, avec message d'erreur lisible
  const run = useCallback(async (key, fn, errorTitle = 'Erreur') => {
    if (busy) return false;
    setBusy(key);
    try {
      await ensureOpen();
      await fn();
      return true;
    } catch (e) {
      if (notSupported(e)) {
        Alert.alert('Non pris en charge', "Cette version d'auto-mcs ne propose pas cette fonction.");
      } else {
        Alert.alert(errorTitle, e.message);
      }
      return false;
    } finally {
      setBusy('');
    }
  }, [busy, ensureOpen]);

  // Écrit une valeur de [general] à partir de la config FRAÎCHE du serveur,
  // pour ne jamais écraser un réglage modifié entre-temps.
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
      Alert.alert('Serveur en cours', `Arrête le serveur avant de ${what}.`);
      return false;
    }
    return true;
  };

  // ── Démarrage automatique ──
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
    if (running) Alert.alert('Redémarrage nécessaire', 'Redémarre le serveur pour appliquer ce changement.');
  });

  const linkPlayit = async () => {
    const c = code.trim();
    if (!c) { Alert.alert('Code manquant', 'Colle le code affiché sur playit.gg.'); return; }
    const ok = await run('link', async () => {
      const linked = await telepathService.linkPlayit(c);
      if (!linked) throw new Error('Échec de la liaison : code invalide, ou le serveur n\'a pas accès à Internet.');
      await telepathService.setProxy(true);
      setFlags(f => ({ ...f, proxy: true }));
      await readFlags();
      await onCfgChanged?.();
    }, 'playit.gg');
    if (ok) { setCode(''); setProxyLinked(true); Alert.alert('playit.gg', 'Compte lié, proxy activé pour ce serveur.'); }
  };

  const openPlayitPanel = () => run('panel', async () => {
    const url = await telepathService.getPlayitUrl();
    if (!url) throw new Error("Le panneau playit n'est pas encore disponible.");
    await Linking.openURL(String(url));
  }, 'playit.gg');

  const unlinkPlayit = () => {
    Alert.alert(
      'Dissocier playit.gg ?',
      'Le compte est lié à la machine qui héberge auto-mcs : tous ses serveurs perdront leur adresse playit.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Dissocier', style: 'destructive',
          onPress: async () => {
            const ok = await run('unlink', async () => {
              const done = await telepathService.unlinkPlayit();
              if (!done) throw new Error('Impossible de dissocier le compte.');
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
    if (!requireStopped('modifier Geyser')) return;
    Alert.alert(
      v ? 'Activer le support Bedrock ?' : 'Désactiver le support Bedrock ?',
      v
        ? 'Geyser, Floodgate et ViaVersion seront téléchargés sur le serveur. Cela peut prendre quelques minutes.'
        : 'Geyser, Floodgate et ViaVersion seront retirés du serveur.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          onPress: () => run('geyser', async () => {
            await telepathService.installGeyser(v);
            await setConfigValue('enableGeyser', v);
            await telepathService.reloadConfig();   // recalcule geyser_enabled côté serveur
            setFlags(f => ({ ...f, geyser: v }));
            await readFlags();
            await onCfgChanged?.();
          }, 'Geyser'),
        },
      ],
    );
  };

  // ── Renommer ──
  const renameServer = async () => {
    const name = newName.trim();
    if (!requireStopped('renommer le serveur')) return;
    if (!name || name === serverName) return;
    if (INVALID_NAME.test(name) || /[. ]$/.test(name)) {
      Alert.alert('Nom invalide', 'Évite les caractères \\ / : * ? " < > | et un point ou espace à la fin.');
      return;
    }
    const ok = await run('rename', async () => {
      const list = await telepathService.getServerList();
      const taken = (Array.isArray(list) ? list : []).some(s => String(s?.name || '').toLowerCase() === name.toLowerCase());
      if (taken) throw new Error('Un serveur porte déjà ce nom.');
      await telepathService.renameServer(name);
    }, 'Renommer');
    if (ok) {
      Alert.alert('Serveur renommé', `« ${serverName} » s'appelle maintenant « ${name} ».`);
      navigation.popToTop();
    }
  };

  // ── Supprimer ──
  const deleteServer = async () => {
    if (!requireStopped('supprimer le serveur')) return;
    if (confirmName !== serverName) return;
    const ok = await run('delete', async () => {
      const done = await telepathService.deleteServer();
      if (done === false) throw new Error("La suppression a échoué (serveur encore en cours d'exécution ?).");
    }, 'Supprimer');
    if (ok) {
      Alert.alert('Serveur supprimé', `« ${serverName} » a été supprimé.`);
      navigation.popToTop();
    }
  };

  const loadingState = running === null;

  return (
    <View>
      <Section title="Démarrage" />
      <ToggleRow
        label="Démarrer avec auto-mcs"
        hint="Lance ce serveur automatiquement au démarrage d'auto-mcs (auto-mcs 1.3+)"
        value={autostartOn}
        onChange={toggleAutostart}
        loading={busy === 'autostart'}
        disabled={!!busy}
      />

      <Section title="playit.gg (accès depuis Internet)" />
      {proxyLinked === null ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.md }} />
      ) : proxyLinked === 'error' ? (
        <View style={styles.card}>
          <Text style={styles.cardText}>
            Impossible de vérifier playit.gg sur ce serveur (pas de réponse). Réessaie dans un instant.
          </Text>
          <Button label="Réessayer" onPress={() => { setProxyLinked(null); refreshState(); }} />
        </View>
      ) : proxyLinked ? (
        <View>
          <ToggleRow
            label="Activer le proxy playit"
            hint="Donne une adresse publique à ce serveur, sans ouvrir de port"
            value={proxyOn}
            onChange={toggleProxy}
            loading={busy === 'proxy'}
            disabled={!!busy}
          />
          <Button label="Ouvrir le panneau playit" onPress={openPlayitPanel} loading={busy === 'panel'} disabled={!!busy} />
          <Button label="Dissocier le compte playit" onPress={unlinkPlayit} loading={busy === 'unlink'} disabled={!!busy} danger />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardText}>
            playit.gg n'est pas encore configuré. 1) Ouvre le site et crée ou connecte ton compte,
            2) copie le code affiché, 3) colle-le ici puis autorise.
          </Text>
          <Button label="1 · Ouvrir playit.gg" onPress={() => Linking.openURL(PLAYIT_SETUP_URL)} disabled={!!busy} />
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="Colle le code ici…"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button label="3 · Autoriser" onPress={linkPlayit} loading={busy === 'link'} disabled={!!busy || !code.trim()} />
          <Text style={styles.hint}>L'installation de l'agent playit sur le serveur peut prendre une minute.</Text>
        </View>
      )}

      <Section title="Bedrock (Geyser)" />
      <ToggleRow
        label="Support Bedrock"
        hint={
          loadingState ? 'Chargement…'
          : geyserSupported ? 'Installe Geyser, Floodgate et ViaVersion. Serveur arrêté requis.'
          : `Indisponible pour ${type || 'ce type'} ${version}`.trim()
        }
        value={geyserOn}
        onChange={toggleGeyser}
        loading={busy === 'geyser'}
        disabled={!!busy || !geyserSupported}
      />

      <Section title="Renommer" />
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
          label="Renommer le serveur"
          onPress={renameServer}
          loading={busy === 'rename'}
          disabled={!!busy || !newName.trim() || newName.trim() === serverName}
        />
        {running ? <Text style={styles.hint}>Le serveur doit être arrêté.</Text> : null}
      </View>

      <Section title="Zone dangereuse" />
      {!showDelete ? (
        <Button label="Supprimer ce serveur…" onPress={() => setShowDelete(true)} disabled={!!busy} danger />
      ) : (
        <View style={[styles.card, styles.cardDanger]}>
          <Text style={styles.cardText}>
            Cette action est définitive. auto-mcs tente de sauvegarder le serveur avant de le supprimer
            (selon l'espace disque). Tape le nom exact du serveur pour confirmer :
          </Text>
          <Text style={styles.confirmName}>{serverName}</Text>
          <TextInput
            style={styles.input}
            value={confirmName}
            onChangeText={setConfirmName}
            placeholder="Nom du serveur"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            label="Supprimer définitivement"
            onPress={deleteServer}
            loading={busy === 'delete'}
            disabled={!!busy || confirmName !== serverName}
            danger
          />
          <Button label="Annuler" onPress={() => { setShowDelete(false); setConfirmName(''); }} disabled={!!busy} />
          {running ? <Text style={styles.hint}>Le serveur doit être arrêté.</Text> : null}
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

  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, minHeight: 46,
    borderBottomWidth: 1, borderBottomColor: 'rgba(99,143,196,0.06)',
  },
  rowLabel: { color: colors.textPrimary, fontSize: 14 },
  hint: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md,
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
