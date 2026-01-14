import NewLandingHeader from "@/components/landing/NewLandingHeader";
import NewHeroSection from "@/components/landing/NewHeroSection";
import CanvasDemoSection from "@/components/landing/CanvasDemoSection";
import ServicesCarousel from "@/components/landing/ServicesCarousel";
import AgentFlowSection from "@/components/landing/AgentFlowSection";
import FeaturesGrid from "@/components/landing/FeaturesGrid";
import PricingSection from "@/components/landing/PricingSection";
import FAQSection from "@/components/landing/FAQSection";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <NewLandingHeader />
      <NewHeroSection />
      <CanvasDemoSection />
      <ServicesCarousel />
      <AgentFlowSection />
      <FeaturesGrid />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
