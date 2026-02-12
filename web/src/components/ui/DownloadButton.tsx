import { motion, AnimatePresence } from "framer-motion";
import { Download, ChevronDown, Apple, Monitor, Terminal, Loader2 } from "lucide-react";
import { useState } from "react";
import { useGitHubRelease } from "../../hooks/useGitHubRelease";

export function DownloadButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { assets, isLoading } = useGitHubRelease();

  const sections = [
    {
      title: "macOS",
      items: [
        { label: "Apple Silicon (M1/M2/M3)", ext: ".dmg", href: assets.macOS.silicon, icon: Apple },
        { label: "Intel (x64)", ext: ".dmg", href: assets.macOS.intel, icon: Apple },
      ]
    },
    {
      title: "Windows",
      items: [
        { label: "Installateur (Recommandé)", ext: ".exe", href: assets.windows.setup, icon: Monitor },
        { label: "Package MSI", ext: ".msi", href: assets.windows.msi, icon: Monitor },
      ]
    },
    {
      title: "Linux",
      items: [
        { label: "AppImage", ext: ".AppImage", href: assets.linux.appImage, icon: Terminal },
        { label: "Debian / Ubuntu", ext: ".deb", href: assets.linux.deb, icon: Terminal },
        { label: "RedHat / Fedora", ext: ".rpm", href: assets.linux.rpm, icon: Terminal },
      ]
    },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-14 px-8 bg-white text-black font-semibold rounded-full hover:scale-105 transition-all flex items-center gap-4 cursor-pointer shadow-[0_0_40px_rgba(255,255,255,0.1)] active:scale-95"
      >
        <Download size={20} />
        <span>Télécharger</span>
        <div className="w-px h-4 bg-black/10 mx-1"></div>
        <ChevronDown size={16} className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full right-0 mt-4 w-72 bg-[#0A0A0A]/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 backdrop-blur-2xl ring-1 ring-white/10"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-8 gap-3 text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs font-bold uppercase tracking-widest">Récupération des liens...</span>
              </div>
            ) : (
              <div className="flex flex-col max-h-[400px] overflow-y-auto custom-scrollbar">
                {sections.map((section, idx) => (
                  <div key={idx} className="p-2 border-b border-white/5 last:border-0">
                    <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">{section.title}</div>
                    {section.items.map((opt, i) => (
                      <a
                        key={i}
                        href={opt.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between px-3 py-2.5 hover:bg-white/10 rounded-xl transition-all group/item"
                      >
                        <div className="flex items-center gap-3">
                          <opt.icon size={16} className="text-slate-400 group-hover/item:text-primary transition-colors" />
                          <div className="text-sm font-medium text-slate-200">{opt.label}</div>
                        </div>
                        <div className="text-[10px] text-slate-600 font-bold uppercase ml-2">{opt.ext}</div>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
