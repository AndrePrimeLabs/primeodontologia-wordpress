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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Headphones, Inbox, CheckCircle2, Clock, Plus, Search } from "lucide-react";
import { toast } from "sonner";

const STATUS = [
  { key: "aberto", label: "Aberto", color: "bg-amber-100 text-amber-700" },
  { key: "andamento", label: "Em andamento", color: "bg-blue-100 text-blue-700" },
  { key: "resolvido", label: "Resolvido", color: "bg-emerald-100 text-emerald-700" },
];

const CHANNELS = ["WhatsApp", "Telefone", "E-mail", "Instagram", "Presencial"];

export default function AtendimentoClientes() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ customer_name: "", channel: "WhatsApp", subject: "", description: "", status: "aberto", priority: "media" });

  const { data: tickets = [] } = useQuery({
    queryKey: ["support_tickets"],
    queryFn: () => primeos.entities.SupportTicket.list("-created_date"),
  });

  const createTicket = useMutation({
    mutationFn: (data) => primeos.entities.SupportTicket.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support_tickets"] });
      setShowForm(false);
      setForm({ customer_name: "", channel: "WhatsApp", subject: "", description: "", status: "aberto", priority: "media" });
      toast.success("Atendimento registrado");
    },
    onError: (e) => toast.error(e?.message || "Erro ao registrar"),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => primeos.entities.SupportTicket.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["support_tickets"] }),
  });

  const filtered = tickets.filter((t) => {
    const okStatus = statusFilter === "all" || (t.status || "aberto") === statusFilter;
    const text = `${t.customer_name || ""} ${t.subject || ""}`.toLowerCase();
    return okStatus && text.includes(search.toLowerCase());
  });

  const count = (k) => tickets.filter((t) => (t.status || "aberto") === k).length;

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Atendimento a Clientes"
        subtitle="Central de conversas e solicitações"
        icon={Headphones}
        actionLabel="Novo atendimento"
        onAction={() => setShowForm(true)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total" value={tickets.length} icon={Inbox} />
        <StatCard title="Abertos" value={count("aberto")} icon={Clock} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <StatCard title="Em andamento" value={count("andamento")} icon={Headphones} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard title="Resolvidos" value={count("resolvido")} icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Buscar por cliente ou assunto..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Headphones}
          title="Nenhum atendimento"
          description="Registre o primeiro atendimento para acompanhar as conversas com seus clientes."
          actionLabel="Novo atendimento"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t, i) => {
            const st = STATUS.find((s) => s.key === (t.status || "aberto")) || STATUS[0];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{t.subject || "Sem assunto"}</p>
                    <p className="text-sm text-slate-500">{t.customer_name || "Cliente não informado"}</p>
                  </div>
                  <Badge className={st.color}>{st.label}</Badge>
                </div>
                {t.description && <p className="text-sm text-slate-600 mt-3 line-clamp-3">{t.description}</p>}
                <div className="flex items-center justify-between mt-4">
                  <Badge variant="outline" className="text-xs">{t.channel || "—"}</Badge>
                  <Select value={t.status || "aberto"} onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v })}>
                    <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo atendimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Canal</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Assunto</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" disabled={!form.subject || createTicket.isPending} onClick={() => createTicket.mutate(form)}>
              <Plus className="w-4 h-4 mr-2" /> Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
