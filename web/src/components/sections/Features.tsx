import { Database, Cpu, ShieldCheck, BarChart3, Zap } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";

export function Features() {
  const features = [
    {
      icon: <Database size={24} />,
      title: "Cœur SQLite",
      description: "Base de données relationnelle de classe entreprise fonctionnant à 100 % localement sur votre système de fichiers. Indexation instantanée.",
      delay: 0
    },
    {
      icon: <Cpu size={24} />,
      title: "Runtime Rust",
      description: "Compilé en code machine pour une sécurité mémoire extrême et des abstractions à coût nul. Propulsé par Tauri v2.",
      delay: 0.1
    },
    {
      icon: <ShieldCheck size={24} />,
      title: "Vie Privée Avant Tout",
      description: "Pas de télémétrie, pas d'analytique, pas d'API externes. Votre historique financier ne quitte jamais votre machine.",
      delay: 0.2
    },
    {
      icon: <BarChart3 size={48} className="text-primary opacity-20" />,
      title: "Analyses Professionnelles",
      description: "Suivez les tendances, prévoyez vos flux de trésorerie et visualisez la répartition de votre patrimoine avec des graphiques vectoriels intégrés.",
      delay: 0.3,
      colSpan: true
    },
    {
      icon: <Zap size={24} />,
      title: "React 19",
      description: "Architecture frontend moderne avec des transitions à 60 FPS et une gestion d'état ultra-réactive.",
      delay: 0.4
    }
  ];

  return (
    <section id="features" className="py-48 px-6 bg-[#050505] relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="mb-24 space-y-4 text-center md:text-left">
          <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight uppercase italic tracking-tighter">Conçu pour la vitesse.</h2>
          <p className="text-slate-500 text-lg md:text-xl max-w-2xl font-bold italic">Chaque interaction est instantanée. Chaque calcul est précis. Aucune latence cloud, aucun écran de chargement.</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <GlassCard 
              key={idx} 
              className={`p-8 space-y-6 ${feature.colSpan ? "md:col-span-2 flex flex-col md:flex-row items-center gap-8 md:gap-12" : ""}`} 
              delay={feature.delay}
            >
              {feature.colSpan ? (
                <>
                  <div className="space-y-4 flex-1 text-center md:text-left">
                    <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">{feature.title}</h3>
                    <p className="text-sm leading-relaxed font-medium italic">{feature.description}</p>
                  </div>
                  <div className="w-full md:w-48 h-32 bg-white/5 rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                    {feature.icon}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto md:mx-0">
                    {feature.icon}
                  </div>
                  <div className="text-center md:text-left">
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-4">{feature.title}</h3>
                    <p className="text-sm leading-relaxed font-medium">{feature.description}</p>
                  </div>
                </>
              )}
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}
