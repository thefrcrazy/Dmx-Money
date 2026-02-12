import { motion, useScroll, useSpring } from "framer-motion";
import { AnimatedBackground } from "./components/three/AnimatedBackground";
import { Navbar } from "./components/layout/Navbar";
import { Hero } from "./components/sections/Hero";
import { AppPreview } from "./components/ui/AppPreview";
import { Features } from "./components/sections/Features";
import { Deployment } from "./components/sections/Deployment";
import { Footer } from "./components/sections/Footer";

export default function App() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <div className="min-h-screen bg-black text-slate-400 font-sans selection:bg-primary/30 antialiased overflow-x-hidden">
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-primary origin-left z-[100]"
        style={{ scaleX }}
      />
      
      <AnimatedBackground />

      <Navbar onLogoClick={scrollToTop} />

      <main>
        <Hero />

        {/* Main Preview Container */}
        <section className="px-6 pb-48">
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-6xl mx-auto p-4 rounded-[2.5rem] bg-white/[0.02] border border-white/10 shadow-2xl relative"
          >
            <div className="absolute -inset-20 bg-primary/5 blur-[120px] -z-10 rounded-full opacity-50"></div>
            <AppPreview />
          </motion.div>
        </section>

        <Features />
        
        <Deployment />
      </main>

      <Footer />
    </div>
  );
}
