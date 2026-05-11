/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';

export default function GalaxyBackground() {
  const stars = Array.from({ length: 120 }).map((_, i) => ({
    id: i,
    size: Math.random() * 2 + 0.5,
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: Math.random() * 5,
    duration: Math.random() * 4 + 3,
  }));

  const nebulas = [
    { color: 'rgba(139, 92, 246, 0.1)', x: '10%', y: '20%', size: '60vw' },
    { color: 'rgba(59, 130, 246, 0.08)', x: '70%', y: '60%', size: '55vw' },
    { color: 'rgba(236, 72, 153, 0.06)', x: '40%', y: '40%', size: '70vw' },
  ];

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-cosmic-bg pointer-events-none">
      {/* Nebulas */}
      {nebulas.map((n, i) => (
        <motion.div
          key={`nebula-${i}`}
          className="absolute rounded-full blur-[120px]"
          animate={{
            x: [0, 50, -50, 0],
            y: [0, -30, 30, 0],
            scale: [1, 1.2, 0.8, 1],
          }}
          transition={{
            duration: 25 + i * 5,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            backgroundColor: n.color,
            left: n.x,
            top: n.y,
            width: n.size,
            height: n.size,
          }}
        />
      ))}

      {/* Stars */}
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white"
          initial={{ opacity: 0.2, scale: 0.5 }}
          animate={{
            opacity: [0.1, 0.6, 0.1],
            scale: [0.6, 1.2, 0.6],
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            delay: star.delay,
            ease: "easeInOut",
          }}
          style={{
            width: star.size,
            height: star.size,
            left: `${star.x}%`,
            top: `${star.y}%`,
            boxShadow: star.size > 1.5 ? '0 0 8px rgba(255, 255, 255, 0.6)' : 'none',
          }}
        />
      ))}

      {/* Vignette */}
      <div className="absolute inset-0 bg-radial-[circle_at_center,_transparent_0%,_#050616_90%] opacity-80" />
      
      {/* Scanline overlay */}
      <div className="absolute inset-0 scanline pointer-events-none" />
    </div>
  );
}
