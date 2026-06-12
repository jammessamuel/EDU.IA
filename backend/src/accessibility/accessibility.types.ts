export const COLOR_BLIND_MODES = ['none', 'protanopia', 'deuteranopia', 'tritanopia'] as const;

export type ColorBlindMode = (typeof COLOR_BLIND_MODES)[number];

export interface AccessibilityProfile {
  screenReader: boolean;
  highContrast: boolean;
  colorBlindMode: ColorBlindMode;
  reduceMotion: boolean;
  simpleLanguage: boolean;
  fontScale: number;
}

export const DEFAULT_ACCESSIBILITY_PROFILE: AccessibilityProfile = {
  screenReader: false,
  highContrast: false,
  colorBlindMode: 'none',
  reduceMotion: false,
  simpleLanguage: false,
  fontScale: 1,
};
