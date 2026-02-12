import { Apple, Monitor, Terminal, ShieldAlert, CheckCircle2, Copy, Check } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { useState } from "react";

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button 
      onClick={handleCopy}
      className={`text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 italic ${
        copied ? "text-emerald-500" : "text-slate-600 hover:text-white"
      }`}
    >
      {copied ? (
        <>
          <Check size={10} />
          Copié !
        </>
      ) : (
        <>
          <Copy size={10} />
          Copier la commande
        </>
      )}
    </button>
  );
}

export function Deployment() {
  const platforms = [
    {
      id: "macOS",
      icon: Apple,
      title: "Apple macOS",
      requirement: "macOS 10.15+ (Catalina)",
      steps: [
        "Téléchargez l'image disque (.dmg) universelle.",
        "Déplacez DmxMoney.app dans votre dossier Applications.",
        "En raison de l'absence de certificat développeur Apple, exécutez la commande suivante dans le Terminal pour autoriser l'ouverture :"
      ],
      code: "xattr -cr \"/Applications/DmxMoney.app\""
    },
    {
      id: "Windows",
      icon: Monitor,
      title: "Microsoft Windows",
      requirement: "Windows 10 / 11 (x64)",
      steps: [
        "Téléchargez l'installateur exécutable (.exe).",
        "Lancez l'installation. Windows SmartScreen peut afficher une alerte.",
        "Cliquez sur 'Informations complémentaires' puis 'Exécuter quand même' pour finaliser."
      ]
    },
    {
      id: "Linux",
      icon: Terminal,
      title: "GNU/Linux",
      requirement: "Distributions x64 avec FUSE",
      steps: [
        "Téléchargez le fichier AppImage.",
        "Rendez le fichier exécutable via votre gestionnaire de fichiers ou par terminal :",
        "Lancez l'application en double-cliquant sur le fichier."
      ],
      code: "chmod +x dmx-money_*.AppImage"
    }
  ];

  return (
    <section id="install" className="py-48 px-6 bg-black">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center gap-6 mb-24 text-center md:text-left">
          <h2 className="text-5xl font-black text-white tracking-tighter uppercase italic">Protocole de Déploiement.</h2>
          <div className="hidden md:block h-px flex-1 bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]"></div>
        </div>
        
        <div className="grid lg:grid-cols-3 gap-8">
          {platforms.map((p, idx) => (
            <GlassCard key={idx} className="p-8 flex flex-col h-full" delay={idx * 0.1}>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white">
                  <p.icon size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-white uppercase italic tracking-wider">{p.title}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">{p.requirement}</p>
                </div>
              </div>

              <div className="space-y-6 flex-1">
                {p.steps.map((step, sIdx) => (
                  <div key={sIdx} className="flex gap-4 group/step">
                    <span className="text-[10px] font-black text-slate-800 group-hover/step:text-primary transition-colors italic mt-1">{(sIdx + 1).toString().padStart(2, '0')}</span>
                    <p className="text-sm text-slate-400 leading-relaxed font-medium">{step}</p>
                  </div>
                ))}
              </div>

              {p.code && (
                <div className="mt-8 p-4 rounded-xl bg-black/50 border border-white/5 group/code relative overflow-hidden">
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover/code:opacity-100 transition-opacity"></div>
                  <code className="text-[11px] font-mono text-primary block mb-3 break-all">{p.code}</code>
                  <CopyButton code={p.code} />
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-3">
                <ShieldAlert size={14} className="text-yellow-500/50" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest italic">Vérification de sécurité requise</span>
              </div>
            </GlassCard>
          ))}
        </div>

        <div className="mt-24 p-8 rounded-3xl bg-primary/5 border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_30px_rgba(212,175,55,0.2)]">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h4 className="text-xl font-black text-white italic uppercase tracking-tighter">Prêt pour l'action ?</h4>
              <p className="text-slate-500 font-bold italic">Une fois installé, lancez l'application pour commencer votre voyage vers l'indépendance financière.</p>
            </div>
          </div>
          <a 
            href="#hero" 
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="px-8 py-4 bg-white text-black font-black uppercase italic tracking-widest rounded-full hover:bg-primary transition-all hover:scale-105 active:scale-95 text-xs"
          >
            Remonter au sommet
          </a>
        </div>
      </div>
    </section>
  );
}
