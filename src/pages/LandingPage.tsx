import { ThemeProvider } from "next-themes";
import NewLandingHeader from "@/components/landing/NewLandingHeader";
import NewHeroSection from "@/components/landing/NewHeroSection";
import ServicesCarousel from "@/components/landing/ServicesCarousel";
import AboutSection from "@/components/landing/AboutSection";
import WorkflowSection from "@/components/landing/WorkflowSection";
import FeaturesGrid from "@/components/landing/FeaturesGrid";
import StatsSection from "@/components/landing/StatsSection";
import IntegrationsOrbit from "@/components/landing/IntegrationsOrbit";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import PricingSection from "@/components/landing/PricingSection";
import FAQSection from "@/components/landing/FAQSection";
import CTASection from "@/components/landing/CTASection";
import LandingFooter from "@/components/landing/LandingFooter";

const LandingPage = () => {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <div className="min-h-screen bg-background">
        <NewLandingHeader />
        <NewHeroSection />
        <ServicesCarousel />
        <AboutSection />
        <WorkflowSection />
        <FeaturesGrid />
        <StatsSection />
        <IntegrationsOrbit />
        <PricingSection />
        <TestimonialsSection />
        <FAQSection />
        <CTASection />
        <LandingFooter />
      </div>
    </ThemeProvider>
  );
};

export default LandingPage;
