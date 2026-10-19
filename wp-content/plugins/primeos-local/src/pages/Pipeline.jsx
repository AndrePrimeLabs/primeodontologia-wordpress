// @ts-nocheck
import { useState } from "react";
import { primeos } from "@/api/primeosClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, DollarSign, Users, Target, Plus } from "lucide-react";
import { toast } from "sonner";

const STAGES = [
  { key: "novo", label: "Novo", color: "bg-slate-100 text-slate-700" },
  { key: "contato", label: "Em contato", color: "bg-blue-100 text-blue-700" },
  { key: "proposta", label: "Proposta", color: "bg-amber-100 text-amber-700" },
  { key: "negociacao", label: "Negociação", color: "bg-purple-100 text-purple-700" },
  { key: "ganho", label: "Ganho", color: "bg-emerald-100 text-emerald-700" },
  { key: "perdido", label: "Perdido", color: "bg-rose-100 text-rose-700" },
];

const currency = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));

export default function Pipeline() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", value: "", stage: "novo", source: "" });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => primeos.entities.Lead.list("-created_date"),
  });

  const createLead = useMutation({
    mutationFn: (data) => primeos.entities.Lead.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setShowForm(false);
      setForm({ name: "", email: "", phone: "", value: "", stage: "novo", source: "" });
      toast.success("Oportunidade criada");
    },
    onError: (e) => toast.error(e?.message || "Erro ao criar"),
  });

  const moveLead = useMutation({
    mutationFn: ({ id, stage }) => primeos.entities.Lead.update(id, { stage, status: stage }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
  });

  const stageOf = (lead) => lead.stage || lead.status || "novo";
  const byStage = (key) => leads.filter((l) => stageOf(l) === key);
  const total = leads.reduce((s, l) => s + Number(l.value || l.valor || 0), 0);
  const won = byStage("ganho");
  const conversion = leads.length ? Math.round((won.length / leads.length) * 100) : 0;

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Pipeline"
        subtitle="Acompanhe todas as oportunidades em andamento"
        icon={TrendingUp}
        actionLabel="Nova oportunidade"
        onAction={() => setShowForm(true)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Oportunidades" value={leads.length} icon={Users} />
        <StatCard title="Valor total" value={currency(total)} icon={DollarSign} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard title="Fechadas" value={won.length} icon={Target} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <StatCard title="Conversão" value={`${conversion}%`} icon={TrendingUp} iconBg="bg-purple-50" iconColor="text-purple-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {STAGES.map((stage) => {
          const items = byStage(stage.key);
          return (
            <div key={stage.key} className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-sm font-semibold text-slate-700">{stage.label}</span>
                <Badge className={stage.color}>{items.length}</Badge>
              </div>
              <div className="space-y-3">
                {items.map((lead) => (
                  <motion.div
                    key={lead.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm"
                  >
                    <p className="font-medium text-slate-900 text-sm">{lead.name || lead.nome || "Sem nome"}</p>
                    {(lead.email || lead.phone) && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{lead.email || lead.phone}</p>
                    )}
                    <p className="text-sm font-semibold text-emerald-600 mt-2">{currency(lead.value || lead.valor)}</p>
                    <Select value={stage.key} onValueChange={(v) => moveLead.mutate({ id: lead.id, stage: v })}>
                      <SelectTrigger className="mt-2 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => (
                          <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </motion.div>
                ))}
                {items.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">Vazio</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova oportunidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>E-mail</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
              <div>
                <Label>Origem</Label>
                <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Etapa</Label>
              <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => createLead.mutate({ ...form, value: form.value ? Number(form.value) : null, status: form.stage })}
              disabled={!form.name || createLead.isPending}
            >
              <Plus className="w-4 h-4 mr-2" /> Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
