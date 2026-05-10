// auto-mcs Mobile — Theme
// Inspired by the auto-mcs desktop app aesthetic:
// deep dark backgrounds, teal/cyan accents, Figtree typography

import { Platform } from 'react-native';

export const colors = {
  // Backgrounds — layered depth like the desktop app
  bg:        '#0d1117',   // deepest bg
  bgCard:    '#131a24',   // card surface
  bgInput:   '#0a0f17',   // input / console bg
  bgHover:   '#1a2535',   // hover/pressed states

  // Borders
  border:        'rgba(99, 143, 196, 0.15)',
  borderAccent:  'rgba(78, 205, 196, 0.35)',

  // Accent — auto-mcs teal/cyan signature
  accent:        '#4ecdc4',
  accentLight:   '#7eddd7',
  accentDim:     'rgba(78, 205, 196, 0.18)',

  // Text
  textPrimary:   '#e8edf5',
  textSecondary: '#6b8299',
  textMuted:     '#3d5268',

  // Status
  green:   '#4caf87',
  red:     '#e05c5c',
  yellow:  '#f0b429',
  orange:  '#ff9800',
  blue:    '#5b9bd5',

  // Console specific
  consoleBg:   '#080d14',
  consoleText: '#a8bfd4',
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  14,
  lg:  20,
  xl:  32,
};

export const radius = {
  xs:  3,
  sm:  6,
  md:  10,
  lg:  16,
  xl:  24,
};

// Font families matching auto-mcs assets
export const fonts = {
  // Figtree is the primary auto-mcs font — fall back gracefully
  regular:    Platform.OS === 'ios' ? 'Figtree-Regular' : 'Figtree-Regular',
  medium:     Platform.OS === 'ios' ? 'Figtree-Medium'  : 'Figtree-Medium',
  bold:       Platform.OS === 'ios' ? 'Figtree-Bold'    : 'Figtree-Bold',
  extraBold:  Platform.OS === 'ios' ? 'Figtree-ExtraBold' : 'Figtree-ExtraBold',
  mono:       Platform.OS === 'ios' ? 'Inconsolata-Regular' : 'monospace',
  monoBold:   Platform.OS === 'ios' ? 'Inconsolata-Bold'    : 'monospace',
};