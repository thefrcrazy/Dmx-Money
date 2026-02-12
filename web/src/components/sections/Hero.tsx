import { motion } from "framer-motion";
import { Apple, Monitor, Terminal, Loader2 } from "lucide-react";
import { DownloadButton } from "../ui/DownloadButton";
import { useGitHubRelease } from "../../hooks/useGitHubRelease";

export function Hero() {
  const { version, isLoading } = useGitHubRelease();

  return (
    <section className="pt-48 pb-32 px-6 text-center relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1000px] bg-[radial-gradient(circle_at_50%_20%,rgba(212,175,55,0.08),transparent_50%)] pointer-events-none"></div>
      
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-12 shadow-2xl backdrop-blur-md italic"
        >
          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(212,175,55,1)]"></span>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 size={10} className="animate-spin" />
              <span>Récupération...</span>
            </div>
          ) : (
            `Version Stable v${version}`
          )}
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[56px] md:text-[110px] font-black text-white tracking-[-0.05em] leading-[0.9] mb-12 italic uppercase"
        >
          Liberté Financière <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 not-italic">En local.</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed font-bold mb-16 italic"
        >
          Pas de cloud. Pas de traceurs. Juste une performance native brute propulsée par <span className="text-slate-200">Rust</span>. Possédez vos données, maîtrisez votre futur.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col items-center gap-8"
        >
          <DownloadButton />
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 text-[11px] font-black text-slate-600 uppercase tracking-[0.4em] italic mt-4">
               <div className="flex flex-col items-center gap-3 group/platform cursor-default">
                 <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center group-hover/platform:border-primary/50 group-hover/platform:bg-primary/5 transition-all duration-500">
                   <Apple size={20} className="group-hover/platform:text-primary transition-colors" />
                 </div>
                 <span className="group-hover/platform:text-slate-300 transition-colors">macOS</span>
               </div>
               <div className="flex flex-col items-center gap-3 group/platform cursor-default">
                 <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center group-hover/platform:border-primary/50 group-hover/platform:bg-primary/5 transition-all duration-500">
                   <Monitor size={20} className="group-hover/platform:text-primary transition-colors" />
                 </div>
                 <span className="group-hover/platform:text-slate-300 transition-colors">Windows</span>
               </div>
               <div className="flex flex-col items-center gap-3 group/platform cursor-default">
                 <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center group-hover/platform:border-primary/50 group-hover/platform:bg-primary/5 transition-all duration-500">
                   <Terminal size={20} className="group-hover/platform:text-primary transition-colors" />
                 </div>
                 <span className="group-hover/platform:text-slate-300 transition-colors">Linux</span>
               </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
