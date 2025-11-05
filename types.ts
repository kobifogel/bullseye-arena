export type GameMode = 'pvc' | 'pvp_local' | 'pvp_online';
export type ThemeType = 'numbers' | 'colors' | 'animals';
export type PlayerRole = 'setter' | 'guesser';
export type SoundEffect = 'click' | 'bull' | 'hit' | 'win';

export interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
}

export interface Feedback {
  bulls: number;
  hits: number;
}

export interface Turn {
  guess: string[];
  feedback: Feedback;
}

export interface Theme {
    name: string;
    items: string[];
}