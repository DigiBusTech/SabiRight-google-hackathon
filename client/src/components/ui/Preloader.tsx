import { motion } from "framer-motion";

export const Preloader = () => {
  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
    >
      <div className="relative mb-8">
        {/* Modern Pulse Effect */}
        <motion.div
          className="absolute -inset-8 rounded-full bg-primary/10"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        
        {/* Animated Rings */}
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute -inset-4 rounded-full border border-primary/20"
            animate={{ rotate: 360 }}
            transition={{
              duration: 2 + i,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}

        {/* Logo/Icon */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ 
            scale: [1, 1.05, 1],
            opacity: 1 
          }}
          transition={{
            scale: {
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            },
            opacity: {
              duration: 0.5
            }
          }}
          className="relative h-20 w-20 bg-white rounded-[2rem] shadow-2xl flex items-center justify-center p-4 border border-slate-100 overflow-hidden"
        >
          <motion.img 
            src="/assets/sabiright-icon.png" 
            alt="SabiRight" 
            className="w-full h-full object-contain"
            animate={{
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div 
            className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent"
            animate={{
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
      </div>

      {/* Loading Text with Shimmer */}
      <div className="relative">
        <motion.h2 
          className="text-2xl font-black tracking-tighter text-slate-900 flex items-center gap-1"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Sabi<span className="text-primary">Right</span>
        </motion.h2>
        <motion.div 
          className="h-1 w-full bg-slate-100 rounded-full mt-2 overflow-hidden"
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ delay: 0.5, duration: 1.5 }}
        >
          <motion.div 
            className="h-full bg-primary"
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
};
