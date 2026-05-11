/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Users, ArrowRight, User as UserIcon, Rocket, Key, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createMultiplayerGame, joinMultiplayerGame } from '../services/multiplayerService';
import { updateProfile } from 'firebase/auth';
import { auth, signInWithGoogle, signInAnon } from '../firebase';

interface MultiplayerLobbyProps {
  onGameCreated: (gameId: string) => void;
  onGameJoined: (gameId: string) => void;
  onSinglePlayer: () => void;
}

export default function MultiplayerLobby({ onGameCreated, onGameJoined, onSinglePlayer }: MultiplayerLobbyProps) {
  const { user, loading } = useAuth();
  const [joinId, setJoinId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');
  const [showGoogleFallback, setShowGoogleFallback] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    setError('');
    try {
      const name = user?.displayName || playerName || 'Viajante';
      const id = await createMultiplayerGame(name);
      if (id) {
        onGameCreated(id);
      } else {
        setError('Não foi possível gerar um ID de jogo.');
      }
    } catch (err: any) {
      setError(`Falha ao criar o jogo: ${err.message || 'Erro desconhecido'}`);
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!joinId) return;
    setIsJoining(true);
    setError('');
    try {
      const name = user?.displayName || playerName || 'Viajante';
      await joinMultiplayerGame(joinId, name);
      onGameJoined(joinId);
    } catch (err: any) {
      let msg = 'Falha ao entrar no jogo';
      try {
        const parsed = JSON.parse(err.message);
        msg = parsed.error || msg;
      } catch (e) {
        msg = err.message || msg;
      }
      setError(msg);
    } finally {
      setIsJoining(false);
    }
  };

  const handleStart = async (method: 'anon' | 'google') => {
    if (!playerName.trim() && !user) {
      setError('Por favor, insira um nome');
      return;
    }
    setIsLoggingIn(true);
    setError('');
    try {
      if (method === 'anon') {
        await signInAnon();
      } else {
        await signInWithGoogle();
      }
      
      if (auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, { displayName: playerName || auth.currentUser.displayName || 'Jogador' });
        } catch (profileErr) {
          console.warn('Could not update profile', profileErr);
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const isRestricted = err.message?.includes('admin-restricted-operation') || err.message?.includes('operation-not-allowed');
      if (isRestricted) {
         setError('GUEST LOGIN IS DISABLED. Please use Google Login or enable Anonymous Auth in Firebase Console.');
         setShowGoogleFallback(true);
      } else {
         setError('Authentication failed. Check your connection or use another method.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass p-8 rounded-[40px] max-w-md w-full text-center z-10"
    >
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center rotate-3 border border-blue-500/30">
           <Rocket className="w-8 h-8 text-blue-400 -rotate-45" />
        </div>
      </div>
      
      <h2 className="text-3xl font-serif italic mb-2">Conquista Nebula</h2>
      <p className="text-white/40 text-xs mb-8 tracking-widest uppercase">Domine a Galáxia peça por peça</p>

      {!user ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-white/30 block text-left ml-2">Identificação do Piloto</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value.slice(0, 15))}
                placeholder="SEU NOME"
                className="w-full py-4 pl-12 pr-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-blue-500/50 transition-colors uppercase font-mono tracking-widest"
              />
            </div>
          </div>

          <div className="space-y-3">
            <button 
              disabled={isLoggingIn}
              onClick={() => handleStart('anon')}
              className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] disabled:opacity-50"
            >
              {isLoggingIn && !showGoogleFallback ? <div className="w-5 h-5 border-2 border-white/30 border-t-transparent animate-spin rounded-full" /> : <Rocket className="w-5 h-5" />}
              <span className="text-sm tracking-widest uppercase">Entrar como Convidado</span>
            </button>

            {(showGoogleFallback || true) && (
              <button 
                disabled={isLoggingIn}
                onClick={() => handleStart('google')}
                className="w-full py-4 glass border border-white/10 hover:bg-white/10 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isLoggingIn && showGoogleFallback ? <div className="w-5 h-5 border-2 border-white/30 border-t-transparent animate-spin rounded-full" /> : <Globe className="w-5 h-5" />}
                <span className="text-sm tracking-widest uppercase text-white/70 italic">Entrar com Google</span>
              </button>
            )}
          </div>
          
          <button 
            onClick={onSinglePlayer}
            className="w-full py-4 glass border border-blue-500/10 hover:bg-blue-500/5 text-blue-300/60 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]"
          >
            <Rocket className="w-4 h-4" />
            Jogar Localmente (Offline)
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 glass rounded-2xl mb-8 border border-blue-500/20">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold border border-blue-400/30">
              {user.displayName?.[0] || '?'}
            </div>
            <div className="text-left">
              <div className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Comandante</div>
              <div className="text-sm font-medium tracking-wide">{user.displayName}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button 
              disabled={isCreating}
              onClick={handleCreate}
              className="w-full py-4 bg-white text-cosmic-bg rounded-2xl font-bold transition-all flex items-center justify-center gap-3 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50 group"
            >
              {isCreating ? <div className="w-5 h-5 border-2 border-cosmic-bg border-t-transparent animate-spin rounded-full" /> : <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />}
              <span className="text-sm tracking-widest uppercase">Nova Conquista</span>
            </button>

            <div className="flex gap-2">
              <input 
                value={joinId}
                onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                placeholder="CÓDIGO"
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 text-center font-mono tracking-widest focus:outline-none focus:border-blue-500/30 transition-colors uppercase"
              />
              <button 
                disabled={isJoining}
                onClick={handleJoin}
                className="px-6 py-4 glass hover:bg-white/10 rounded-2xl transition-all disabled:opacity-50"
              >
                {isJoining ? <div className="w-5 h-5 border-2 border-white/30 border-t-transparent animate-spin rounded-full" /> : <Users className="w-5 h-5 text-blue-400" />}
              </button>
            </div>
          </div>

          <p className="text-[10px] text-white/20 italic tracking-widest">Aguardando coordendas estelares...</p>
        </div>
      )}

      {error && <p className="text-emerald-400 text-[10px] mt-6 font-mono bg-emerald-400/5 py-2 rounded-lg border border-emerald-400/10 uppercase tracking-tighter">{error}</p>}
    </motion.div>
  );
}
