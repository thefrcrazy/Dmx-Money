import { Github, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { RELEASES_URL } from "../../constants/links";

interface Release {
  tag_name: string;
  name: string;
  published_at: string;
}

export function Footer() {
  const [latestReleases, setLatestReleases] = useState<Release[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("https://api.github.com/repos/thefrcrazy/Dmx-Money/releases")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLatestReleases(data.slice(0, 2));
        }
      })
      .catch(err => console.error("Failed to fetch releases:", err))
      .finally(() => setIsLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }).toUpperCase();
  };

  return (
    <footer id="changelog" className="py-48 border-t border-white/10 bg-[#050505]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-16">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="DmxMoney Logo" className="w-8 h-8" />
              <span className="font-black text-white uppercase text-xs tracking-[0.2em] italic">Dmx<span className="text-primary">Money</span></span>
            </div>
            <p className="text-xs leading-relaxed font-bold italic">L'outil de gestion financière souverain pour ceux qui exigent transparence et performance.</p>
          </div>
          <div className="space-y-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 italic">Produit</h4>
            <ul className="space-y-3 text-xs font-bold uppercase italic">
              <li><a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a></li>
              <li><a href="#install" className="hover:text-white transition-colors">Déploiement</a></li>
              <li><a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Releases GitHub</a></li>
            </ul>
          </div>
          <div className="space-y-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 italic">Journal des versions</h4>
            <div className="space-y-4 italic font-black uppercase">
              {isLoading ? (
                <div className="flex items-center gap-2 text-slate-600">
                  <Loader2 size={12} className="animate-spin" />
                  <span className="text-[10px]">Chargement...</span>
                </div>
              ) : latestReleases.length > 0 ? (
                latestReleases.map((release, i) => (
                  <div key={release.tag_name} className="space-y-1">
                    <div className={`text-[10px] ${i === 0 ? 'text-primary' : 'text-slate-600'}`}>
                      {release.tag_name} • {formatDate(release.published_at)}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-1">
                      {release.name || "Mise à jour système"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-slate-600">Aucune version trouvée</div>
              )}
            </div>
          </div>
          <div className="space-y-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 italic">Social</h4>
            <a href="https://github.com/thefrcrazy/Dmx-Money" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-black uppercase hover:text-white transition-colors italic">
              <Github size={14} /> Code Source GitHub
            </a>
          </div>
        </div>
        <div className="mt-32 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between gap-6">
          <div className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em] italic">Propulsé par Rust & React 19 • © 2026</div>
          <div className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em] italic">Sans cookies • Aucun traçage • Juste la finance</div>
        </div>
      </div>
    </footer>
  );
}
