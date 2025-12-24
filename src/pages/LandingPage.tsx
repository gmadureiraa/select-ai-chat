import LandingHeader from "@/components/landing/LandingHeader";
import HeroSection from "@/components/landing/HeroSection";
import ServicesCarousel from "@/components/landing/ServicesCarousel";
import AboutSection from "@/components/landing/AboutSection";
import WorkflowSection from "@/components/landing/WorkflowSection";
import FeaturesGrid from "@/components/landing/FeaturesGrid";
import StatsSection from "@/components/landing/StatsSection";
import IntegrationsOrbit from "@/components/landing/IntegrationsOrbit";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-black">
      <LandingHeader />
      <HeroSection />
      <ServicesCarousel />
      <AboutSection />
      <WorkflowSection />
      <FeaturesGrid />
      <StatsSection />
      <IntegrationsOrbit />
      <TestimonialsSection />
      <CTASection />
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
