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
  Crown,
  Sparkles
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
    transition={{ delay, duration: 0.5 }}
    className="bg-gradient-to-br from-card to-card/80 border border-border rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 group"
  >
    {/* Visual Preview */}
    <div className="relative h-56 bg-gradient-to-br from-muted/30 to-muted/60 overflow-hidden">
      {visual}
      <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
      
      {/* Glow effect on hover */}
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>

    {/* Content */}
    <div className="p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:from-primary/30 group-hover:to-primary/10 transition-all duration-300 shadow-lg shadow-primary/10">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground">{title}</h3>
      </div>
      
      <p className="text-muted-foreground mb-4 leading-relaxed">{description}</p>
      
      <ul className="space-y-2.5">
        {features.map((feature, i) => (
          <motion.li 
            key={feature} 
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: delay + 0.1 + i * 0.05 }}
            className="flex items-center gap-2.5 text-sm"
          >
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-foreground">{feature}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  </motion.div>
);

// Kanban Visual Preview - More realistic
const KanbanVisual = () => (
  <div className="absolute inset-3 flex gap-2">
    {[
      { name: "A fazer", color: "bg-yellow-500/20", items: 3 },
      { name: "Em progresso", color: "bg-blue-500/20", items: 2 },
      { name: "Revisão", color: "bg-purple-500/20", items: 2 },
      { name: "Pronto", color: "bg-green-500/20", items: 4 },
    ].map((col, i) => (
      <div key={col.name} className="flex-1 flex flex-col gap-1.5">
        <div className={`text-[10px] font-semibold px-2 py-1 rounded-md ${col.color} text-foreground/80`}>
          {col.name}
        </div>
        <div className="flex-1 space-y-1.5 overflow-hidden">
          {[...Array(Math.min(col.items, 3))].map((_, j) => (
            <motion.div
              key={j}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + 0.08 * (i + j) }}
              className="bg-background/90 backdrop-blur rounded-lg p-2 border border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${col.color.replace('/20', '')}`} />
                <div className="w-full h-1.5 bg-muted rounded" />
              </div>
              <div className="w-2/3 h-1.5 bg-muted/70 rounded" />
              {j === 0 && i === 1 && (
                <div className="flex items-center gap-1 mt-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[8px] text-white font-bold">M</div>
                  <div className="text-[8px] text-muted-foreground">Hoje</div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// Analytics Visual Preview - More detailed
const AnalyticsVisual = () => (
  <div className="absolute inset-3 flex flex-col">
    {/* Main chart */}
    <div className="flex-1 flex items-end gap-0.5 mb-3 px-2">
      {[35, 55, 40, 70, 50, 85, 65, 80, 60, 90, 75, 95].map((height, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          whileInView={{ height: `${height}%` }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 + 0.04 * i, duration: 0.4, ease: "easeOut" }}
          className="flex-1 bg-gradient-to-t from-primary/60 to-primary/20 rounded-t hover:from-primary/80 hover:to-primary/40 transition-colors cursor-pointer"
        />
      ))}
    </div>
    
    {/* Stats row */}
    <div className="grid grid-cols-3 gap-2">
      {[
        { label: "Alcance", value: "+45%", icon: TrendingUp, color: "text-green-500" },
        { label: "Engajamento", value: "8.2%", icon: Zap, color: "text-yellow-500" },
        { label: "Cliques", value: "1.2K", icon: Share2, color: "text-blue-500" },
      ].map((stat, i) => (
        <motion.div 
          key={stat.label} 
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 + i * 0.1 }}
          className="bg-background/90 backdrop-blur rounded-lg p-2 border border-border/50"
        >
          <stat.icon className={`w-3.5 h-3.5 ${stat.color} mb-1`} />
          <div className="text-sm font-bold text-foreground">{stat.value}</div>
          <div className="text-[9px] text-muted-foreground">{stat.label}</div>
        </motion.div>
      ))}
    </div>
  </div>
);

// Collaboration Visual Preview - More interactive
const CollabVisual = () => (
  <div className="absolute inset-3 flex flex-col">
    {/* Team avatars with activity ring */}
    <div className="flex items-center gap-4 mb-4">
      <div className="flex -space-x-3">
        {[
          { color: "bg-blue-500", letter: "A", online: true },
          { color: "bg-green-500", letter: "B", online: true },
          { color: "bg-purple-500", letter: "C", online: false },
          { color: "bg-orange-500", letter: "D", online: true },
        ].map((user, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10, scale: 0.8 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 * i }}
            className="relative"
          >
            <div className={`w-9 h-9 rounded-full ${user.color} border-2 border-background flex items-center justify-center text-white text-xs font-bold shadow-lg`}>
              {user.letter}
            </div>
            {user.online && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
            )}
          </motion.div>
        ))}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="w-9 h-9 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs text-muted-foreground font-medium"
        >
          +3
        </motion.div>
      </div>
      <div className="text-xs text-muted-foreground">
        <span className="text-foreground font-medium">4 online</span> agora
      </div>
    </div>
    
    {/* Client profiles */}
    <div className="space-y-2 flex-1">
      {[
        { name: "Cliente A", posts: 12, pending: 3, color: "bg-blue-500", status: "Ativo" },
        { name: "Cliente B", posts: 8, pending: 1, color: "bg-green-500", status: "Revisão" },
        { name: "Cliente C", posts: 15, pending: 0, color: "bg-purple-500", status: "Pronto" },
      ].map((client, i) => (
        <motion.div
          key={client.name}
          initial={{ opacity: 0, x: 15 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 + 0.1 * i }}
          className="flex items-center gap-2.5 bg-background/90 backdrop-blur rounded-lg p-2.5 border border-border/50 hover:border-primary/30 transition-colors cursor-pointer group"
        >
          <div className={`w-8 h-8 rounded-lg ${client.color}/20 flex items-center justify-center`}>
            <span className={`text-xs font-bold ${client.color.replace('bg-', 'text-')}`}>
              {client.name.slice(-1)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground truncate">{client.name}</div>
            <div className="text-[10px] text-muted-foreground">
              {client.posts} posts • {client.pending > 0 ? `${client.pending} pendentes` : 'Tudo pronto'}
            </div>
          </div>
          <div className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
            client.status === 'Ativo' ? 'bg-yellow-500/20 text-yellow-600' :
            client.status === 'Revisão' ? 'bg-blue-500/20 text-blue-600' :
            'bg-green-500/20 text-green-600'
          }`}>
            {client.status}
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

export function ProShowcase() {
  return (
    <section className="py-28 bg-gradient-to-b from-background to-muted/20 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-primary/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/20 text-primary text-sm font-medium mb-6"
          >
            <Crown className="w-4 h-4" />
            kAI PRO
            <Sparkles className="w-3.5 h-3.5" />
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-5">
            Para quem{" "}
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              vive da criação
            </span>
          </h2>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Gerencie múltiplos clientes, analise performance em tempo real e 
            publique em escala com sua equipe.
          </p>
        </motion.div>

        {/* 3 Pillars */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Pillar
            icon={LayoutDashboard}
            title="Planejamento"
            description="Kanban visual e calendário editorial para organizar todo o conteúdo do seu time."
            features={[
              "Kanban drag-and-drop",
              "Calendário com agendamento",
              "Status customizáveis",
              "Etiquetas e filtros avançados",
            ]}
            visual={<KanbanVisual />}
            delay={0.1}
          />
          
          <Pillar
            icon={BarChart3}
            title="Performance"
            description="Analytics integrado de todas as redes sociais em um só dashboard."
            features={[
              "Métricas consolidadas",
              "Relatórios automáticos",
              "Insights de conteúdo com IA",
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

        {/* Testimonial */}
        <motion.blockquote
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center max-w-3xl mx-auto p-8 bg-card border border-border rounded-2xl mb-12"
        >
          <p className="text-lg md:text-xl text-muted-foreground italic mb-6">
            "Economizamos 20h por semana na produção de conteúdo para nossos 12 clientes. 
            O kAI PRO transformou completamente nossa operação."
          </p>
          <footer className="flex items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white font-bold text-lg">
              M
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">Marina Costa</p>
              <p className="text-sm text-muted-foreground">CEO, Agência Pulso Digital</p>
            </div>
          </footer>
        </motion.blockquote>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <Link to="/signup?plan=agency">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 px-10 py-7 text-lg rounded-full shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
            >
              <Crown className="mr-2 w-5 h-5" />
              Começar grátis por 7 dias
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground mt-5">
            Inclui 3 perfis + 3 membros. Adicione mais por <span className="text-foreground font-medium">$7</span> e <span className="text-foreground font-medium">$4</span>/mês.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export default ProShowcase;
