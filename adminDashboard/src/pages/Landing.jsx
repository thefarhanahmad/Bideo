import { useEffect } from "react";
import useScrollReveal from "../hooks/useScrollReveal";
import Navbar from "../components/landing/Navbar";
import Hero from "../components/landing/Hero";
import Features from "../components/landing/Features";
import HowItWorks from "../components/landing/HowItWorks";
import EarnMoney from "../components/landing/EarnMoney";
import Showcase from "../components/landing/Showcase";
import DownloadCTA from "../components/landing/DownloadCTA";
import Faq from "../components/landing/Faq";
import Footer from "../components/landing/Footer";

const Landing = () => {
  useScrollReveal();

  useEffect(() => {
    document.title = "Bideo — Watch. Create. Grow.";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", "Bideo — watch, create and grow. India's modern short & long video sharing platform. Download the app on Google Play.");
    }
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute("content", "Bideo — Watch. Create. Grow.");
    }
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.setAttribute("content", "Bideo — watch, create and grow. India's modern short & long video sharing platform. Download the app on Google Play.");
    }
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute("href", "https://bideo.in/");
    }
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.setAttribute("content", "https://bideo.in/");
    }
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans text-ink">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <EarnMoney />
        <Showcase />
        <DownloadCTA />
        <Faq />
      </main>
      <Footer />
    </div>
  );
};

export default Landing;
