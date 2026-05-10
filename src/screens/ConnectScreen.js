import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { telepathService } from '../services/telepath';
import { colors, spacing, radius } from '../theme';

export default function ConnectScreen({ navigation }) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('7001');
  const [pairCode, setPairCode] = useState('');
  const [step, setStep] = useState('connect'); // connect | pairing | code
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const hasSession = await telepathService.loadSaved();
      if (hasSession) {
        try {
          await telepathService.checkStatus();
          // Try to re-login with existing session
          const data = await telepathService.login();
          if (data?.['access-token']) {
            navigation.replace('Servers');
            return;
          }
        } catch {}
        await telepathService.clearSession();
      }
    })();
  }, []);

  const handleConnect = async () => {
    if (!host.trim()) { setError('Entre une adresse IP'); return; }
    setLoading(true);
    setError('');

    telepathService.host = host.trim();
    telepathService.port = parseInt(port) || 7001;

    try {
      await telepathService.checkStatus();
      setStep('pairing');
      setLoading(false);
      await telepathService.requestPair();
      setStep('code');
    } catch (e) {
      setError(e.message);
      setStep('connect');
      setLoading(false);
    }
  };

    const handleSubmitCode = async () => {
    if (pairCode.replace('-', '').length < 6) { setError('Entre le code affiché sur le serveur'); return; }
    setLoading(true);
    setError('');
    const rawCode = pairCode.replace('-', ''); // server stores 6 chars without hyphen
    try {
      const result = await telepathService.submitPair(rawCode);
      if (result?.['access-token']) {
        navigation.replace('Servers');
      } else {
        setError('Code invalide ou expiré. Réessaie depuis le début.');
        setStep('connect');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>⚡</Text>
          </View>
          <Text style={styles.title}>auto-mcs</Text>
          <Text style={styles.subtitle}>Remote Manager</Text>
        </View>

        {step === 'connect' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Connexion Telepath</Text>

            <Text style={styles.label}>Adresse IP du serveur</Text>
            <TextInput
              style={styles.input}
              placeholder="192.168.1.100"
              placeholderTextColor={colors.textSecondary}
              value={host}
              onChangeText={setHost}
              autoCapitalize="none"
              keyboardType="default"
            />

            <Text style={styles.label}>Port</Text>
            <TextInput
              style={styles.input}
              placeholder="7001"
              placeholderTextColor={colors.textSecondary}
              value={port}
              onChangeText={setPort}
              keyboardType="number-pad"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleConnect}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.textPrimary} />
                : <Text style={styles.btnText}>Se connecter</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {step === 'pairing' && (
          <View style={styles.card}>
            <ActivityIndicator color={colors.accent} size="large" style={{ marginBottom: spacing.md }} />
            <Text style={styles.cardTitle}>Demande de pairing...</Text>
            <Text style={styles.hint}>
              Sur auto-mcs, va dans{'\n'}
              <Text style={styles.code}>Settings → Telepath</Text>{'\n'}
              et active <Text style={styles.code}>Share this instance</Text>.{'\n\n'}
              Un code va apparaître.
            </Text>
          </View>
        )}

        {step === 'code' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Code de pairing</Text>
            <Text style={styles.hint}>
              Entre le code affiché dans l'interface auto-mcs.
            </Text>

            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="XXX-XXX"
              placeholderTextColor={colors.textSecondary}
              value={pairCode}
              onChangeText={(text) => {
                // Keep only letters/digits, uppercase, max 6 chars
                const clean = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
                // Auto-insert hyphen after 3 chars
                const formatted = clean.length > 3 ? clean.slice(0, 3) + '-' + clean.slice(3) : clean;
                setPairCode(formatted);
              }}
              keyboardType="default"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              autoFocus
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSubmitCode}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.textPrimary} />
                : <Text style={styles.btnText}>Valider</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setStep('connect'); setError(''); setPairCode(''); }}>
              <Text style={styles.link}>← Recommencer</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  logoBox: {
    width: 72, height: 72, borderRadius: radius.lg,
    backgroundColor: colors.accent, alignItems: 'center',
    justifyContent: 'center', marginBottom: spacing.md,
  },
  logoIcon: { fontSize: 36 },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: 1 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  label: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.bgInput, borderRadius: radius.sm,
    padding: spacing.md, color: colors.textPrimary,
    fontSize: 16, borderWidth: 1, borderColor: colors.border,
  },
  codeInput: { fontSize: 28, textAlign: 'center', letterSpacing: 4, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  btn: {
    backgroundColor: colors.accent, borderRadius: radius.sm,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.lg,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  error: { color: colors.red, marginTop: spacing.sm, fontSize: 13 },
  hint: { color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 22 },
  code: { color: colors.accentLight, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  link: { color: colors.accentLight, textAlign: 'center', marginTop: spacing.md, fontSize: 14 },
});
