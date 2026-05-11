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
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { MultiplayerGame, Player, TileOwner } from '../types';
import { initializeGrid, flattenGrid, expandGrid } from '../utils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const createMultiplayerGame = async (playerName: string): Promise<string> => {
  if (!auth.currentUser) throw new Error('User not authenticated');
  
  const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const player1: Player = {
    uid: auth.currentUser.uid,
    score: 0,
    name: playerName || 'Jogador 1'
  };

  const gameData = {
    grid: flattenGrid(initializeGrid()),
    player1,
    player2: null,
    turn: auth.currentUser.uid,
    status: 'waiting',
    createdAt: serverTimestamp(),
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
    if (!gameSnap.exists()) throw new Error('Jogo não encontrado');
    
    const gameData = gameSnap.data();
    if (gameData.status !== 'waiting') throw new Error('O jogo já começou ou terminou');
    if (gameData.player1.uid === auth.currentUser.uid) throw new Error('Você já está neste jogo');

    const player2: Player = {
      uid: auth.currentUser.uid,
      score: 0,
      name: playerName || 'Jogador 2'
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

export const updateGameMove = async (
  gameId: string, 
  newGrid: TileOwner[][], 
  p1Score: number,
  p2Score: number,
  nextTurnUid: string | null,
  lastMove: { x: number, y: number },
  isGameOver: boolean = false
) => {
  const gameRef = doc(db, 'games', gameId);
  try {
    const updatePayload: any = {
      grid: flattenGrid(newGrid),
      'player1.score': p1Score,
      'player2.score': p2Score,
      updatedAt: serverTimestamp(),
      lastMove
    };

    if (nextTurnUid) {
      updatePayload.turn = nextTurnUid;
    }
    
    if (isGameOver) {
      updatePayload.status = 'finished';
    }

    await updateDoc(gameRef, updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `games/${gameId}`);
  }
};

export const subscribeToGame = (gameId: string, onUpdate: (game: MultiplayerGame) => void) => {
  return onSnapshot(doc(db, 'games', gameId), (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      const game: MultiplayerGame = {
        ...data,
        id: doc.id,
        grid: expandGrid(data.grid)
      } as MultiplayerGame;
      onUpdate(game);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `games/${gameId}`);
  });
};
