import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
  steps: Array<{
    title: string;
    description: string;
  }>;
}

export function WizardProgress({ currentStep, totalSteps, steps }: WizardProgressProps) {
  return (
    <div className="relative">
      {/* Progress bar background */}
      <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        />
      </div>
      
      {/* Steps */}
      <div className="relative flex justify-between">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          
          return (
            <div 
              key={index} 
              className="flex flex-col items-center"
            >
              {/* Step circle */}
              <div 
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all duration-300",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "bg-background border-primary text-primary",
                  !isCompleted && !isCurrent && "bg-muted border-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  stepNumber
                )}
              </div>
              
              {/* Step title */}
              <div className="mt-2 text-center">
                <p className={cn(
                  "text-xs font-medium transition-colors",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}>
                  {step.title}
                </p>
                <p className="text-[10px] text-muted-foreground hidden sm:block max-w-[80px]">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
