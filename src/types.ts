/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TileOwner = 0 | 1 | 2; // 0: empty, 1: player1, 2: player2

export interface Player {
  uid: string;
  name: string;
  score: number;
}

export interface MultiplayerGame {
  id: string;
  grid: TileOwner[][];
  player1: Player | null;
  player2: Player | null;
  turn: string; // UID of current player
  status: 'waiting' | 'playing' | 'finished';
  lastMove?: {
    x: number;
    y: number;
  };
}

export const GRID_SIZE = 8;
