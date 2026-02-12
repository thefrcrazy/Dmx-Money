import { motion } from "framer-motion";

export function GlassCard({ children, className = "", delay = 0 }: { children: React.ReactNode, className?: string, delay?: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.6 }}
      className={`relative group bg-white/[0.01] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-3xl transition-all duration-500 hover:bg-white/[0.03] hover:border-white/20 text-slate-400 ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      {children}
    </motion.div>
  );
}
