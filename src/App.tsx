/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { ShieldAlert, RotateCcw, Copy, Check, Info, Trophy, Users, Sword, Target } from 'lucide-react';
import { TileOwner, MultiplayerGame, GRID_SIZE } from './types';
import { initializeGrid, isValidMove, performMove, countTiles, hasValidMoves } from './utils';
import GalaxyBackground from './components/GalaxyBackground';
import MultiplayerLobby from './components/MultiplayerLobby';
import { useAuth } from './contexts/AuthContext';
import { subscribeToGame, updateGameMove } from './services/multiplayerService';
import { auth } from './firebase';

export default function App() {
  const { user } = useAuth();
  const [gameMode, setGameMode] = useState<'lobby' | 'single' | 'multi'>('lobby');
  const [grid, setGrid] = useState<TileOwner[][]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [currentGame, setCurrentGame] = useState<MultiplayerGame | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastMove, setLastMove] = useState<{ x: number, y: number } | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize game
  useEffect(() => {
    setGrid(initializeGrid());
  }, []);

  // Multiplayer Subscription
  useEffect(() => {
    if (gameMode === 'multi' && currentGame?.id) {
      const unsub = subscribeToGame(currentGame.id, (game) => {
        setCurrentGame(game);
        setGrid(game.grid);
        if (game.lastMove) setLastMove(game.lastMove);
        if (game.status === 'finished') setIsGameOver(true);
      });
      return () => unsub();
    }
  }, [gameMode, currentGame?.id]);

  const playSound = useCallback((frequency: number, type: OscillatorType = 'sine', duration: number = 0.1) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }, []);

  const handleTileClick = async (x: number, y: number) => {
    if (isGameOver || (gameMode === 'multi' && (!currentGame || currentGame.status !== 'playing'))) return;

    if (gameMode === 'multi') {
      if (currentGame?.turn !== auth.currentUser?.uid) {
        playSound(100, 'square', 0.1);
        return;
      }
    }

    const playerIndex = (gameMode === 'multi' && currentGame?.player2?.uid === user?.uid) ? 2 : 1;
    
    if (!isValidMove(grid, x, y, playerIndex as 1 | 2)) {
      playSound(150, 'square', 0.05);
      return;
    }

    executeMove(x, y, playerIndex as 1 | 2);
  };

  const executeMove = async (x: number, y: number, playerIndex: 1 | 2) => {
    playSound(400, 'sine', 0.15);
    const newGrid = performMove(grid, x, y, playerIndex);
    setGrid(newGrid);
    setLastMove({ x, y });

    const { p1, p2 } = countTiles(newGrid);
    const nextPlayerIndex = playerIndex === 1 ? 2 : 1;
    
    if (gameMode === 'single') {
      const gameOver = !hasValidMoves(newGrid, 1) && !hasValidMoves(newGrid, 2);
      if (gameOver) {
        setIsGameOver(true);
      } else if (playerIndex === 1) {
        // CPU Turn (Player 2)
        setTimeout(() => cpuMove(newGrid), 600);
      }
    } else if (currentGame) {
      const otherPlayerUid = playerIndex === 1 ? currentGame.player2?.uid : currentGame.player1?.uid;
      const myUid = auth.currentUser?.uid || '';
      
      let nextTurnUid: string | null = null;
      let isGameOverNow = false;

      if (hasValidMoves(newGrid, nextPlayerIndex as 1 | 2)) {
        nextTurnUid = otherPlayerUid || myUid;
      } else if (hasValidMoves(newGrid, playerIndex as 1 | 2)) {
        nextTurnUid = myUid;
      } else {
        isGameOverNow = true;
      }

      await updateGameMove(
        currentGame.id,
        newGrid,
        p1,
        p2,
        nextTurnUid,
        { x, y },
        isGameOverNow
      );
    }
  };

  const cpuMove = (currentGrid: TileOwner[][]) => {
    // Collect all valid moves for CPU (Player 2)
    const validMoves: {x: number, y: number}[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (isValidMove(currentGrid, x, y, 2)) {
          validMoves.push({ x, y });
        }
      }
    }

    if (validMoves.length > 0) {
      // Simple CPU: Pick move that captures most tiles
      let bestMove = validMoves[0];
      let maxCaptures = -1;

      for (const move of validMoves) {
        let captures = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = move.x + dx;
            const ny = move.y + dy;
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
              if (currentGrid[ny][nx] === 1) captures++;
            }
          }
        }
        if (captures > maxCaptures) {
          maxCaptures = captures;
          bestMove = move;
        }
      }

      // Execute CPU move
      const nextGrid = performMove(currentGrid, bestMove.x, bestMove.y, 2);
      setGrid(nextGrid);
      setLastMove({ x: bestMove.x, y: bestMove.y });
      playSound(350, 'sine', 0.1);

      if (!hasValidMoves(nextGrid, 1) && !hasValidMoves(nextGrid, 2)) {
        setIsGameOver(true);
      }
    } else {
      // Pass turn
      if (!hasValidMoves(currentGrid, 1)) {
        setIsGameOver(true);
      }
    }
  };

  const copyId = () => {
    if (currentGame?.id) {
      navigator.clipboard.writeText(currentGame.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isMyTurn = gameMode === 'multi' ? (currentGame?.turn === user?.uid) : true;
  const currentScores = currentGame ? { p1: currentGame.player1?.score || 0, p2: currentGame.player2?.score || 0 } : countTiles(grid);

  if (gameMode === 'lobby') {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center p-4">
        <GalaxyBackground />
        <MultiplayerLobby 
          onGameCreated={(id) => {
            setCurrentGame({ id } as any);
            setGameMode('multi');
          }}
          onGameJoined={(id) => {
            setCurrentGame({ id } as any);
            setGameMode('multi');
          }}
          onSinglePlayer={() => {
            setGrid(initializeGrid());
            setGameMode('single');
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 selection:bg-blue-500/30 overflow-hidden">
      <GalaxyBackground />

      {/* Interface Superior */}
      <div className="fixed top-8 left-8 right-8 flex justify-between items-start z-50">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif italic text-4xl text-white drop-shadow-2xl flex items-center gap-3">
            Nebula <span className="text-white/20 not-italic font-mono text-sm tracking-[0.4em] uppercase">Conquest</span>
          </h1>
        </div>
        
        <button 
          onClick={() => {
            setGameMode('lobby');
            setIsGameOver(false);
            setCurrentGame(null);
            setLastMove(null);
          }}
          className="glass p-3 rounded-xl text-white/40 hover:text-white transition-all active:scale-95 flex items-center gap-2 group"
        >
          <RotateCcw className="w-4 h-4 group-hover:rotate-[-45deg] transition-transform" />
          <span className="text-[10px] uppercase tracking-widest hidden md:inline">Sair</span>
        </button>
      </div>

      <div className="w-full max-w-5xl z-10 flex flex-col lg:flex-row gap-8 items-center justify-center mt-16">
        
        {/* Painel Esquerdo: Jogadores */}
        <div className="flex flex-col gap-4 w-full lg:w-64">
           {/* Jogador 1 */}
           <motion.div 
             animate={{ 
               scale: (gameMode === 'multi' && currentGame?.turn === currentGame?.player1?.uid) ? 1.05 : 1,
               opacity: (gameMode === 'multi' && currentGame?.turn !== currentGame?.player1?.uid) ? 0.5 : 1
             }}
             className={`glass p-6 rounded-3xl border-l-4 border-blue-500 transition-all ${((gameMode === 'multi' && currentGame?.turn === currentGame?.player1?.uid) || (gameMode === 'single')) ? 'shadow-[0_0_30px_rgba(59,130,246,0.2)]' : ''}`}
           >
             <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1 flex items-center gap-2">
               <Target className="w-3 h-3 text-blue-500" />
               {currentGame?.player1?.name || 'Viajante 1'}
             </div>
             <div className="text-4xl font-mono font-bold">{currentScores.p1}</div>
           </motion.div>

           {/* Jogador 2 */}
           <motion.div 
             animate={{ 
               scale: (gameMode === 'multi' && currentGame?.turn === currentGame?.player2?.uid) ? 1.05 : 1,
               opacity: (gameMode === 'multi' && currentGame?.turn !== currentGame?.player2?.uid && currentGame?.status !== 'waiting') ? 0.5 : 1
             }}
             className={`glass p-6 rounded-3xl border-l-4 border-purple-500 transition-all ${(gameMode === 'multi' && currentGame?.turn === currentGame?.player2?.uid) ? 'shadow-[0_0_30px_rgba(139,92,246,0.2)]' : ''}`}
           >
             <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1 flex items-center gap-2">
               <Sword className="w-3 h-3 text-purple-500" />
               {currentGame?.player2?.name || (currentGame?.status === 'waiting' ? 'Aguardando...' : 'Viajante 2')}
             </div>
             <div className="text-4xl font-mono font-bold">{currentScores.p2}</div>
           </motion.div>

           {gameMode === 'multi' && currentGame?.status === 'waiting' && (
             <div className="glass p-4 rounded-2xl flex flex-col items-center gap-2 bg-white/5 border border-white/10 animate-pulse">
               <span className="text-[9px] uppercase tracking-widest text-white/30">Convide um amigo</span>
               <div className="flex items-center gap-3">
                 <span className="font-mono text-lg">{currentGame.id}</span>
                 <button onClick={copyId} className="hover:text-blue-400 transition-colors">
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                 </button>
               </div>
             </div>
           )}
        </div>

        {/* Tabuleiro */}
        <div className="relative group">
          <div className="absolute -inset-8 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none group-hover:bg-blue-500/10 transition-colors duration-1000" />
          
          <div 
            className={`relative glass-dark p-2 md:p-3 rounded-[32px] shadow-2xl border border-white/5 transition-all duration-700 ${!isMyTurn ? 'opacity-80 scale-[0.98]' : 'scale-100'}`}
          >
            <div 
              className="grid gap-1 md:gap-1.5"
              style={{ 
                gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                width: 'clamp(280px, 85vw, 500px)',
                aspectRatio: '1',
                pointerEvents: !isMyTurn ? 'none' : 'auto'
              }}
            >
              {grid.map((row, y) => 
                row.map((owner, x) => (
                  <motion.button
                    key={`${x}-${y}`}
                    whileHover={owner === 0 && isValidMove(grid, x, y, (currentGame?.player2?.uid === user?.uid ? 2 : 1) as 1 | 2) ? { scale: 0.95, backgroundColor: 'rgba(255,255,255,0.05)' } : {}}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleTileClick(x, y)}
                    className={`relative w-full h-full rounded-lg md:rounded-xl transition-all duration-500 overflow-hidden ${
                      lastMove?.x === x && lastMove?.y === y ? 'ring-2 ring-white/20' : ''
                    }`}
                    style={{ 
                      background: owner === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      border: owner === 0 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                    }}
                  >
                    <AnimatePresence mode="popLayout">
                      {owner !== 0 && (
                        <motion.div
                          key={`piece-${owner}`}
                          initial={{ scale: 0, rotate: -45, opacity: 0 }}
                          animate={{ scale: 1, rotate: 0, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className={`absolute inset-1.5 rounded-full shadow-lg ${
                            owner === 1 
                              ? 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/40' 
                              : 'bg-gradient-to-br from-purple-400 to-purple-600 shadow-purple-500/40'
                          }`}
                        >
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.4),transparent)] rounded-full" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {/* Indicador de movimento válido suave */}
                    {owner === 0 && isMyTurn && isValidMove(grid, x, y, (currentGame?.player2?.uid === user?.uid ? 2 : 1) as 1 | 2) && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <div className={`w-2 h-2 rounded-full blur-[2px] ${currentGame?.player2?.uid === user?.uid ? 'bg-purple-500/40' : 'bg-blue-500/40'}`} />
                      </div>
                    )}
                  </motion.button>
                ))
              )}
            </div>

            {/* Game Over Modal Over Tabuleiro */}
            {isGameOver && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl rounded-[32px] p-8 border border-white/10"
              >
                <Trophy className="w-16 h-16 text-yellow-500 mb-4 animate-bounce" />
                <h2 className="text-3xl font-serif italic mb-2">Conquista Final</h2>
                <p className="text-white/40 text-xs mb-8 uppercase tracking-widest">A Galáxia tem um novo mestre</p>
                
                <div className="flex gap-8 mb-12">
                   <div className="text-center">
                     <div className="text-xs text-blue-400 font-mono uppercase mb-1">{currentGame?.player1?.name || 'P1'}</div>
                     <div className="text-4xl font-bold">{currentScores.p1}</div>
                   </div>
                   <div className="text-center">
                     <div className="text-xs text-purple-400 font-mono uppercase mb-1">{currentGame?.player2?.name || 'P2'}</div>
                     <div className="text-4xl font-bold">{currentScores.p2}</div>
                   </div>
                </div>

                <button
                  onClick={() => setGameMode('lobby')}
                  className="px-12 py-4 bg-white text-cosmic-bg rounded-2xl font-bold uppercase tracking-widest text-xs hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all"
                >
                  Voltar ao Lobby
                </button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Info lateral (Desktop) / Inferior (Mobile) */}
        <div className="flex flex-col gap-6 w-full lg:w-64">
           <div className="glass p-6 rounded-3xl">
              <div className="flex items-center gap-3 text-white/40 mb-4">
                <Info className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-widest">Como Jogar</span>
              </div>
              <ul className="space-y-4">
                <li className="flex gap-3 items-start">
                   <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-[10px] font-mono shrink-0">1</div>
                   <p className="text-[10px] text-white/60 leading-relaxed uppercase tracking-tighter">Clique em casas vazias perto das suas para expandir.</p>
                </li>
                <li className="flex gap-3 items-start">
                   <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-[10px] font-mono shrink-0">2</div>
                   <p className="text-[10px] text-white/60 leading-relaxed uppercase tracking-tighter">Seus vizinhos inimigos serão capturados.</p>
                </li>
                <li className="flex gap-3 items-start">
                   <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-[10px] font-mono shrink-0">3</div>
                   <p className="text-[10px] text-white/60 leading-relaxed uppercase tracking-tighter">Conquiste a maior área para vencer.</p>
                </li>
              </ul>
           </div>

           {!isMyTurn && (
             <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="flex items-center gap-3 glass px-4 py-3 rounded-2xl border-white/5"
             >
               <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,1)]" />
               <span className="text-[10px] uppercase tracking-widest text-white/40">Oponente calculando...</span>
             </motion.div>
           )}
        </div>
      </div>

      {/* Footer Decoração */}
      <div className="fixed bottom-8 left-8 right-8 flex justify-between items-center opacity-20 pointer-events-none">
        <div className="flex gap-12 text-[8px] uppercase tracking-[0.4em] font-medium">
          <div>Nebula Conquest v2.0</div>
          <div className="hidden md:block">Tactical Domain Expansion</div>
        </div>
        <div className="flex gap-4">
          <div className="w-1 h-1 bg-white rounded-full" />
          <div className="w-1 h-1 bg-white rounded-full opacity-50" />
          <div className="w-1 h-1 bg-white rounded-full opacity-20" />
        </div>
      </div>
    </div>
  );
}
