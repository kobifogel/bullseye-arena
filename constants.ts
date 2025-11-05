
import { Theme, ThemeType, SoundEffect } from './types';

export const MAX_GUESSES = 10;
export const CODE_LENGTH = 4;

export const SOUNDS: Record<SoundEffect, string> = {
  click: 'https://actions.google.com/sounds/v1/ui/button_press.ogg',
  hit: 'https://actions.google.com/sounds/v1/impacts/sharp_impact.ogg',
  bull: 'https://actions.google.com/sounds/v1/cartoon/magic_chime.ogg',
  win: 'https://actions.google.com/sounds/v1/jingles/jingle_win_01.ogg',
};

export const THEMES: Record<ThemeType, Theme> = {
  numbers: {
    name: 'מספרים',
    items: ['1', '2', '3', '4', '5', '6', '7', '8'],
  },
  colors: {
    name: 'צבעים',
    items: [
      '#ef4444', // red-500
      '#f97316', // orange-500
      '#eab308', // yellow-500
      '#22c55e', // green-500
      '#3b82f6', // blue-500
      '#8b5cf6', // violet-500
      '#ec4899', // pink-500
      '#f4f4f5', // zinc-100
    ],
  },
  animals: {
    name: 'חיות',
    items: ['🐶', '🐱', '🦊', '🦁', '🐸', '🐵', '🦄', '🐲'],
  },
};