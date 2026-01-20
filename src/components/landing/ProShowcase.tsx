import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  BarChart3, 
  Users, 
  ArrowRight, 
  Calendar, 
  CheckCircle2,
  TrendingUp,
  Bell,
  Zap,
  Share2,
  Crown
} from "lucide-react";
import { Link } from "react-router-dom";

interface PillarProps {
  icon: React.ElementType;
  title: string;
  description: string;
  features: string[];
  visual: React.ReactNode;
  delay: number;
}

const Pillar = ({ icon: Icon, title, description, features, visual, delay }: PillarProps) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay }}
    className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl transition-shadow group"
  >
    {/* Visual Preview */}
    <div className="relative h-48 bg-muted/50 overflow-hidden">
      {visual}
      <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
    </div>

    {/* Content */}
    <div className="p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground">{title}</h3>
      </div>
      
      <p className="text-muted-foreground mb-4">{description}</p>
      
      <ul className="space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-foreground">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  </motion.div>
);

// Kanban Visual Preview
const KanbanVisual = () => (
  <div className="absolute inset-4 flex gap-2">
    {["A fazer", "Fazendo", "Revisão", "Pronto"].map((col, i) => (
      <div key={col} className="flex-1 flex flex-col gap-2">
        <div className="text-[10px] font-medium text-muted-foreground px-2">{col}</div>
        {[...Array(3 - i)].map((_, j) => (
          <motion.div
            key={j}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 * (i + j) }}
            className="bg-background rounded-lg p-2 border border-border shadow-sm"
          >
            <div className="w-full h-1.5 bg-muted rounded mb-1" />
            <div className="w-2/3 h-1.5 bg-muted rounded" />
          </motion.div>
        ))}
      </div>
    ))}
  </div>
);

// Analytics Visual Preview
const AnalyticsVisual = () => (
  <div className="absolute inset-4">
    {/* Chart bars */}
    <div className="flex items-end gap-1 h-20 mb-4">
      {[40, 65, 45, 80, 60, 90, 75, 85, 70, 95].map((height, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          whileInView={{ height: `${height}%` }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 * i, duration: 0.3 }}
          className="flex-1 bg-primary/30 rounded-t"
        />
      ))}
    </div>
    {/* Stats */}
    <div className="grid grid-cols-3 gap-2">
      {[
        { label: "Alcance", value: "+45%", icon: TrendingUp },
        { label: "Engajamento", value: "8.2%", icon: Zap },
        { label: "Cliques", value: "1.2K", icon: Share2 },
      ].map((stat) => (
        <div key={stat.label} className="bg-background rounded-lg p-2 border border-border">
          <stat.icon className="w-3 h-3 text-primary mb-1" />
          <div className="text-xs font-bold text-foreground">{stat.value}</div>
          <div className="text-[9px] text-muted-foreground">{stat.label}</div>
        </div>
      ))}
    </div>
  </div>
);

// Collaboration Visual Preview
const CollabVisual = () => (
  <div className="absolute inset-4">
    {/* Team avatars */}
    <div className="flex -space-x-2 mb-4">
      {[
        "bg-blue-500",
        "bg-green-500",
        "bg-purple-500",
        "bg-orange-500",
      ].map((color, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 * i }}
          className={`w-8 h-8 rounded-full ${color} border-2 border-background flex items-center justify-center text-white text-xs font-bold`}
        >
          {String.fromCharCode(65 + i)}
        </motion.div>
      ))}
      <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs text-muted-foreground">
        +3
      </div>
    </div>
    
    {/* Client profiles */}
    <div className="space-y-2">
      {["Cliente A", "Cliente B", "Cliente C"].map((client, i) => (
        <motion.div
          key={client}
          initial={{ opacity: 0, x: 10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 + 0.1 * i }}
          className="flex items-center gap-2 bg-background rounded-lg p-2 border border-border"
        >
          <div className={`w-6 h-6 rounded-lg ${["bg-blue-500/20", "bg-green-500/20", "bg-purple-500/20"][i]} flex items-center justify-center`}>
            <span className="text-[10px] font-bold">{client.slice(-1)}</span>
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium">{client}</div>
            <div className="text-[9px] text-muted-foreground">12 posts • 3 pendentes</div>
          </div>
          <Bell className="w-3 h-3 text-muted-foreground" />
        </motion.div>
      ))}
    </div>
  </div>
);

export function ProShowcase() {
  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/3 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Crown className="w-4 h-4" />
            kAI PRO
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Tudo que sua agência precisa
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Gerencie múltiplos clientes, analise performance em tempo real e 
            publique em escala com sua equipe.
          </p>
        </motion.div>

        {/* 3 Pillars */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Pillar
            icon={LayoutDashboard}
            title="Planejamento"
            description="Kanban visual e calendário editorial para organizar todo o conteúdo."
            features={[
              "Kanban drag-and-drop",
              "Calendário com agendamento",
              "Status customizáveis",
              "Etiquetas e filtros",
            ]}
            visual={<KanbanVisual />}
            delay={0.1}
          />
          
          <Pillar
            icon={BarChart3}
            title="Performance"
            description="Analytics integrado de todas as redes sociais em um só lugar."
            features={[
              "Métricas consolidadas",
              "Relatórios automáticos",
              "Insights de conteúdo",
              "Comparativos de período",
            ]}
            visual={<AnalyticsVisual />}
            delay={0.2}
          />
          
          <Pillar
            icon={Users}
            title="Colaboração"
            description="Gerencie múltiplos clientes e convide membros do seu time."
            features={[
              "3 perfis de cliente inclusos",
              "3 membros do time inclusos",
              "Permissões granulares",
              "Histórico de atividades",
            ]}
            visual={<CollabVisual />}
            delay={0.3}
          />
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <Link to="/signup?plan=agency">
            <Button size="lg" className="bg-primary hover:bg-primary/90 px-8 py-6 text-base rounded-full">
              <Crown className="mr-2 w-4 h-4" />
              Começar com kAI PRO - $99.90/mês
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground mt-4">
            Inclui 3 perfis + 3 membros. Adicione mais por $7 e $4/mês.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export default ProShowcase;
