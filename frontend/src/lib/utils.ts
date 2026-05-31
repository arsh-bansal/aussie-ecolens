import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function slugToLabel(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ACCEPTED_MIME_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
  'video/webm': ['.webm'],
};

export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;

export const AUSTRALIAN_SPECIES = [
  'koala', 'kangaroo', 'wombat', 'wallaby', 'quokka',
  'echidna', 'platypus', 'dingo', 'tasmanian_devil', 'cassowary',
  'emu', 'kookaburra', 'cockatoo', 'galah', 'lorikeet',
  'magpie', 'rosella', 'wedge_tailed_eagle', 'pelican', 'fairy_penguin',
  'saltwater_crocodile', 'freshwater_crocodile', 'eastern_brown_snake',
  'taipan', 'tiger_snake', 'blue_tongue_lizard', 'frilled_neck_lizard',
  'thorny_devil', 'goanna', 'gecko', 'flying_fox', 'sugar_glider',
  'numbat', 'bilby', 'bettong', 'potoroo', 'bandicoot',
  'possum', 'glider', 'tree_kangaroo', 'dugong', 'sea_turtle',
  'dolphin', 'whale', 'human',
];
