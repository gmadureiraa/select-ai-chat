import { ThemeProvider } from "next-themes";
import NewLandingHeader from "@/components/landing/NewLandingHeader";
import NewHeroSection from "@/components/landing/NewHeroSection";
import ServicesCarousel from "@/components/landing/ServicesCarousel";
import AboutSection from "@/components/landing/AboutSection";
import AgentFlowSection from "@/components/landing/AgentFlowSection";
import PlannerDiagramSection from "@/components/landing/PlannerDiagramSection";
import WorkflowSection from "@/components/landing/WorkflowSection";
import FeaturesGrid from "@/components/landing/FeaturesGrid";
import IntegrationsOrbit from "@/components/landing/IntegrationsOrbit";
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
        <AgentFlowSection />
        <PlannerDiagramSection />
        <WorkflowSection />
        <FeaturesGrid />
        <IntegrationsOrbit />
        <PricingSection />
        <FAQSection />
        <CTASection />
        <LandingFooter />
      </div>
    </ThemeProvider>
  );
};

export default LandingPage;
