/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UnitType, Tower, ARENA_WIDTH, ARENA_HEIGHT } from './types';

export const UNIT_STATS: Record<UnitType, any> = {
  knight: { hp: 1200, damage: 160, speed: 60, range: 30, cost: 3, delay: 1000 },
  archer: { hp: 450, damage: 80, speed: 60, range: 150, cost: 3, delay: 800 },
  giant: { hp: 3000, damage: 200, speed: 40, range: 30, cost: 5, delay: 1500, buildingOnly: true },
  fireball: { hp: 1, damage: 500, speed: 200, range: 50, cost: 4, isSpell: true },
  skeleton: { hp: 100, damage: 50, speed: 70, range: 30, cost: 1, delay: 500 }
};

export const initializeTowers = (): Tower[] => {
  return [
    // Player 1 (Bottom)
    { id: 'p1k', type: 'king', x: ARENA_WIDTH / 2, y: ARENA_HEIGHT - 30, hp: 4000, maxHp: 4000, owner: 1 },
    { id: 'p1l', type: 'princess', x: 60, y: ARENA_HEIGHT - 120, hp: 2500, maxHp: 2500, owner: 1, side: 'left' },
    { id: 'p1r', type: 'princess', x: ARENA_WIDTH - 60, y: ARENA_HEIGHT - 120, hp: 2500, maxHp: 2500, owner: 1, side: 'right' },
    
    // Player 2 (Top)
    { id: 'p2k', type: 'king', x: ARENA_WIDTH / 2, y: 30, hp: 4000, maxHp: 4000, owner: 2 },
    { id: 'p2l', type: 'princess', x: 60, y: 120, hp: 2500, maxHp: 2500, owner: 2, side: 'left' },
    { id: 'p2r', type: 'princess', x: ARENA_WIDTH - 60, y: 120, hp: 2500, maxHp: 2500, owner: 2, side: 'right' }
  ];
};

export const getDistance = (x1: number, y1: number, x2: number, y2: number) => {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};

export const findNearestTarget = (unitX: number, unitY: number, owner: 1 | 2, units: any[], towers: Tower[], buildingsOnly: boolean = false) => {
  let nearest: any = null;
  let minDist = Infinity;

  // Search Towers
  towers.forEach(t => {
    if (t.owner !== owner && t.hp > 0) {
      const d = getDistance(unitX, unitY, t.x, t.y);
      if (d < minDist) {
        minDist = d;
        nearest = { ...t, isTower: true };
      }
    }
  });

  // Search Units
  if (!buildingsOnly) {
    units.forEach(u => {
      if (u.owner !== owner && u.status !== 'dead') {
        const d = getDistance(unitX, unitY, u.x, u.y);
        if (d < minDist) {
          minDist = d;
          nearest = { ...u, isTower: false };
        }
      }
    });
  }

  return nearest;
};
