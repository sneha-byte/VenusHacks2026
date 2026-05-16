export const palette = {
  jetBlack: '#2c363f',
  blushRose: '#e75a7c',
  ivory: '#f2f5ea',
  dustGrey: '#d6dbd2',
  drySage: '#bbc7a4',
} as const

export type PaletteKey = keyof typeof palette
