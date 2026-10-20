// Shared UI primitives: Text/TextInput that pick the right Figtree/Inconsolata weight,
// icons (Ionicons, the same icon family as the desktop app) and buttons.
import React, { useContext } from 'react';
import {
  Text as RNText, TextInput as RNTextInput, StyleSheet,
  TouchableOpacity, ActivityIndicator, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing } from '../theme';

const SANS = new Set([fonts.regular, fonts.medium, fonts.semibold, fonts.bold, fonts.extraBold]);
const MONO = new Set([fonts.mono, fonts.monoMedium, fonts.monoBold]);

const weightOf = (w) => (w === 'normal' || w == null ? 400 : w === 'bold' ? 700 : parseInt(w, 10) || 400);

// Custom fonts have no synthetic weights on Android: the weight must be part of the family
// name. Returns the family for a flattened style, or null to leave the style untouched.
export function resolveFont(flat) {
  const family = flat.fontFamily;
  const w = weightOf(flat.fontWeight);
  if (family && MONO.has(family)) return w >= 700 ? fonts.monoBold : w >= 500 ? fonts.monoMedium : fonts.mono;
  if (family && !SANS.has(family)) return null;                    // explicit foreign family
  if (w >= 800) return fonts.extraBold;
  if (w >= 700) return fonts.bold;
  if (w >= 600) return fonts.semibold;
  if (w >= 500) return fonts.medium;
  return fonts.regular;
}

// Nested <Text> inherits the parent font, so it must not reset it to regular
const NestedText = React.createContext(false);

export function Text({ style, children, ...props }) {
  const nested = useContext(NestedText);
  const flat = StyleSheet.flatten(style) || {};
  const hasFont = flat.fontWeight != null || flat.fontFamily != null;
  const family = !nested || hasFont ? resolveFont(flat) : null;
  return (
    <RNText {...props} style={family ? [style, { fontFamily: family, fontWeight: 'normal' }] : style}>
      <NestedText.Provider value>{children}</NestedText.Provider>
    </RNText>
  );
}

export const TextInput = React.forwardRef(function TextInput({ style, ...props }, ref) {
  const flat = StyleSheet.flatten(style) || {};
  const family = resolveFont(flat);
  return <RNTextInput ref={ref} {...props} style={family ? [style, { fontFamily: family, fontWeight: 'normal' }] : style} />;
});

export function Icon({ name, size = 20, color = colors.textSecondary, style }) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

// Buttons: primary (brand green), secondary (indigo), danger (outlined) and ghost
const VARIANTS = {
  primary:   { bg: colors.accent,    border: colors.accent,       fg: colors.onAccent },
  secondary: { bg: colors.indigoDim, border: colors.indigo,       fg: colors.textPrimary },
  danger:    { bg: 'transparent',    border: colors.red,          fg: colors.red },
  ghost:     { bg: 'transparent',    border: colors.borderStrong, fg: colors.textSecondary },
};

export function Button({ label, icon, iconRight, onPress, variant = 'primary', disabled, loading, style, compact }) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  return (
    <TouchableOpacity
      style={[
        buttonStyles.btn,
        compact && buttonStyles.compact,
        { backgroundColor: v.bg, borderColor: v.border },
        (disabled || loading) && buttonStyles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={buttonStyles.content}>
          {icon ? <Icon name={icon} size={compact ? 16 : 18} color={v.fg} /> : null}
          {label ? <Text style={[buttonStyles.label, compact && buttonStyles.labelCompact, { color: v.fg }]}>{label}</Text> : null}
          {iconRight ? <Icon name={iconRight} size={compact ? 16 : 18} color={v.fg} /> : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const buttonStyles = StyleSheet.create({
  btn: {
    minHeight: 46, borderRadius: radius.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg,
  },
  compact: { minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 15, fontWeight: '700' },
  labelCompact: { fontSize: 13 },
  disabled: { opacity: 0.45 },
});

// Section title used across the settings-like screens
export function SectionTitle({ title, icon, color = colors.accent }) {
  return (
    <View style={sectionStyles.row}>
      {icon ? <Icon name={icon} size={15} color={color} /> : null}
      <Text style={[sectionStyles.text, { color }]}>{title}</Text>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: spacing.xl, marginBottom: spacing.sm,
  },
  text: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
});
