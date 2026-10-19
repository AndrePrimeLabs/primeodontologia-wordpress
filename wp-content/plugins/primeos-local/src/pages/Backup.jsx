import { useState } from "react";
import { primeos } from "@/api/primeosClient";
import { useAuth } from "@/lib/auth-context";
import AccessDeniedError from "@/components/AccessDeniedError";
import { motion } from "framer-motion";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Database, Download, HardDrive, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

const GROUPS = [
  { label: "Clientes e Pacientes", entities: ["Customer", "PatientRecord", "MedicalRecord", "ClinicalNote"] },
  { label: "Agenda", entities: ["Appointment", "CrmAppointment", "Dentist"] },
  { label: "Vendas e Leads", entities: ["Lead", "Sale", "Product", "Interaction"] },
  { label: "Financeiro", entities: ["FinancialTransaction", "Expense", "Budget", "FinancialGoal"] },
  { label: "Operação", entities: ["Task", "Activity", "InventoryItem", "SOP", "POP", "SupportTicket"] },
  { label: "Marketing", entities: ["Campaign", "Content", "MarketingChannel", "MarketingMetric", "AutomationWorkflow"] },
];

export default function Backup() {
  const { hasRole } = useAuth();
  const [selected, setSelected] = useState(GROUPS.map((g) => g.label));
  const [running, setRunning] = useState(false);
  const [lastBackup, setLastBackup] = useState(
    typeof window !== "undefined" ? localStorage.getItem("primeos_last_backup") : null
  );

  if (!hasRole('admin')) {
    return <AccessDeniedError requiredRole="ADMIN" pageTitle="Backup do Banco de Dados" />;
  }

  const toggle = (label) =>
    setSelected((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  const runBackup = async () => {
    setRunning(true);
    const payload = { generated_at: new Date().toISOString(), data: {} };
    let total = 0;
    try {
      for (const group of GROUPS.filter((g) => selected.includes(g.label))) {
        for (const entity of group.entities) {
          try {
            const rows = await primeos.entities[entity].list();
            payload.data[entity] = rows;
            total += rows.length;
          } catch {
            payload.data[entity] = [];
          }
        }
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `primeos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const stamp = new Date().toISOString();
      localStorage.setItem("primeos_last_backup", stamp);
      setLastBackup(stamp);
      toast.success(`Backup gerado com ${total} registros`);
    } catch (e) {
      toast.error(e?.message || "Falha ao gerar backup");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-[1100px] mx-auto">
      <PageHeader title="Backup" subtitle="Exporte uma cópia completa dos seus dados" icon={Database} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard title="Grupos selecionados" value={selected.length} icon={HardDrive} />
        <StatCard
          title="Último backup"
          value={lastBackup ? new Date(lastBackup).toLocaleDateString("pt-BR") : "Nunca"}
          icon={ShieldCheck}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard title="Formato" value="JSON" icon={Download} iconBg="bg-amber-50" iconColor="text-amber-600" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-4">O que incluir no backup</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {GROUPS.map((g, i) => (
            <motion.label
              key={g.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer"
            >
              <Checkbox checked={selected.includes(g.label)} onCheckedChange={() => toggle(g.label)} />
              <div>
                <p className="text-sm font-medium text-slate-900">{g.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{g.entities.length} conjuntos de dados</p>
              </div>
            </motion.label>
          ))}
        </div>

        <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-100">
          <Badge variant="outline" className="text-xs">O arquivo é baixado direto no seu computador</Badge>
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={runBackup} disabled={running || selected.length === 0}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {running ? "Gerando..." : "Gerar backup"}
          </Button>
        </div>
      </div>
    </div>
  );
}
