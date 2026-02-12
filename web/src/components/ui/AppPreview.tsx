import { 
  LayoutDashboard, 
  Wallet, 
  Receipt, 
  Calculator, 
  BarChart3, 
  Search, 
  CalendarClock, 
  PieChart, 
  TrendingUp, 
  Tag, 
  ArrowRightLeft, 
  CheckCircle2, 
  Clock,
  AlertCircle
} from "lucide-react";

export function AppPreview() {
  return (
    <div className="w-full h-[400px] md:h-[680px] bg-black rounded-3xl border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] flex overflow-hidden relative group/preview">
      {/* Dynamic Glow Effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-3xl blur-2xl opacity-0 group-hover/preview:opacity-100 transition-opacity duration-1000 -z-10"></div>
      
      {/* Sidebar - Hidden on mobile */}
      <aside className="hidden md:flex w-64 bg-[#050505] border-r border-white/5 flex-col p-6 gap-8">
        <div className="flex items-center gap-3 px-2">
          <img src="/logo.png" alt="DmxMoney Logo" className="w-8 h-8" />
          <span className="text-sm font-bold text-white tracking-tight uppercase tracking-[0.1em]">DmxMoney</span>
        </div>
        
        <div className="space-y-6 flex-1">
          <div className="space-y-1">
            <h3 className="px-3 text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2 italic">Général</h3>
            <div className="h-9 bg-white/5 border border-white/10 rounded-lg flex items-center px-3 gap-3 text-white text-xs font-semibold shadow-sm italic">
              <LayoutDashboard size={14} className="text-primary" /> Vue d'ensemble
            </div>
            <div className="h-9 rounded-lg flex items-center px-3 gap-3 text-slate-500 text-xs font-medium hover:bg-white/[0.02] transition-colors">
              <Wallet size={14} /> Mes Comptes
            </div>
            <div className="h-9 rounded-lg flex items-center px-3 gap-3 text-slate-500 text-xs font-medium hover:bg-white/[0.02] transition-colors">
              <Receipt size={14} /> Journal
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="px-3 text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2 italic">Finances</h3>
            <div className="h-9 rounded-lg flex items-center px-3 gap-3 text-slate-500 text-xs font-medium hover:bg-white/[0.02] transition-colors">
              <Calculator size={14} /> Budget
            </div>
            <div className="h-9 rounded-lg flex items-center px-3 gap-3 text-slate-500 text-xs font-medium hover:bg-white/[0.02] transition-colors">
              <CalendarClock size={14} /> Échéancier
            </div>
          </div>

          <div className="space-y-1 pt-4 border-t border-white/5">
            <h3 className="px-3 text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2 italic">Analyses</h3>
            <div className="h-9 rounded-lg flex items-center px-3 gap-3 text-slate-500 text-xs font-medium hover:bg-white/[0.02] transition-colors">
              <PieChart size={14} /> Analyses
            </div>
            <div className="h-9 rounded-lg flex items-center px-3 gap-3 text-slate-500 text-xs font-medium hover:bg-white/[0.02] transition-colors">
              <TrendingUp size={14} /> Prédictions
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-600 font-bold uppercase tracking-widest italic">
          <span>v0.5.5</span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col bg-[#0A0A0A] overflow-hidden">
        <header className="h-14 md:h-16 border-b border-white/5 flex items-center justify-between px-6 md:px-10">
          <div className="flex items-center gap-4">
            <div className="h-8 w-32 md:w-48 bg-white/[0.03] rounded-full border border-white/5 flex items-center px-3 gap-2">
              <Search size={12} className="text-slate-600" />
              <div className="text-[10px] text-slate-600 font-bold italic">Tous les comptes</div>
            </div>
          </div>
          <div className="flex items-center gap-4 md:gap-10">
            <div className="text-right">
              <div className="text-[8px] md:text-[9px] text-slate-600 font-bold uppercase tracking-widest">Pointé</div>
              <div className="text-xs md:text-sm font-bold text-emerald-500 tracking-tight italic">15 840,20 €</div>
            </div>
            <div className="h-8 w-px bg-white/5"></div>
            <div className="text-right">
              <div className="text-[8px] md:text-[9px] text-slate-600 font-bold uppercase tracking-widest">Actuel</div>
              <div className="text-sm md:text-lg font-bold text-white tracking-tight italic">16 250,45 €</div>
            </div>
          </div>
        </header>

        <div className="p-6 md:p-10 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-end">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight italic uppercase">Tableau de Bord</h2>
            <div className="px-2 md:px-3 py-1 md:py-1.5 bg-primary/10 border border-primary/20 rounded-full text-[8px] md:text-[9px] font-bold text-primary uppercase tracking-widest italic">Node Local Actif</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {/* Échéances */}
            <div className="p-5 md:p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-between group/card hover:bg-white/[0.04] transition-colors">
              <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-4">
                <div className="flex items-center gap-2 italic"><CalendarClock size={14} className="text-primary" /> Échéances</div>
                <span className="text-primary/50">3 à venir</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <span className="text-xs text-slate-300 font-medium italic">Loyer Appt.</span>
                  </div>
                  <span className="text-xs font-bold text-white">850 €</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-xs text-slate-300 font-medium italic">Internet Fiber</span>
                  </div>
                  <span className="text-xs font-bold text-white">39 €</span>
                </div>
              </div>
            </div>

            {/* Opérations */}
            <div className="p-5 md:p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center text-center space-y-2 group/card hover:bg-white/[0.04] transition-colors">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest italic">Épargné ce mois</span>
              <span className="text-3xl font-black text-emerald-500 tracking-tighter italic">+2 410 €</span>
              <div className="flex gap-4 pt-2">
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-600 font-black uppercase">In</span>
                  <span className="text-[10px] text-emerald-500/80 font-bold">+4.2k</span>
                </div>
                <div className="h-4 w-px bg-white/5"></div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-600 font-black uppercase">Out</span>
                  <span className="text-[10px] text-red-500/80 font-bold">-1.8k</span>
                </div>
              </div>
            </div>

            {/* Allocation */}
            <div className="hidden md:flex p-6 rounded-2xl bg-white/[0.02] border border-white/5 flex-col justify-between group/card hover:bg-white/[0.04] transition-colors">
              <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-4">
                <div className="flex items-center gap-2 italic"><PieChart size={14} className="text-primary" /> Catégories</div>
                <span className="text-slate-600">Top 3</span>
              </div>
              <div className="space-y-2">
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                  <div className="h-full w-[45%] bg-primary"></div>
                  <div className="h-full w-[25%] bg-white/20"></div>
                  <div className="h-full w-[15%] bg-white/10"></div>
                </div>
                <div className="flex justify-between text-[9px] font-bold text-slate-500 italic uppercase">
                  <span>Logement</span>
                  <span>45%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="rounded-2xl bg-white/[0.01] border border-white/5 flex flex-col h-64">
              <div className="p-4 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2 italic">
                  <Receipt size={14} className="text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dernières Opérations</span>
                </div>
                <div className="w-8 h-1.5 bg-white/5 rounded-full"></div>
              </div>
              <div className="p-4 space-y-4 overflow-hidden">
                {[
                  { label: 'Apple Store', date: 'Hier', val: '-12,99 €', color: 'text-white' },
                  { label: 'Virement Salaire', date: '10 Fév', val: '+3 250 €', color: 'text-emerald-500' },
                  { label: 'Starbucks Coffee', date: '09 Fév', val: '-5,40 €', color: 'text-white' },
                  { label: 'Amazon Prime', date: '08 Fév', val: '-6,99 €', color: 'text-white' },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="flex gap-3 items-center">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                        <Tag size={12} className="text-slate-600" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-300 italic">{item.label}</span>
                        <span className="text-[9px] text-slate-600 font-bold uppercase">{item.date}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-black italic ${item.color}`}>{item.val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-64 rounded-2xl bg-white/[0.01] border border-white/5 relative overflow-hidden group/item cursor-default">
               <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent opacity-30 group-hover/item:opacity-60 transition-opacity duration-1000"></div>
               <div className="p-8 relative z-10 flex flex-col h-full justify-between">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] italic">Prédictions</div>
                    <div className="text-3xl font-black text-white tracking-tighter italic uppercase leading-none">Flux de <br/>Trésorerie</div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="space-y-1">
                      <div className="text-[9px] text-slate-500 font-bold uppercase italic">Est. +12 mois</div>
                      <div className="text-xl font-black text-primary italic">+42 500 €</div>
                    </div>
                    <TrendingUp size={48} className="text-primary opacity-20" />
                  </div>
               </div>
               
               {/* Decorative Vector Line */}
               <svg className="absolute bottom-0 left-0 w-full h-24 opacity-20" viewBox="0 0 400 100" preserveAspectRatio="none">
                 <path d="M0,80 C100,70 150,20 200,50 C250,80 300,40 400,10 L400,100 L0,100 Z" fill="url(#grad)" />
                 <defs>
                   <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                     <stop offset="0%" style={{ stopColor: 'var(--color-primary)', stopOpacity: 1 }} />
                     <stop offset="100%" style={{ stopColor: 'var(--color-primary)', stopOpacity: 0 }} />
                   </linearGradient>
                 </defs>
               </svg>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
