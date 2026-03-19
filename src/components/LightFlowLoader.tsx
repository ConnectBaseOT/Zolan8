import { motion } from 'motion/react';

export function LightFlowLoader() {
  return (
    <div className="relative w-full h-1 bg-white/5 rounded-full overflow-hidden my-2">
      <motion.div
        className="absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-indigo-400 to-transparent"
        animate={{
          x: ['-100%', '300%'],
        }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: "linear",
        }}
      />
      <motion.div
        className="absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-transparent via-purple-400 to-transparent"
        animate={{
          x: ['-100%', '200%'],
        }}
        transition={{
          repeat: Infinity,
          duration: 2,
          ease: "linear",
          delay: 0.5
        }}
      />
      <motion.div
        className="absolute top-0 left-0 h-full w-1/4 bg-gradient-to-r from-transparent via-pink-400 to-transparent"
        animate={{
          x: ['-100%', '400%'],
        }}
        transition={{
          repeat: Infinity,
          duration: 1.2,
          ease: "linear",
          delay: 0.2
        }}
      />
    </div>
  );
}
