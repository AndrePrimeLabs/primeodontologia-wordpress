// @ts-nocheck
import { useMemo, useState } from "react";
import { primeos } from "@/api/primeosClient";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { History, Search, Calendar, DollarSign, MessageCircle, User } from "lucide-react";

const currency = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—");

export default function CustomerHistory() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => primeos.entities.Customer.list("-created_date"),
  });
  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: () => primeos.entities.Appointment.list("-created_date"),
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: () => primeos.entities.Sale.list("-created_date"),
  });
  const { data: interactions = [] } = useQuery({
    queryKey: ["interactions"],
    queryFn: () => primeos.entities.Interaction.list("-created_date"),
  });

  const filtered = customers.filter((c) =>
    (c.name || c.nome || "").toLowerCase().includes(search.toLowerCase())
  );
  const selected = customers.find((c) => c.id === selectedId) || filtered[0];

  const timeline = useMemo(() => {
    if (!selected) return [];
    const match = (r) =>
      r.customer_id === selected.id ||
      r.patient_id === selected.id ||
      (r.customer_name && r.customer_name === (selected.name || selected.nome)) ||
      (r.email && r.email === selected.email);

    const events = [
      ...appointments.filter(match).map((a) => ({
        id: `a-${a.id}`, type: "Consulta", icon: Calendar, color: "bg-blue-50 text-blue-600",
        title: a.title || a.service || "Consulta agendada",
        detail: a.status || "",
        date: a.date || a.scheduled_at || a.created_date,
      })),
      ...sales.filter(match).map((s) => ({
        id: `s-${s.id}`, type: "Venda", icon: DollarSign, color: "bg-emerald-50 text-emerald-600",
        title: s.product_name || s.title || "Venda realizada",
        detail: currency(s.total || s.amount || s.value),
        date: s.date || s.created_date,
      })),
      ...interactions.filter(match).map((i) => ({
        id: `i-${i.id}`, type: "Contato", icon: MessageCircle, color: "bg-purple-50 text-purple-600",
        title: i.subject || i.type || "Interação",
        detail: i.notes || i.channel || "",
        date: i.date || i.created_date,
      })),
    ];
    return events.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [selected, appointments, sales, interactions]);

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader title="Histórico do Cliente" subtitle="Toda a jornada em uma linha do tempo" icon={History} />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-1 max-h-[560px] overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                  selected?.id === c.id ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                <p className="text-sm font-medium truncate">{c.name || c.nome || "Sem nome"}</p>
                <p className="text-xs text-slate-400 truncate">{c.email || c.phone || ""}</p>
              </button>
            ))}
            {filtered.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Nenhum cliente</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          {!selected ? (
            <EmptyState icon={User} title="Selecione um cliente" description="Escolha um cliente na lista ao lado para ver todo o histórico." />
          ) : (
            <>
              <div className="flex items-center gap-3 pb-5 border-b border-slate-100 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <User className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selected.name || selected.nome}</h2>
                  <p className="text-sm text-slate-500">{selected.email || selected.phone || "Sem contato cadastrado"}</p>
                </div>
                <Badge className="ml-auto bg-slate-100 text-slate-600">Cliente desde {fmtDate(selected.created_date)}</Badge>
              </div>

              {timeline.length === 0 ? (
                <EmptyState icon={History} title="Sem registros" description="Ainda não há consultas, vendas ou contatos para este cliente." />
              ) : (
                <div className="space-y-4">
                  {timeline.map((e, i) => (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex gap-4"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${e.color}`}>
                        <e.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 pb-4 border-b border-slate-50">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-slate-900 text-sm">{e.title}</p>
                          <span className="text-xs text-slate-400 shrink-0">{fmtDate(e.date)}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{e.type}{e.detail ? ` · ${e.detail}` : ""}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
