/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GRID_SIZE, TileOwner } from './types';

export const initializeGrid = (): TileOwner[][] => {
  const grid: TileOwner[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  
  // Posições iniciais (Cornas)
  grid[0][0] = 1;
  grid[GRID_SIZE - 1][GRID_SIZE - 1] = 1;
  grid[0][GRID_SIZE - 1] = 2;
  grid[GRID_SIZE - 1][0] = 2;
  
  return grid;
};

export const isValidMove = (grid: TileOwner[][], x: number, y: number, player: 1 | 2): boolean => {
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return false;
  if (grid[y][x] !== 0) return false;
  
  // Must be within distance 2 of at least one of player's pieces
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
        if (grid[ny][nx] === player) return true;
      }
    }
  }
  return false;
};

export const performMove = (grid: TileOwner[][], x: number, y: number, player: 1 | 2): TileOwner[][] => {
  const newGrid = grid.map(row => [...row]);
  const otherPlayer = player === 1 ? 2 : 1;

  // Determine if it was a jump or a clone
  // We look for any piece within distance 1 to clone. If none, we look for distance 2 to jump.
  // Actually, in standard Ataxx, you can pick which piece to jump/clone with.
  // Since our UI is "click to place", we need to decide if we should jump or clone.
  // Convention: If distance 1 exists, it's a clone. If only distance 2 exists, it's a jump.
  // But wait, the standard UI usually involves selecting a piece then selecting a target.
  // For simplicity (click-to-place):
  // - If any player piece is adjacent (dist 1): Clone.
  // - If no player piece is adjacent BUT one is within distance 2: Jump (one existing piece at dist 2 disappears).
  
  let isClone = false;
  let sourcePiece: {x: number, y: number} | null = null;

  // Check for any adjacent piece to clone
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
        if (grid[ny][nx] === player) {
          isClone = true;
          break;
        }
      }
    }
    if (isClone) break;
  }

  if (!isClone) {
    // It's a jump. In a simplified click-to-move, we find the closest piece at distance 2.
    // To be precise, our isValidMove already checked that one exists.
    outer: for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
          if (grid[ny][nx] === player) {
            // Check if this piece is actually at distance 2 (not 1)
            const dist = Math.max(Math.abs(dx), Math.abs(dy));
            if (dist === 2) {
              sourcePiece = { x: nx, y: ny };
              break outer;
            }
          }
        }
      }
    }
    
    if (sourcePiece) {
      newGrid[sourcePiece.y][sourcePiece.x] = 0;
    } else {
      // Fallback: if we somehow got here without a dist 2 piece, just clone from first available dist 1
      // (This shouldn't happen with valid move checks)
    }
  }

  // Place new piece
  newGrid[y][x] = player;

  // Capture adjacent enemies
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
        if (newGrid[ny][nx] === otherPlayer) {
          newGrid[ny][nx] = player;
        }
      }
    }
  }

  return newGrid;
};

export const countTiles = (grid: TileOwner[][]) => {
  let p1 = 0;
  let p2 = 0;
  grid.forEach(row => row.forEach(tile => {
    if (tile === 1) p1++;
    if (tile === 2) p2++;
  }));
  return { p1, p2 };
};

export const hasValidMoves = (grid: TileOwner[][], player: 1 | 2): boolean => {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (isValidMove(grid, x, y, player)) return true;
    }
  }
  return false;
};

export const flattenGrid = (grid: TileOwner[][]): TileOwner[] => {
  return grid.flat();
};

export const expandGrid = (flatGrid: TileOwner[]): TileOwner[][] => {
  const grid: TileOwner[][] = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    grid.push(flatGrid.slice(i * GRID_SIZE, (i + 1) * GRID_SIZE));
  }
  return grid;
};
