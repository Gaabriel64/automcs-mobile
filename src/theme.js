// auto-mcs Mobile theme.
// Palette taken from the auto-mcs desktop app: background (0.115, 0.115, 0.182) = #1D1D2E,
// brand green gradient (#2BD4A1 -> #38E088), indigo widgets (#494C7B, highlight #5F61D0)
// and the console type colors used by the desktop log view.

export const colors = {
  // Backgrounds, from deepest to most raised
  bg:        '#1D1D2E',   // desktop background_color
  bgCard:    '#252540',   // cards and panels
  bgRaised:  '#2F3052',   // raised elements on top of cards
  bgInput:   '#171726',   // inputs and console (deeper than the background)
  bgHover:   '#34355C',   // pressed / hover

  // Borders
  border:        'rgba(160, 162, 255, 0.14)',
  borderStrong:  'rgba(160, 162, 255, 0.28)',
  borderAccent:  'rgba(43, 212, 161, 0.40)',

  // Brand green
  accent:        '#2BD4A1',
  accentLight:   '#6FE9C4',
  accentDim:     'rgba(43, 212, 161, 0.16)',
  onAccent:      '#0B2A21',   // text/icons on top of the accent color

  // Indigo (desktop widgets)
  indigo:        '#5F61D0',
  indigoBase:    '#494C7B',
  indigoDim:     'rgba(95, 97, 208, 0.22)',

  // Text
  textPrimary:   '#F2F2F7',
  textSecondary: '#A3A6D1',
  textMuted:     '#6F7299',

  // Status (same family as the desktop console type colors)
  green:   '#38E088',
  red:     '#FF6B8F',
  yellow:  '#FFCD6B',
  orange:  '#FFA45C',
  blue:    '#8C9CFF',
  pink:    '#FF7FA6',

  // Console specific
  consoleBg:   '#12121F',
  consoleText: '#C9CBF5',
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  14,
  lg:  20,
  xl:  32,
};

export const radius = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  18,
  xl:  26,
};

// Font families. Figtree and Inconsolata are the fonts used by the desktop app; both are
// open source (SIL OFL) and are loaded in App.js from @expo-google-fonts.
export const fonts = {
  regular:    'Figtree_400Regular',
  medium:     'Figtree_500Medium',
  semibold:   'Figtree_600SemiBold',
  bold:       'Figtree_700Bold',
  extraBold:  'Figtree_800ExtraBold',
  mono:       'Inconsolata_400Regular',
  monoMedium: 'Inconsolata_500Medium',
  monoBold:   'Inconsolata_700Bold',
};

export const shadow = {
  card: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
};

// Accent color per server type (badges, icons)
export const typeColors = {
  paper:       '#4CD6A0',
  spigot:      '#FFCD6B',
  fabric:      '#A8A0FF',
  forge:       '#FFA45C',
  neoforge:    '#FF8A3D',
  quilt:       '#6FD0FF',
  purpur:      '#C792FF',
  vanilla:     '#9AA0C8',
  craftbukkit: '#FFE066',
};

export const typeColor = (type) => typeColors[String(type || '').toLowerCase()] || colors.textSecondary;
