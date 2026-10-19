// @ts-nocheck
import { useMemo, useState } from "react";
import { primeos } from "@/api/primeosClient";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, PiggyBank, BarChart3 } from "lucide-react";

const currency = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));

const monthKey = (d) => {
  const date = d ? new Date(d) : null;
  if (!date || isNaN(date)) return "—";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (key) => {
  if (key === "—") return "Sem data";
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

export default function RelatoriosFinanceiros() {
  const [period, setPeriod] = useState("6");

  const { data: transactions = [] } = useQuery({
    queryKey: ["financial_transactions"],
    queryFn: () => primeos.entities.FinancialTransaction.list("-created_date"),
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => primeos.entities.Expense.list("-created_date"),
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: () => primeos.entities.Sale.list("-created_date"),
  });

  const rows = useMemo(() => {
    const entries = [
      ...transactions.map((t) => ({
        date: t.date || t.created_date,
        amount: Number(t.amount || t.value || 0),
        kind: (t.type || t.tipo || "receita").toLowerCase().includes("desp") ? "despesa" : "receita",
        label: t.description || t.title || "Transação",
      })),
      ...expenses.map((e) => ({
        date: e.date || e.created_date,
        amount: Number(e.amount || e.value || 0),
        kind: "despesa",
        label: e.description || e.title || e.category || "Despesa",
      })),
      ...sales.map((s) => ({
        date: s.date || s.created_date,
        amount: Number(s.total || s.amount || s.value || 0),
        kind: "receita",
        label: s.product_name || s.title || "Venda",
      })),
    ];
    return entries.filter((e) => e.amount);
  }, [transactions, expenses, sales]);

  const months = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const key = monthKey(r.date);
      const entry = map.get(key) || { key, receita: 0, despesa: 0 };
      entry[r.kind] += r.amount;
      map.set(key, entry);
    });
    const list = [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
    return period === "all" ? list : list.slice(0, Number(period));
  }, [rows, period]);

  const receita = months.reduce((s, m) => s + m.receita, 0);
  const despesa = months.reduce((s, m) => s + m.despesa, 0);
  const lucro = receita - despesa;
  const margem = receita ? Math.round((lucro / receita) * 100) : 0;
  const max = Math.max(1, ...months.map((m) => Math.max(m.receita, m.despesa)));

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader title="Relatórios Financeiros" subtitle="Receitas, despesas e resultado por período" icon={BarChart3} />

      <div className="flex justify-end mb-5">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Últimos 3 meses</SelectItem>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Últimos 12 meses</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Receita" value={currency(receita)} icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
        <StatCard title="Despesas" value={currency(despesa)} icon={TrendingDown} iconBg="bg-rose-50" iconColor="text-rose-600" />
        <StatCard title="Resultado" value={currency(lucro)} icon={DollarSign} />
        <StatCard title="Margem" value={`${margem}%`} icon={PiggyBank} iconBg="bg-amber-50" iconColor="text-amber-600" />
      </div>

      {months.length === 0 ? (
        <EmptyState icon={BarChart3} title="Sem movimentações" description="Cadastre vendas, receitas ou despesas para ver os relatórios." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
          {months.map((m, i) => {
            const resultado = m.receita - m.despesa;
            return (
              <motion.div
                key={m.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-slate-900 capitalize">{monthLabel(m.key)}</span>
                  <Badge className={resultado >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>
                    {currency(resultado)}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-20">Receita</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(m.receita / max) * 100}%` }} className="h-full bg-emerald-500" />
                    </div>
                    <span className="text-xs font-medium text-slate-700 w-28 text-right">{currency(m.receita)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-20">Despesa</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(m.despesa / max) * 100}%` }} className="h-full bg-rose-500" />
                    </div>
                    <span className="text-xs font-medium text-slate-700 w-28 text-right">{currency(m.despesa)}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
