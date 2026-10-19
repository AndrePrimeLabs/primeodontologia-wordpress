// @ts-nocheck
import { useState } from "react";
import { primeos } from "@/api/primeosClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Zap, Send, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const TRIGGERS = [
  { key: "novo_lead", label: "Novo lead cadastrado" },
  { key: "agendamento_criado", label: "Consulta agendada" },
  { key: "lembrete_24h", label: "Lembrete 24h antes" },
  { key: "pos_atendimento", label: "Pós-atendimento" },
  { key: "aniversario", label: "Aniversário do cliente" },
  { key: "sem_retorno", label: "Cliente sem retorno" },
];

export default function WhatsAppAutomation() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", trigger: "novo_lead", message: "", delay_minutes: "0", channel: "whatsapp", active: true });

  const { data: workflows = [] } = useQuery({
    queryKey: ["automation_workflows"],
    queryFn: () => primeos.entities.AutomationWorkflow.list("-created_date"),
  });

  const whatsapp = workflows.filter((w) => (w.channel || "whatsapp") === "whatsapp");

  const createFlow = useMutation({
    mutationFn: (data) => primeos.entities.AutomationWorkflow.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation_workflows"] });
      setShowForm(false);
      setForm({ name: "", trigger: "novo_lead", message: "", delay_minutes: "0", channel: "whatsapp", active: true });
      toast.success("Automação criada");
    },
    onError: (e) => toast.error(e?.message || "Erro ao criar automação"),
  });

  const toggleFlow = useMutation({
    mutationFn: ({ id, active }) => primeos.entities.AutomationWorkflow.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation_workflows"] }),
  });

  const removeFlow = useMutation({
    mutationFn: (id) => primeos.entities.AutomationWorkflow.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation_workflows"] });
      toast.success("Automação removida");
    },
  });

  const active = whatsapp.filter((w) => w.active !== false).length;
  const sent = whatsapp.reduce((s, w) => s + Number(w.sent_count || 0), 0);

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="WhatsApp Automático"
        subtitle="Mensagens automáticas para leads e pacientes"
        icon={MessageCircle}
        actionLabel="Nova automação"
        onAction={() => setShowForm(true)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard title="Automações" value={whatsapp.length} icon={Zap} />
        <StatCard title="Ativas" value={active} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard title="Mensagens enviadas" value={sent} icon={Send} iconBg="bg-green-50" iconColor="text-green-600" />
      </div>

      {whatsapp.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="Nenhuma automação"
          description="Crie fluxos automáticos de WhatsApp para confirmar consultas, lembrar pacientes e reativar clientes."
          actionLabel="Nova automação"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {whatsapp.map((w, i) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{w.name || "Automação"}</p>
                  <Badge className="mt-1 bg-green-50 text-green-700">
                    {TRIGGERS.find((t) => t.key === w.trigger)?.label || w.trigger || "Gatilho"}
                  </Badge>
                </div>
                <Switch
                  checked={w.active !== false}
                  onCheckedChange={(v) => toggleFlow.mutate({ id: w.id, active: v })}
                />
              </div>
              {w.message && (
                <div className="mt-4 bg-green-50/60 border border-green-100 rounded-xl p-3 text-sm text-slate-700 whitespace-pre-wrap">
                  {w.message}
                </div>
              )}
              <div className="flex items-center justify-between mt-4 text-xs text-slate-400">
                <span>Atraso: {w.delay_minutes || 0} min</span>
                <Button variant="ghost" size="sm" className="text-rose-500 hover:text-rose-600" onClick={() => removeFlow.mutate(w.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova automação de WhatsApp</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Lembrete de consulta" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Gatilho</Label>
                <Select value={form.trigger} onValueChange={(v) => setForm({ ...form, trigger: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Atraso (minutos)</Label>
                <Input type="number" value={form.delay_minutes} onChange={(e) => setForm({ ...form, delay_minutes: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Mensagem</Label>
              <Textarea
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Olá {{nome}}, tudo bem? Passando para confirmar sua consulta..."
              />
              <p className="text-xs text-slate-400 mt-1">Use {"{{nome}}"} para personalizar com o nome do cliente.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={!form.name || createFlow.isPending}
              onClick={() => createFlow.mutate({ ...form, delay_minutes: Number(form.delay_minutes || 0) })}
            >
              <Plus className="w-4 h-4 mr-2" /> Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
