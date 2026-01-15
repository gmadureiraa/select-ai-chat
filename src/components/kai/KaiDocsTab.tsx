import { ExternalLink, BookOpen, MessageCircle, Video, FileText, HelpCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DocLink {
  title: string;
  description: string;
  url: string;
  icon: React.ReactNode;
}

const DOC_LINKS: DocLink[] = [
  {
    title: "Primeiros Passos",
    description: "Aprenda o básico para começar a usar o kAI",
    url: "#",
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    title: "Canvas de Conteúdo",
    description: "Como criar fluxos de conteúdo visual",
    url: "#",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    title: "Análise de Performance",
    description: "Entenda suas métricas e insights",
    url: "#",
    icon: <Video className="h-5 w-5" />,
  },
  {
    title: "Central de Ajuda",
    description: "FAQ e dúvidas frequentes",
    url: "#",
    icon: <HelpCircle className="h-5 w-5" />,
  },
];

export function KaiDocsTab() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-primary" />
          Central de Ajuda
        </h1>
        <p className="text-muted-foreground">
          Encontre tutoriais, documentação e suporte para usar o kAI
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DOC_LINKS.map((doc) => (
          <Card key={doc.title} className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {doc.icon}
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <CardTitle className="text-base mt-3">{doc.title}</CardTitle>
              <CardDescription>{doc.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Precisa de mais ajuda?
          </CardTitle>
          <CardDescription>
            Entre em contato com nossa equipe de suporte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Falar com suporte
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
