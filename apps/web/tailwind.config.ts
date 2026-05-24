import type { Config } from 'tailwindcss';
import { tailwindPreset } from '@moajoa/ui-tokens/tailwind';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [tailwindPreset as unknown as Config],
};

export default config;
