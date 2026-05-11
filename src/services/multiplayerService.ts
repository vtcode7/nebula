/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  getDoc, 
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { MultiplayerGame, Player, Deployment, UnitType, ELIXIR_MAX } from '../types';
import { initializeTowers } from '../utils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const createMultiplayerGame = async (playerName: string): Promise<string> => {
  if (!auth.currentUser) throw new Error('User not authenticated');
  
  const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const player1: Player = {
    uid: auth.currentUser.uid,
    elixir: 5,
    lastElixirUpdate: Date.now(),
    name: playerName || 'Rei 1'
  };

  const gameData: any = {
    player1,
    player2: null,
    status: 'waiting',
    deployments: [],
    towers: initializeTowers(),
    createdAt: Date.now(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'games', gameId), gameData);
    return gameId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `games/${gameId}`);
    return '';
  }
};

export const joinMultiplayerGame = async (gameId: string, playerName: string): Promise<void> => {
  if (!auth.currentUser) throw new Error('User not authenticated');
  
  const gameRef = doc(db, 'games', gameId);
  try {
    const gameSnap = await getDoc(gameRef);
    if (!gameSnap.exists()) throw new Error('Arena não encontrada');
    
    const player2: Player = {
      uid: auth.currentUser.uid,
      elixir: 5,
      lastElixirUpdate: Date.now(),
      name: playerName || 'Rei 2'
    };

    await updateDoc(gameRef, {
      player2,
      status: 'playing',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `games/${gameId}`);
  }
};

export const deployCard = async (gameId: string, type: UnitType, x: number, y: number, owner: 1 | 2) => {
  const gameRef = doc(db, 'games', gameId);
  const deployment: Deployment = {
    id: Math.random().toString(36).substring(7),
    type,
    x,
    y,
    owner,
    timestamp: Date.now()
  };

  try {
    await updateDoc(gameRef, {
      deployments: arrayUnion(deployment)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `games/${gameId}`);
  }
};

export const finishGame = async (gameId: string, winner: 1 | 2) => {
  const gameRef = doc(db, 'games', gameId);
  try {
    await updateDoc(gameRef, {
      status: 'finished',
      winner
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `games/${gameId}`);
  }
};

export const subscribeToGame = (gameId: string, onUpdate: (game: MultiplayerGame) => void) => {
  return onSnapshot(doc(db, 'games', gameId), (doc) => {
    if (doc.exists()) {
      onUpdate({ id: doc.id, ...doc.data() } as MultiplayerGame);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `games/${gameId}`);
  });
};
