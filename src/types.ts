/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UnitType = 'knight' | 'archer' | 'giant' | 'fireball' | 'skeleton';

export interface Player {
  uid: string;
  name: string;
  elixir: number;
  lastElixirUpdate: number;
}

export interface Unit {
  id: string;
  type: UnitType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  owner: 1 | 2;
  createdAt: number;
  lane: 'left' | 'right';
  status: 'walking' | 'attacking' | 'dead';
}

export interface Tower {
  id: string;
  type: 'king' | 'princess';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  owner: 1 | 2;
  side?: 'left' | 'right';
}

export interface Deployment {
  id: string;
  type: UnitType;
  x: number;
  y: number;
  owner: 1 | 2;
  timestamp: number;
}

export interface MultiplayerGame {
  id: string;
  player1: Player | null;
  player2: Player | null;
  status: 'waiting' | 'playing' | 'finished';
  deployments: Deployment[];
  towers: Tower[];
  createdAt: number;
  winner?: 1 | 2;
}

export const ARENA_WIDTH = 300;
export const ARENA_HEIGHT = 500;
export const ELIXIR_MAX = 10;
export const ELIXIR_REGEN_RATE = 0.5; // Elixir per second
