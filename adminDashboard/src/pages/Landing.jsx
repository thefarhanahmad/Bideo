import useScrollReveal from "../hooks/useScrollReveal";
import Navbar from "../components/landing/Navbar";
import Hero from "../components/landing/Hero";
import Features from "../components/landing/Features";
import HowItWorks from "../components/landing/HowItWorks";
import Showcase from "../components/landing/Showcase";
import DownloadCTA from "../components/landing/DownloadCTA";
import Faq from "../components/landing/Faq";
import Footer from "../components/landing/Footer";

const Landing = () => {
  useScrollReveal();

  return (
    <div className="min-h-screen bg-white font-sans text-ink">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Showcase />
        <DownloadCTA />
        <Faq />
      </main>
      <Footer />
    </div>
  );
};

export default Landing;
