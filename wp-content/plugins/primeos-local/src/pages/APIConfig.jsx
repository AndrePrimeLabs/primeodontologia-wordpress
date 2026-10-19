import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import AccessDeniedError from "@/components/AccessDeniedError";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Key, Save, Plug, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "primeos_api_config";

const INTEGRATIONS = [
  { key: "whatsapp", label: "WhatsApp Business API", placeholder: "Token da API" },
  { key: "openai", label: "IA / Assistente", placeholder: "Chave de acesso" },
  { key: "email", label: "Envio de e-mails", placeholder: "Chave do provedor" },
  { key: "webhook", label: "Webhook externo", placeholder: "https://..." },
];

export default function APIConfig() {
  const { hasRole } = useAuth();
  const [config, setConfig] = useState({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setConfig(JSON.parse(saved));
    } catch {
      /* ignora config inválida */
    }
  }, []);

  if (!hasRole('admin')) {
    return <AccessDeniedError requiredRole="ADMIN" pageTitle="Configuração de API" />;
  }

  const update = (key, patch) =>
    setConfig((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    toast.success("Configurações salvas neste navegador");
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="p-6 md:p-8 max-w-[1000px] mx-auto">
      <PageHeader title="Configuração de API" subtitle="Conecte serviços externos ao PrimeOS" icon={Key} />

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-emerald-50">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Backend conectado</p>
            <p className="text-sm text-slate-500">Banco de dados e autenticação estão ativos.</p>
          </div>
          <Badge className="ml-auto bg-emerald-100 text-emerald-700">Online</Badge>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-3">
          <code className="text-xs text-slate-600 flex-1 truncate">{baseUrl}</code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText(baseUrl);
              toast.success("Endereço copiado");
            }}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-1">Integrações</h2>
        <p className="text-sm text-slate-500 mb-5">As chaves ficam salvas apenas neste navegador.</p>

        <div className="space-y-5">
          {INTEGRATIONS.map((item, i) => (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="p-4 rounded-xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Plug className="w-4 h-4 text-indigo-600" />
                  <span className="font-medium text-slate-900 text-sm">{item.label}</span>
                </div>
                <Switch
                  checked={!!config[item.key]?.enabled}
                  onCheckedChange={(v) => update(item.key, { enabled: v })}
                />
              </div>
              <Label className="text-xs text-slate-500">{item.placeholder}</Label>
              <Input
                type={item.key === "webhook" ? "text" : "password"}
                value={config[item.key]?.value || ""}
                placeholder={item.placeholder}
                onChange={(e) => update(item.key, { value: e.target.value })}
                className="mt-1"
              />
            </motion.div>
          ))}
        </div>

        <div className="flex justify-end mt-6 pt-5 border-t border-slate-100">
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={save}>
            <Save className="w-4 h-4 mr-2" /> Salvar configurações
          </Button>
        </div>
      </div>
    </div>
  );
}
