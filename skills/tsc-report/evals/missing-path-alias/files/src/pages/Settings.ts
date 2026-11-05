import { getJson } from '@/lib/http';

interface Settings {
  theme: 'light' | 'dark';
}

export async function loadSettings(): Promise<Settings> {
  const settings = await getJson<Settings>('/api/settings');
  return { ...settings, theme: 'blue' };
}

export const retries: number = 'three';
