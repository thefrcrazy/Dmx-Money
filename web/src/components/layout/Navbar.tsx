import { Github } from "lucide-react";
import { RELEASES_URL } from "../../constants/links";

interface NavbarProps {
  onLogoClick: () => void;
}

export function Navbar({ onLogoClick }: NavbarProps) {
  return (
    <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-5xl h-16 flex items-center justify-between px-8 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-full shadow-2xl">
      <button onClick={onLogoClick} className="flex items-center gap-2.5 cursor-pointer group">
        <img src="/logo.png" alt="DmxMoney Logo" className="w-8 h-8 group-hover:scale-110 transition-transform" />
        <span className="text-sm font-bold text-white tracking-tight uppercase tracking-[0.1em] italic">Dmx<span className="text-primary">Money</span></span>
      </button>
      
      <div className="hidden md:flex items-center gap-10">
        <a href="#features" className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500 hover:text-white transition-colors italic">Fonctionnalités</a>
        <a href="#install" className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500 hover:text-white transition-colors italic">Déploiement</a>
        <a href="#changelog" className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500 hover:text-white transition-colors italic">Historique</a>
      </div>

      <div className="flex items-center gap-6">
        <a href="https://github.com/thefrcrazy/Dmx-Money" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white transition-all hidden sm:block">
          <Github size={20} />
        </a>
        <button 
          onClick={RELEASES_URL ? () => window.open(RELEASES_URL) : undefined} 
          className="h-10 px-5 bg-white text-black text-[11px] font-black uppercase tracking-widest rounded-full hover:bg-primary transition-colors flex items-center cursor-pointer italic"
        >
          Télécharger
        </button>
      </div>
    </nav>
  );
}
