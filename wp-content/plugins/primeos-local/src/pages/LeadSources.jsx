// @ts-nocheck
import { useMemo } from "react";
import { primeos } from "@/api/primeosClient";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Radar, Users, TrendingUp, Award } from "lucide-react";

const currency = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));

export default function LeadSources() {
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => primeos.entities.Lead.list("-created_date"),
  });

  const sources = useMemo(() => {
    const map = new Map();
    leads.forEach((lead) => {
      const key = lead.source || lead.origem || lead.channel || "Não informado";
      const entry = map.get(key) || { name: key, count: 0, value: 0, won: 0 };
      entry.count += 1;
      entry.value += Number(lead.value || lead.valor || 0);
      if ((lead.stage || lead.status) === "ganho") entry.won += 1;
      map.set(key, entry);
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [leads]);

  const best = sources[0];
  const totalValue = sources.reduce((s, x) => s + x.value, 0);
  const max = Math.max(1, ...sources.map((s) => s.count));

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader title="Origem de Leads" subtitle="De onde vêm seus pacientes e clientes" icon={Radar} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Leads" value={leads.length} icon={Users} />
        <StatCard title="Canais ativos" value={sources.length} icon={Radar} iconBg="bg-purple-50" iconColor="text-purple-600" />
        <StatCard title="Melhor canal" value={best?.name || "—"} icon={Award} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <StatCard title="Valor em pipeline" value={currency(totalValue)} icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
      </div>

      {sources.length === 0 && !isLoading ? (
        <EmptyState
          icon={Radar}
          title="Nenhum lead registrado"
          description="Assim que houver leads cadastrados, a distribuição por origem aparece aqui."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
          {sources.map((s, i) => {
            const conversion = s.count ? Math.round((s.won / s.count) * 100) : 0;
            return (
              <motion.div
                key={s.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="p-5"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900">{s.name}</span>
                    <Badge className="bg-indigo-50 text-indigo-700">{s.count} leads</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-500">Conversão <b className="text-slate-900">{conversion}%</b></span>
                    <span className="font-semibold text-emerald-600">{currency(s.value)}</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(s.count / max) * 100}%` }}
                    className="h-full bg-indigo-500 rounded-full"
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
