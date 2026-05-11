/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sword, 
  Target, 
  Crown, 
  Flame, 
  Skull, 
  User, 
  Shield, 
  Zap,
  RotateCcw,
  Trophy,
  ArrowRight
} from 'lucide-react';
import { 
  MultiplayerGame, 
  UnitType, 
  Unit, 
  Tower, 
  ARENA_WIDTH, 
  ARENA_HEIGHT, 
  ELIXIR_MAX, 
  ELIXIR_REGEN_RATE 
} from './types';
import { initializeTowers, UNIT_STATS, getDistance, findNearestTarget } from './utils';
import GalaxyBackground from './components/GalaxyBackground';
import MultiplayerLobby from './components/MultiplayerLobby';
import { useAuth } from './contexts/AuthContext';
import { subscribeToGame, deployCard, finishGame } from './services/multiplayerService';
import { auth } from './firebase';

export default function App() {
  const { user } = useAuth();
  const [gameMode, setGameMode] = useState<'lobby' | 'multi'>('lobby');
  const [currentGame, setCurrentGame] = useState<MultiplayerGame | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [elixir, setElixir] = useState(5);
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState<1 | 2 | null>(null);
  
  const lastUpdateRef = useRef<number>(Date.now());
  const simulationRef = useRef<number | null>(null);

  // Cards in Hand
  const DECK: UnitType[] = ['knight', 'archer', 'giant', 'skeleton', 'fireball'];
  const [hand, setHand] = useState<UnitType[]>(DECK.slice(0, 4));
  const [nextCard, setNextCard] = useState<UnitType>(DECK[4]);
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);

  // Initialize towers
  useEffect(() => {
    setTowers(initializeTowers());
  }, []);

  // Multiplayer Subscription
  useEffect(() => {
    if (gameMode === 'multi' && currentGame?.id) {
      const unsub = subscribeToGame(currentGame.id, (game) => {
        setCurrentGame(game);
        if (game.status === 'finished') {
          setIsGameOver(true);
          setWinner(game.winner || null);
        }
      });
      return () => unsub();
    }
  }, [gameMode, currentGame?.id]);

  // Main Simulation Loop
  const tick = useCallback(() => {
    if (isGameOver || !currentGame || currentGame.status !== 'playing') return;

    const now = Date.now();
    const dt = (now - lastUpdateRef.current) / 1000;
    lastUpdateRef.current = now;

    // 1. Regen Elixir
    setElixir(prev => Math.min(ELIXIR_MAX, prev + ELIXIR_REGEN_RATE * dt));

    // 2. Process Deployments (Simplified: add to local units if not already there)
    if (currentGame.deployments) {
      setUnits(prevUnits => {
        const newUnits = [...prevUnits];
        currentGame.deployments.forEach(d => {
          if (!newUnits.find(u => u.id === d.id)) {
            const stats = UNIT_STATS[d.type];
            newUnits.push({
              id: d.id,
              type: d.type,
              x: d.x,
              y: d.y,
              hp: stats.hp,
              maxHp: stats.hp,
              owner: d.owner,
              createdAt: d.timestamp,
              lane: d.x < ARENA_WIDTH / 2 ? 'left' : 'right',
              status: 'walking'
            });
          }
        });

        // 3. Update Unit Logic (Basic AI)
        const updatedUnits = newUnits.map(u => {
          if (u.status === 'dead') return u;

          const stats = UNIT_STATS[u.type];
          const target = findNearestTarget(u.x, u.y, u.owner, newUnits, towers, stats.buildingOnly);

          if (!target) return u;

          const dist = getDistance(u.x, u.y, target.x, target.y);

          if (dist <= stats.range) {
            // Attack
            u.status = 'attacking';
            // In a real game, we'd handle damage over time/animation intervals.
            // Simplified: constant damage per tick
            const damage = stats.damage * dt; // Adjust damage for frame rate
            if (target.isTower) {
              setTowers(prevTowers => prevTowers.map(t => t.id === target.id ? { ...t, hp: Math.max(0, t.hp - damage) } : t));
            } else {
              // Damage another unit
              const targetUnit = newUnits.find(tu => tu.id === target.id);
              if (targetUnit) {
                targetUnit.hp -= damage;
                if (targetUnit.hp <= 0) targetUnit.status = 'dead';
              }
            }
          } else {
            // Move towards target
            u.status = 'walking';
            const dx = target.x - u.x;
            const dy = target.y - u.y;
            const angle = Math.atan2(dy, dx);
            u.x += Math.cos(angle) * stats.speed * dt;
            u.y += Math.sin(angle) * stats.speed * dt;
          }

          return u;
        }).filter(u => u.hp > 0);

        return updatedUnits;
      });
    }

    // 4. Check Win Condition (King Tower Dead)
    towers.forEach(t => {
      if (t.type === 'king' && t.hp <= 0 && !isGameOver) {
        const winnerId = t.owner === 1 ? 2 : 1;
        setIsGameOver(true);
        setWinner(winnerId);
        finishGame(currentGame.id, winnerId);
      }
    });

    simulationRef.current = requestAnimationFrame(tick);
  }, [currentGame, isGameOver, towers]);

  useEffect(() => {
    simulationRef.current = requestAnimationFrame(tick);
    return () => {
      if (simulationRef.current) cancelAnimationFrame(simulationRef.current);
    };
  }, [tick]);

  const handleArenaClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentGame || currentGame.status !== 'playing' || selectedCardIdx === null) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const myPlayerIdx = currentGame.player1?.uid === user?.uid ? 1 : 2;
    
    // Deployment constraints (Can only deploy on your side)
    const isValidSide = myPlayerIdx === 1 ? y > ARENA_HEIGHT / 2 + 50 : y < ARENA_HEIGHT / 2 - 50;
    if (!isValidSide) return;

    const type = hand[selectedCardIdx];
    const cost = UNIT_STATS[type].cost;

    if (elixir >= cost) {
      setElixir(prev => prev - cost);
      await deployCard(currentGame.id, type, x, y, myPlayerIdx);
      
      // Rotate Hand
      const newHand = [...hand];
      const played = newHand[selectedCardIdx];
      newHand[selectedCardIdx] = nextCard;
      setNextCard(played); // Simple rotation
      setHand(newHand);
      setSelectedCardIdx(null);
    }
  };

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
            // Future: Single Player CPU logic
          }}
        />
      </div>
    );
  }

  const myPlayerIdx = currentGame?.player1?.uid === user?.uid ? 1 : 2;

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-[#0a0a0c] overflow-hidden selection:none">
      <GalaxyBackground />

      {/* Header Info */}
      <div className="fixed top-4 left-4 right-4 flex justify-between items-center z-50">
        <button 
          onClick={() => {
            setGameMode('lobby');
            setIsGameOver(false);
          }}
          className="glass p-3 rounded-xl text-white/40 hover:text-white transition-all flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-[10px] uppercase tracking-widest">Abandonar</span>
        </button>

        <div className="glass px-6 py-2 rounded-full border border-white/5 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${currentGame?.status === 'playing' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-amber-500 animate-pulse'}`} />
            <span className="text-[9px] uppercase tracking-[0.2em] text-white/60">
              {currentGame?.status === 'waiting' ? 'Aguardando Oponente' : 'Batalha em Curso'}
            </span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-[10px] font-mono font-bold text-blue-400">ID: {currentGame?.id}</span>
        </div>
      </div>

      <div className="relative flex flex-col items-center mt-12 mb-32 group">
        {/* Arena Glow */}
        <div className="absolute -inset-20 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none transition-opacity duration-1000" />
        
        {/* The Arena */}
        <div 
          onClick={handleArenaClick}
          className="relative glass-dark rounded-[40px] border border-white/10 overflow-hidden shadow-2xl curse-crosshair"
          style={{ width: ARENA_WIDTH, height: ARENA_HEIGHT }}
        >
          {/* Lane Decoration */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-24 bg-gradient-to-b from-transparent via-blue-500/5 to-transparent flex items-center justify-center opacity-30">
             <div className="w-full h-[1px] bg-white/10" />
          </div>

          {/* River */}
          <div className="absolute top-1/2 -translate-y-1/2 w-full h-12 bg-[#1a1a2e] border-y border-white/5 overflow-hidden">
             {/* Bridges */}
             <div className="absolute left-10 w-16 h-full bg-[#2a2a44] border-x border-white/10" />
             <div className="absolute right-10 w-16 h-full bg-[#2a2a44] border-x border-white/10" />
          </div>

          {/* Towers */}
          {towers.map(t => (
            <div 
              key={t.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500 ${t.hp <= 0 ? 'opacity-20 grayscale' : 'opacity-100'}`}
              style={{ left: t.x, top: t.y }}
            >
              <div className={`relative p-2 rounded-xl flex flex-col items-center gap-1 ${t.owner === myPlayerIdx ? 'text-blue-400' : 'text-rose-400'}`}>
                {t.type === 'king' ? <Crown className="w-8 h-8 drop-shadow-lg" /> : <Shield className="w-6 h-6 drop-shadow-lg" />}
                
                {/* HP Bar */}
                <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <motion.div 
                    initial={false}
                    animate={{ width: `${(t.hp / t.maxHp) * 100}%` }}
                    className={`h-full ${t.owner === myPlayerIdx ? 'bg-blue-500' : 'bg-rose-500'}`} 
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Units */}
          <AnimatePresence>
            {units.map(u => (
               <motion.div
                 key={u.id}
                //  initial={false} // Use false to prevent flashes when state updates fast
                 animate={{ left: u.x, top: u.y }}
                 transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                 className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
               >
                 <div className={`flex flex-col items-center gap-1 ${u.owner === myPlayerIdx ? 'text-blue-500' : 'text-rose-500'}`}>
                    <div className="relative glass p-1.5 rounded-lg border border-white/10 shadow-lg scale-90">
                      {u.type === 'knight' && <Sword className="w-4 h-4" />}
                      {u.type === 'archer' && <Target className="w-4 h-4" />}
                      {u.type === 'giant' && <User className="w-6 h-6" />}
                      {u.type === 'skeleton' && <Skull className="w-3 h-3" />}
                      {u.type === 'fireball' && <Flame className="w-5 h-5 text-orange-500 animate-pulse" />}
                    </div>
                    {/* HP Bar Mini */}
                    <div className="w-6 h-0.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${u.owner === myPlayerIdx ? 'bg-blue-400' : 'bg-rose-400'}`} style={{ width: `${(u.hp / u.maxHp) * 100}%` }} />
                    </div>
                 </div>
               </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Win Screen */}
        {isGameOver && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl rounded-[40px] border border-white/10 p-8"
          >
            <Trophy className={`w-20 h-20 mb-6 animate-bounce ${winner === myPlayerIdx ? 'text-yellow-500' : 'text-white/20'}`} />
            <h2 className="text-4xl font-serif italic mb-2 tracking-wide">
              {winner === myPlayerIdx ? 'VITÓRIA' : 'DERROTA'}
            </h2>
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/40 mb-12">Fim da Batalha na Nebula</p>
            
            <button
              onClick={() => setGameMode('lobby')}
              className="px-12 py-4 bg-white text-black font-bold uppercase tracking-widest text-[10px] rounded-2xl hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)]"
            >
              Retornar à Base
            </button>
          </motion.div>
        )}
      </div>

      {/* Controller (Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 h-32 glass border-t border-white/5 z-50 flex flex-col items-center justify-center px-4 gap-2">
        {/* Elixir Bar */}
        <div className="w-full max-w-sm flex items-center gap-4">
           <Zap className="w-4 h-4 text-purple-400 fill-purple-400" />
           <div className="flex-1 h-3 glass rounded-full overflow-hidden border border-white/5 p-0.5">
             <motion.div 
               className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full flex items-center justify-end px-2"
               style={{ width: `${(elixir / ELIXIR_MAX) * 100}%` }}
             >
               <span className="text-[8px] font-bold text-white/80 drop-shadow-md">{Math.floor(elixir)}</span>
             </motion.div>
           </div>
        </div>

        {/* Cards */}
        <div className="flex gap-3 h-20 items-end">
          {hand.map((card, idx) => (
            <motion.button
              key={`${card}-${idx}`}
              whileHover={{ y: -10, scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCardIdx(idx)}
              disabled={elixir < UNIT_STATS[card].cost}
              className={`relative w-20 h-24 glass rounded-xl border flex flex-col items-center justify-between p-2 transition-all group ${
                selectedCardIdx === idx ? 'border-blue-500 ring-2 ring-blue-500/40 bg-blue-500/10' : 'border-white/10 hover:border-white/30'
              } ${elixir < UNIT_STATS[card].cost ? 'opacity-40 grayscale' : 'opacity-100'}`}
            >
              <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-purple-600 border border-white/20 flex items-center justify-center text-[10px] font-bold shadow-lg z-10 group-hover:scale-110 transition-transform">
                {UNIT_STATS[card].cost}
              </div>
              <div className="flex-1 flex items-center justify-center">
                {card === 'knight' && <Sword className="w-8 h-8 text-white/80" />}
                {card === 'archer' && <Target className="w-8 h-8 text-white/80" />}
                {card === 'giant' && <User className="w-10 h-10 text-white/80 shadow-2xl" />}
                {card === 'skeleton' && <Skull className="w-6 h-6 text-white/60" />}
                {card === 'fireball' && <Flame className="w-8 h-8 text-orange-500" />}
              </div>
              <span className="text-[7px] uppercase tracking-widest text-white/40 group-hover:text-white/70 transition-colors">{card}</span>
            </motion.button>
          ))}
          
          {/* Next Card Preview */}
          <div className="w-12 h-16 glass border border-white/5 rounded-lg flex flex-col items-center justify-center opacity-30 scale-90 ml-4">
             <span className="text-[6px] uppercase text-white/60 mb-1">Próx</span>
             {nextCard === 'knight' && <Sword className="w-5 h-5" />}
             {nextCard === 'archer' && <Target className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* Deployment Helper Label */}
      <AnimatePresence>
        {selectedCardIdx !== null && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-36 left-1/2 -translate-x-1/2 px-4 py-2 glass rounded-full border border-blue-500/40 text-[10px] uppercase tracking-widest text-blue-400 animate-pulse pointer-events-none"
          >
            Escolha o local na arena para posicionar {hand[selectedCardIdx]}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
