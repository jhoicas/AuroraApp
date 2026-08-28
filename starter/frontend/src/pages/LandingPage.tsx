import LandingFeatures from '../components/Landing/LandingFeatures';
import LandingFooter from '../components/Landing/LandingFooter';
import LandingHero from '../components/Landing/LandingHero';
import LandingHowItWorks from '../components/Landing/LandingHowItWorks';
import LandingNavbar from '../components/Landing/LandingNavbar';

/**
 * Landing pública de AuroraApp (ruta `/`).
 * Las rutas de autenticación (/login, /register) y los dashboards protegidos no se modifican.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-body text-gray-900">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-15%] right-[-5%] h-[520px] w-[520px] rounded-full bg-teal-100/50 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[480px] w-[480px] rounded-full bg-slate-100 blur-[120px]" />
      </div>

      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingHowItWorks />
      </main>
      <LandingFooter />
    </div>
  );
}
