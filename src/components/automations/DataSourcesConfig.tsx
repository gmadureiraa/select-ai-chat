import { DataSource } from "@/types/automation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface DataSourcesConfigProps {
  dataSources: DataSource[];
  onChange: (sources: DataSource[]) => void;
}

export const DataSourcesConfig = ({ dataSources, onChange }: DataSourcesConfigProps) => {
  const addDataSource = () => {
    const newSource: DataSource = {
      id: crypto.randomUUID(),
      type: "api",
      name: "",
      url: "",
      method: "GET",
      headers: {},
    };
    onChange([...dataSources, newSource]);
  };

  const removeDataSource = (id: string) => {
    onChange(dataSources.filter((s) => s.id !== id));
  };

  const updateDataSource = (id: string, updates: Partial<DataSource>) => {
    onChange(
      dataSources.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Fontes de Dados</Label>
        <Button type="button" variant="outline" size="sm" onClick={addDataSource}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar Fonte
        </Button>
      </div>

      {dataSources.map((source) => (
        <div key={source.id} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-3">
              <Input
                placeholder="Nome da fonte (ex: API de cotações)"
                value={source.name}
                onChange={(e) => updateDataSource(source.id, { name: e.target.value })}
              />
              
              <Select
                value={source.type}
                onValueChange={(value: DataSource["type"]) =>
                  updateDataSource(source.id, { type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de fonte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">API REST</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="rss">RSS Feed</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="URL da API"
                value={source.url || ""}
                onChange={(e) => updateDataSource(source.id, { url: e.target.value })}
              />

              <Select
                value={source.method}
                onValueChange={(value: "GET" | "POST") =>
                  updateDataSource(source.id, { method: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Método" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
              </Select>

              {source.method === "POST" && (
                <Textarea
                  placeholder='Body JSON (ex: {"key": "value"})'
                  value={source.body || ""}
                  onChange={(e) => updateDataSource(source.id, { body: e.target.value })}
                  rows={3}
                />
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeDataSource(source.id)}
              className="ml-2"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
