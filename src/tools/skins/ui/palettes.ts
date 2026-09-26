// Skin-friendly colour presets.

export interface PaletteGroup {
  id: string;
  label: string;
  colors: string[];
}

export const SKIN_PALETTES: readonly PaletteGroup[] = [
  {
    id: 'skin',
    label: 'Skin',
    colors: ['#ffe3cc', '#f8d2b4', '#efbe98', '#e3a982', '#d4956b', '#c4825a', '#b0704b', '#9a5d3c', '#824c30', '#6a3c26', '#52301f', '#3c2418', '#f4c7b4', '#e8b4a0'],
  },
  {
    id: 'hair',
    label: 'Hair',
    colors: ['#161416', '#2b1d16', '#3f2a1c', '#5a3a24', '#76502f', '#946840', '#7a2e18', '#b4521e', '#d98a3c', '#e3bf6c', '#f1dfa4', '#9a9aa4', '#dcdce2', '#f28cb8', '#5aa0f0', '#8a5ae6'],
  },
  {
    id: 'eyes',
    label: 'Eyes',
    colors: ['#ffffff', '#1b1b22', '#4a2c18', '#7a5426', '#8c6c2c', '#3f8a4a', '#2e6a3a', '#3a78d0', '#6cb4f0', '#8a96a6', '#d09a2a', '#8a5ad0', '#d8403c', '#40e0d0'],
  },
  {
    id: 'clothes',
    label: 'Clothes',
    colors: ['#1b1c22', '#3a3d46', '#6c717c', '#a3a8b2', '#f0f1f4', '#243b6b', '#3a5a9a', '#6ec0f0', '#2aa3a0', '#3a9a4a', '#2a5a32', '#9ac84a', '#f2c83c', '#e8762c', '#c8323c', '#8a1e2a', '#f07ab0', '#7a4ac8', '#7a5232', '#c8a870'],
  },
  {
    id: 'fantasy',
    label: 'Metal & magic',
    colors: ['#dfe4ec', '#a8b0bc', '#6a7282', '#3c424e', '#f2c43c', '#b8861c', '#c8743c', '#7a4a24', '#3ad07a', '#5ae0e0', '#60a8ff', '#a06ae0', '#ff5ab4', '#ff7a2a', '#ffe66a', '#1a0f2e'],
  },
];
