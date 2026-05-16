export const palette = {
  vintageGrape: '#413c58',
  ashGrey: '#a3c4bc',
  teaGreen: '#bfd7b5',
  cream: '#e7efc5',
  vanillaCustard: '#f2dda4',
} as const

export type PaletteKey = keyof typeof palette
