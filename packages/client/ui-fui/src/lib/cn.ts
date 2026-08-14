import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class values and resolve conflicting Tailwind utilities.
 * @param inputs - Class values accepted by clsx.
 * @returns One normalized class string.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
