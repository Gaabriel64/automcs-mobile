import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { telepathService } from '../services/telepath';
import { colors, spacing, radius, fonts } from '../theme';

// ── Decorative background grid dots ──────────────────────────────────────────
function GridDots() {
  const dots = [];
  for (let i = 0; i < 48; i++) {
    dots.push(
      <View key={i} style={gridStyles.dot} />
    );
  }
  return <View style={gridStyles.grid}>{dots}</View>;
}

const gridStyles = StyleSheet.create({
  grid: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', flexWrap: 'wrap',
    opacity: 0.06,
    pointerEvents: 'none',
  },
  dot: {
    width: 2, height: 2, borderRadius: 1,
    backgroundColor: colors.accent,
    margin: 24,
  },
});

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ step }) {
  const steps = ['connect', 'pairing', 'code'];
  const idx = steps.indexOf(step);
  return (
    <View style={stepStyles.row}>
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <View style={[stepStyles.dot, i <= idx && stepStyles.dotActive]} />
          {i < steps.length - 1 && (
            <View style={[stepStyles.line, i < idx && stepStyles.lineActive]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.textMuted,
  },
  dotActive: { backgroundColor: colors.accent },
  line: { flex: 1, height: 1, backgroundColor: colors.border, marginHorizontal: 4 },
  lineActive: { backgroundColor: colors.borderAccent },
});

// ── Labeled input ─────────────────────────────────────────────────────────────
function InputField({ label, icon, ...props }) {
  return (
    <View style={inputStyles.wrap}>
      <Text style={inputStyles.label}>{icon ? `${icon}  ` : ''}{label}</Text>
      <TextInput style={inputStyles.input} placeholderTextColor={colors.textMuted} {...props} />
    </View>
  );
}

const inputStyles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.8,
    color: colors.textSecondary, textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    color: colors.textPrimary, fontSize: 15,
    fontFamily: fonts.mono,
  },
});

// ── Primary button ────────────────────────────────────────────────────────────
function PrimaryButton({ label, onPress, disabled, loading }) {
  return (
    <TouchableOpacity
      style={[btnStyles.btn, disabled && btnStyles.disabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={colors.bg} size="small" />
        : <Text style={btnStyles.label}>{label}</Text>}
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.md,
  },
  disabled: { opacity: 0.45 },
  label: {
    color: colors.bg, fontSize: 15, fontWeight: '800', letterSpacing: 0.4,
  },
});

// ── Error banner ──────────────────────────────────────────────────────────────
function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <View style={errStyles.wrap}>
      <Text style={errStyles.icon}>⚠</Text>
      <Text style={errStyles.text}>{message}</Text>
    </View>
  );
}

const errStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(224,92,92,0.1)',
    borderWidth: 1, borderColor: 'rgba(224,92,92,0.3)',
    borderRadius: radius.sm, padding: spacing.sm,
    marginTop: spacing.sm,
  },
  icon: { color: colors.red, fontSize: 13, marginTop: 1 },
  text: { color: colors.red, fontSize: 13, flex: 1, lineHeight: 18 },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ConnectScreen({ navigation }) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('7001');
  const [pairCode, setPairCode] = useState('');
  const [step, setStep] = useState('connect');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const success = await telepathService.tryReconnect();
      if (success) navigation.replace('Servers');
    })();
  }, []);

  const handleConnect = async () => {
    if (!host.trim()) { setError('Adresse IP requise'); return; }
    setLoading(true); setError('');
    telepathService.host = host.trim();
    telepathService.port = parseInt(port) || 7001;
    try {
      await telepathService.checkStatus();
      setStep('pairing'); setLoading(false);
      await telepathService.requestPair();
      setStep('code');
    } catch (e) {
      setError(e.message); setStep('connect'); setLoading(false);
    }
  };

  const handleSubmitCode = async () => {
    if (pairCode.replace('-', '').length < 6) { setError('Code à 6 caractères requis'); return; }
    setLoading(true); setError('');
    const rawCode = pairCode.replace('-', '');
    try {
      const result = await telepathService.submitPair(rawCode);
      if (result?.['access-token']) {
        navigation.replace('Servers');
      } else {
        setError('Code invalide ou expiré. Recommence depuis le début.');
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
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <GridDots />
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">

        {/* Logo / header */}
        <View style={styles.header}>
          <View style={styles.logoRing}>
            <View style={styles.logoInner}>
              <Text style={styles.logoEmoji}>⚡</Text>
            </View>
          </View>
          <Text style={styles.brand}>auto-mcs</Text>
          <Text style={styles.brandSub}>TELEPATH  ·  REMOTE MANAGER</Text>
        </View>

        {/* Step indicator */}
        <StepIndicator step={step} />

        {/* ── Step: connect ── */}
        {step === 'connect' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderAccent} />
              <Text style={styles.cardTitle}>CONNEXION</Text>
            </View>

            <InputField
              label="Adresse IP"
              icon="🌐"
              placeholder="192.168.1.100"
              value={host}
              onChangeText={setHost}
              autoCapitalize="none"
              keyboardType="default"
            />
            <InputField
              label="Port Telepath"
              icon="🔌"
              placeholder="7001"
              value={port}
              onChangeText={setPort}
              keyboardType="number-pad"
            />

            <ErrorBanner message={error} />
            <PrimaryButton
              label="Se connecter →"
              onPress={handleConnect}
              loading={loading}
              disabled={loading}
            />
          </View>
        )}

        {/* ── Step: pairing ── */}
        {step === 'pairing' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderAccent} />
              <Text style={styles.cardTitle}>PAIRING</Text>
            </View>
            <View style={styles.pairingCenter}>
              <ActivityIndicator color={colors.accent} size="large" style={{ marginBottom: spacing.md }} />
              <Text style={styles.pairingLabel}>Demande en cours…</Text>
            </View>
            <View style={styles.hintBox}>
              <Text style={styles.hintTitle}>Comment faire</Text>
              <Text style={styles.hintText}>
                Dans auto-mcs, ouvre{' '}
                <Text style={styles.mono}>Settings → Telepath</Text>
                {' '}et active{' '}
                <Text style={styles.mono}>Share this instance</Text>.
                {'\n'}Un code à 6 caractères apparaîtra.
              </Text>
            </View>
          </View>
        )}

        {/* ── Step: code ── */}
        {step === 'code' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderAccent} />
              <Text style={styles.cardTitle}>CODE DE PAIRING</Text>
            </View>

            <Text style={styles.codeHint}>Entre le code affiché dans auto-mcs</Text>

            <TextInput
              style={styles.codeInput}
              placeholder="ABC-123"
              placeholderTextColor={colors.textMuted}
              value={pairCode}
              onChangeText={(text) => {
                const clean = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
                const formatted = clean.length > 3 ? clean.slice(0, 3) + '-' + clean.slice(3) : clean;
                setPairCode(formatted);
              }}
              keyboardType="default"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              autoFocus
            />

            <ErrorBanner message={error} />
            <PrimaryButton
              label="Valider le code →"
              onPress={handleSubmitCode}
              loading={loading}
              disabled={loading}
            />
            <TouchableOpacity onPress={() => { setStep('connect'); setError(''); setPairCode(''); }} style={styles.backLink}>
              <Text style={styles.backLinkText}>← Recommencer</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, paddingTop: spacing.xl },

  // Header
  header: { alignItems: 'center', marginBottom: spacing.xl },
  logoRing: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 1, borderColor: colors.borderAccent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.accentDim,
  },
  logoInner: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  logoEmoji: { fontSize: 34 },
  brand: {
    fontSize: 30, fontWeight: '800', color: colors.textPrimary,
    letterSpacing: 2, marginBottom: 4,
  },
  brandSub: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2.5,
    color: colors.textMuted, textTransform: 'uppercase',
  },

  // Card
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: spacing.lg,
  },
  cardHeaderAccent: {
    width: 3, height: 16, borderRadius: 2,
    backgroundColor: colors.accent,
  },
  cardTitle: {
    fontSize: 11, fontWeight: '800', letterSpacing: 2,
    color: colors.accent, textTransform: 'uppercase',
  },

  // Pairing
  pairingCenter: { alignItems: 'center', paddingVertical: spacing.md },
  pairingLabel: { color: colors.textSecondary, fontSize: 15 },
  hintBox: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginTop: spacing.lg,
  },
  hintTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.5,
    color: colors.textSecondary, textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  hintText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  mono: {
    fontFamily: fonts.mono,
    color: colors.accentLight,
  },

  // Code input
  codeHint: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing.md },
  codeInput: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderAccent,
    padding: spacing.md,
    color: colors.accent,
    fontSize: 32, textAlign: 'center', letterSpacing: 8, fontWeight: '800',
    fontFamily: fonts.mono,
  },

  backLink: { alignItems: 'center', marginTop: spacing.md, padding: spacing.sm },
  backLinkText: { color: colors.textSecondary, fontSize: 13 },
});
