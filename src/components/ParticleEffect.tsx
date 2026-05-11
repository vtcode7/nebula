/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  vx: number;
  vy: number;
}

interface ParticleEffectProps {
  x: number;
  y: number;
  color: string;
  onComplete: () => void;
}

export default function ParticleEffect({ x, y, color, onComplete }: ParticleEffectProps) {
  const particles: Particle[] = Array.from({ length: 8 }).map((_, i) => ({
    id: i,
    x,
    y,
    color,
    size: Math.random() * 4 + 2,
    vx: (Math.random() - 0.5) * 200,
    vy: (Math.random() - 0.5) * 200,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: p.x, y: p.y, opacity: 1, scale: 1 }}
          animate={{ 
            x: p.x + p.vx, 
            y: p.y + p.vy, 
            opacity: 0, 
            scale: 0 
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          onAnimationComplete={p.id === 0 ? onComplete : undefined}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 10px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}
