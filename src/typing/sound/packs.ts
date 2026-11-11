import {fantasyPacks, fantasyVoices, isFantasyPack} from './fantasy';
import {isSwitchPack, switchVoices} from './switches';
import type {Voice} from './voice';

export type SwitchSound =
  | 'off'
  | 'linear'
  | 'tactile'
  | 'clicky'
  | 'thock'
  | 'shotgun'
  | 'laser'
  | 'sword'
  | 'anvil'
  | 'magic'
  | 'wardrum'
  | 'typewriter'
  | 'arcade'
  | 'custom';

export type SoundPack = {id: SwitchSound; label: string; hint: string; group: 'off' | 'switch' | 'fantasy' | 'custom'};

/** Every key sound, in menu order. */
export const soundPacks: SoundPack[] = [
  {id: 'off', label: 'Kapalı', hint: 'Ses yok', group: 'off'},
  {id: 'linear', label: 'Lineer', hint: 'Kırmızı, sarı: temiz, yumuşak vuruş', group: 'switch'},
  {id: 'tactile', label: 'Tactile', hint: 'Kahverengi: hafif tümsek, ardından vuruş', group: 'switch'},
  {id: 'clicky', label: 'Tıklı', hint: 'Mavi: keskin klik, bırakırken de', group: 'switch'},
  {id: 'thock', label: 'Tok (thock)', hint: 'Yağlanmış lineer, köpüklü kasa: derin ve yuvarlak', group: 'switch'},
  {id: 'shotgun', label: 'Pompalı tüfek', hint: 'Her tuş bir atış; Boşluk çift namlu, Enter doldurma', group: 'fantasy'},
  {id: 'laser', label: 'Lazer tabancası', hint: 'Her tuş bir “pew”; Boşluk dolu atış, Enter çift atış', group: 'fantasy'},
  {id: 'sword', label: 'Kılıç', hint: 'Çelik çeliğe; Enter kılıcı kınından çeker', group: 'fantasy'},
  {id: 'anvil', label: 'Cüce örsü', hint: 'Örse inen çekiç; Boşluk ağır darbe', group: 'fantasy'},
  {id: 'magic', label: 'Büyü', hint: 'Her tuşun kendi notası; Boşluk ışıltı, Enter akor', group: 'fantasy'},
  {id: 'wardrum', label: 'Savaş davulu', hint: 'Derin davul; Boşluk büyük vuruş, Enter çift vuruş', group: 'fantasy'},
  {id: 'typewriter', label: 'Daktilo', hint: 'Keskin vuruş; Enter zil ve satır başı', group: 'fantasy'},
  {id: 'arcade', label: '8-bit', hint: 'Atari sesleri; Boşluk jeton, Enter arpej', group: 'fantasy'},
  {id: 'custom', label: 'Kendi sesim', hint: 'Yüklediğin ses dosyası her tuşta çalar', group: 'custom'},
];

/** Kept for the menu, which lists every pack. */
export const switchSounds = soundPacks;

/**
 * The layers to play for a key; `rand` adds the small difference between two presses. Silent for `off`,
 * `custom` (a recording, not layers) and names this version doesn't know, e.g. from a newer device.
 */
export const voicesFor = (sound: SwitchSound, phase: 'press' | 'release', key: string, rand: () => number = Math.random): Voice[] =>
  isSwitchPack(sound) ? switchVoices(sound, phase, key, rand) : isFantasyPack(sound) ? fantasyVoices(sound, phase, key, rand) : [];

/** How a pack is mixed: its overall level and the share sent to the shared reverb. */
export const mixFor = (sound: SwitchSound): {level: number; wet: number} =>
  isFantasyPack(sound) ? {level: fantasyPacks[sound].level, wet: fantasyPacks[sound].wet} : {level: 1, wet: 0};
