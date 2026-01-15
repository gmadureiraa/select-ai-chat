import NewLandingHeader from "@/components/landing/NewLandingHeader";
import NewHeroSection from "@/components/landing/NewHeroSection";
import CanvasDemoSection from "@/components/landing/CanvasDemoSection";
import ValueProposition from "@/components/landing/ValueProposition";
import ServicesCarousel from "@/components/landing/ServicesCarousel";
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
      <ValueProposition />
      <ServicesCarousel />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <LandingFooter />
    </div>
  );
};

export default LandingPage;
