import NewLandingHeader from "@/components/landing/NewLandingHeader";
import NewHeroSection from "@/components/landing/NewHeroSection";
import InputTypesGrid from "@/components/landing/InputTypesGrid";
import CanvasDemoSection from "@/components/landing/CanvasDemoSection";
import ValueProposition from "@/components/landing/ValueProposition";
import ProShowcase from "@/components/landing/ProShowcase";
import CanvasVsProSection from "@/components/landing/CanvasVsProSection";
import FAQSection from "@/components/landing/FAQSection";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";
import StickyMobileCTA from "@/components/landing/StickyMobileCTA";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <NewLandingHeader />
      <NewHeroSection />
      <InputTypesGrid />
      <CanvasDemoSection />
      <ValueProposition />
      <ProShowcase />
      <CanvasVsProSection />
      <FAQSection />
      <CTASection />
      <LandingFooter />
      <StickyMobileCTA />
    </div>
  );
};

export default LandingPage;
