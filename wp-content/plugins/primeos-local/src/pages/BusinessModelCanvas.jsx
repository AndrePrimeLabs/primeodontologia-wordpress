// @ts-nocheck
import { useState, useEffect } from "react";
import { primeos, apiHttpClient } from "@/api/primeosClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import {
  Puzzle, Settings, Package, Gem, Heart, DoorOpen, Users, DollarSign, TrendingDown,
  Target, CheckCircle, Info, Activity, Radio, Play, RefreshCw, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

const dependencyColors = {
  alta: { bg: "bg-red-100", text: "text-red-700", border: "border-red-300" },
  media: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" },
  baixa: { bg: "bg-green-100", text: "text-green-700", border: "border-green-300" }
};

const categoryLabels = {
  fornecedor_estrategico: "Fornecedor Estratégico",
  laboratorio_dental: "Laboratório Odontológico",
  laboratorio: "Laboratório",
  implantes_cirurgia: "Implantes & Cirurgia",
  equipamento_material: "Equipamento/Material",
  pagamento_financiamento: "Pagamento/Financiamento",
  profissional_saude: "Profissional Saúde",
  assistencia_tecnica: "Assistência Técnica"
};

export default function BusinessModelCanvas() {
  const [activeTab, setActiveTab] = useState("canvas");
  const [meshLogs, setMeshLogs] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const queryClient = useQueryClient();

  // 1. Live queries across all 9 BMC building blocks
  const { data: partners = [] } = useQuery({
    queryKey: ["keyPartners"],
    queryFn: () => primeos.entities.KeyPartner.list()
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["keyActivities"],
    queryFn: () => primeos.entities.KeyActivity.list()
  });

  const { data: resources = [] } = useQuery({
    queryKey: ["keyResources"],
    queryFn: () => primeos.entities.KeyResource.list()
  });

  const { data: valueProps = [] } = useQuery({
    queryKey: ["valueProps"],
    queryFn: () => primeos.entities.ValueProposition.list()
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => primeos.entities.Customer.list({ limit: 100 })
  });

  const { data: channels = [] } = useQuery({
    queryKey: ["channels"],
    queryFn: () => primeos.entities.MarketingChannel.list()
  });

  const { data: segments = [] } = useQuery({
    queryKey: ["segments"],
    queryFn: () => primeos.entities.CustomerSegment.list()
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => primeos.entities.Product.list()
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => primeos.entities.Expense.list()
  });

  // Listen to live SSE events in component state for real-time mesh feed
  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    const tenantId =
      localStorage.getItem("primeos_active_tenant_id") ||
      import.meta.env.VITE_TENANT_ID ||
      "00000000-0000-4000-a000-000000000001";

    const apiBase = import.meta.env.VITE_PRIMEOS_API_URL || "http://localhost:5001/api";
    const es = new EventSource(`${apiBase}/events/stream?tenantId=${encodeURIComponent(tenantId)}`);

    const handleEvent = (eventName) => (e) => {
      try {
        const payload = JSON.parse(e.data);
        setMeshLogs((prev) => [
          {
            id: `${Date.now()}_${Math.random()}`,
            timestamp: new Date().toLocaleTimeString(),
            event: eventName,
            data: payload
          },
          ...prev.slice(0, 49)
        ]);
      } catch {}
    };

    const subjects = [
      "connected",
      "lead.captured",
      "customer.created",
      "customer.segmented",
      "ticket.created",
      "activity.created",
      "transaction.created",
      "lab_order.created",
      "resource.allocated",
      "expense.created"
    ];

    subjects.forEach((subj) => es.addEventListener(subj, handleEvent(subj)));

    return () => es.close();
  }, []);

  // Quick Simulation Handlers
  const triggerLeadSimulation = async () => {
    setIsSimulating(true);
    try {
      const leadName = `Lead Simulado ${Date.now().toString().slice(-4)}`;
      await apiHttpClient.post("/channels/capture-lead", {
        name: leadName,
        email: `lead.${Date.now()}@exemplo.com`,
        phone: `+55119${Date.now().toString().slice(-8)}`,
        notes: "Interesse em alinhadores transparentes (Simulação BMC)"
      });
      toast({
        title: "⚡ Simulação Disparada",
        description: `Lead capturado no CHAN-X. Observe a reação automática do CRM-X e SEG-X!`
      });
    } catch (err) {
      toast({ title: "Erro na simulação", description: err.message, variant: "destructive" });
    } finally {
      setIsSimulating(false);
    }
  };

  const triggerPaymentSimulation = async () => {
    setIsSimulating(true);
    try {
      const cust = customers[0] || { id: "00000000-0000-4000-a000-000000000001" };
      await apiHttpClient.post("/transactions", {
        customer_id: cust.id,
        amount: 14500,
        currency: "BRL",
        payment_method: "pix",
        status: "paid"
      });
      toast({
        title: "⚡ Pagamento Simulado (R$ 14.500)",
        description: "Transação criada no REV-X. Observe o envio de ordem no PART-X, taxa no COST-X e alocação no RES-X!"
      });
    } catch (err) {
      toast({ title: "Erro na simulação", description: err.message, variant: "destructive" });
    } finally {
      setIsSimulating(false);
    }
  };

  const canvasBlocks = [
    {
      id: "partners",
      title: "Key Partners (PART-X)",
      icon: Puzzle,
      color: "from-purple-500 to-indigo-600",
      liveCount: partners.length,
      liveSample: partners.map((p) => p.name).slice(0, 3),
      content: [
        "Invisalign / Align Technology (fornecedor estratégico)",
        "Laboratórios odontológicos homologados",
        "Straumann Group / Neodent (implantes e cirurgia guiada)",
        "Plataformas de pagamento (PIX 0.99%, Cartão 2.99%)",
        "Assistência técnica e calibração de scanners 3D"
      ]
    },
    {
      id: "activities",
      title: "Key Activities (ACT-X)",
      icon: Settings,
      color: "from-blue-500 to-cyan-600",
      liveCount: activities.length,
      liveSample: activities.map((a) => a.name).slice(0, 3),
      content: [
        "Escaneamento intraoral digital 3D (iTero 5D)",
        "Planejamento digital ClinCheck e DSD",
        "Execução clínica conforme POPs rígidos",
        "Suporte clínico e acompanhamento de alinhadores",
        "Biossegurança e gestão operacional"
      ]
    },
    {
      id: "resources",
      title: "Key Resources (RES-X)",
      icon: Package,
      color: "from-emerald-500 to-teal-600",
      liveCount: resources.length,
      liveSample: resources.map((r) => `${r.name} (${r.status})`).slice(0, 3),
      content: [
        "Scanner Intraoral 3D iTero Element 5D",
        "Consultório cirúrgico e estações clínicas",
        "Node Edge de IA Nvidia Jetson",
        "Biblioteca Digital Smile Design (DSD)",
        "Corpo clínico especializado e credenciado"
      ]
    },
    {
      id: "value",
      title: "Value Proposition (VALUE-X)",
      icon: Gem,
      color: "from-pink-500 to-rose-600",
      liveCount: valueProps.length,
      liveSample: valueProps.map((v) => v.name).slice(0, 3),
      content: [
        "100% digital smile simulation antes de iniciar",
        "Alinhadores invisíveis confortáveis e previsíveis",
        "Reabilitações biomiméticas preservando estrutura dental",
        "Atendimento concierge humanizado e pontual",
        "Padrão premium com segurança biológica"
      ]
    },
    {
      id: "relationships",
      title: "Customer Relationships (CRM-X)",
      icon: Heart,
      color: "from-red-500 to-pink-600",
      liveCount: customers.length,
      liveSample: customers.map((c) => c.name).slice(0, 3),
      content: [
        "Atendimento próximo com concierge exclusivo",
        "Acompanhamento ortodôntico a cada 4-8 semanas",
        "Linha direta para suporte de urgência e chamados",
        "Fidelização e programa de manutenção anual"
      ]
    },
    {
      id: "channels",
      title: "Channels (CHAN-X)",
      icon: DoorOpen,
      color: "from-amber-500 to-orange-600",
      liveCount: channels.length,
      liveSample: channels.map((c) => c.name).slice(0, 3),
      content: [
        "WhatsApp Direct Concierge & automação",
        "Demonstrações com scanner intraoral 3D",
        "Campanhas digitais de alto impacto (Meta/Google)",
        "Indicações de pacientes e rede médica parceira"
      ]
    },
    {
      id: "segments",
      title: "Customer Segments (SEG-X)",
      icon: Users,
      color: "from-indigo-500 to-purple-600",
      liveCount: segments.length,
      liveSample: segments.map((s) => s.name).slice(0, 3),
      content: [
        "Aesthetic Orthodontics & Alinhadores Invisíveis",
        "Restorative & Ceramic Smile Design",
        "Sleep & Pain Management (Bruxismo e DTM)",
        "Preventive & Family Oral Wellness"
      ]
    },
    {
      id: "revenue",
      title: "Revenue Streams (REV-X)",
      icon: DollarSign,
      color: "from-green-500 to-emerald-600",
      liveCount: products.length,
      liveSample: products.map((p) => `${p.name || p.sku} (R$ ${p.price || p.base_price})`).slice(0, 3),
      content: [
        "Tratamentos completos de alinhadores (Invisalign)",
        "Implantes dentários e cirurgias guiadas",
        "Lentes e facetas de porcelana biomimética",
        "Planos anuais de contenção e profilaxia",
        "Gateway multimeios com parcelamento facilitado"
      ]
    },
    {
      id: "costs",
      title: "Cost Structure (COST-X)",
      icon: TrendingDown,
      color: "from-slate-500 to-gray-600",
      liveCount: expenses.length,
      liveSample: expenses.map((e) => `${e.description} (R$ ${e.amount})`).slice(0, 2),
      content: [
        "Taxas laboratoriais de alinhadores e fresagem",
        "Materiais clínicos e insumos biocompatíveis",
        "Taxas de transação de gateway (0.99% PIX / 2.99% Cartão)",
        "Manutenção de infraestrutura e licenças de software",
        "Honorários e folha clínica especializada"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 p-6">
      <div className="max-w-[1800px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Puzzle className="w-8 h-8 text-purple-600" />
                <h1 className="text-3xl font-bold text-slate-900">
                  Business Model Canvas
                </h1>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 flex items-center gap-1.5 py-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  9 Microservices Conectados (NATS Mesh)
                </Badge>
              </div>
              <p className="text-slate-500 mt-1">
                Prime Odontologia — Master Operational Blueprint &amp; Dynamic Event Mesh Architecture
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries()}
                className="flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4 text-slate-600" />
                Atualizar Dados
              </Button>
            </div>
          </div>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="canvas"><Target className="w-4 h-4 mr-2" />Canvas Completo (9 Blocos)</TabsTrigger>
            <TabsTrigger value="mesh"><Activity className="w-4 h-4 mr-2" />Event Mesh em Tempo Real</TabsTrigger>
            <TabsTrigger value="partners"><Puzzle className="w-4 h-4 mr-2" />Key Partners</TabsTrigger>
            <TabsTrigger value="matrix"><Info className="w-4 h-4 mr-2" />Matriz Estratégica</TabsTrigger>
          </TabsList>

          {/* Canvas Completo */}
          <TabsContent value="canvas">
            <div className="grid lg:grid-cols-3 gap-4">
              {canvasBlocks.map((block, idx) => {
                const Icon = block.icon;
                return (
                  <motion.div key={block.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                    <Card className={cn("border-0 shadow-lg h-full overflow-hidden flex flex-col justify-between", block.id === "value" && "lg:col-span-3")}>
                      <div>
                        <CardHeader className={cn("bg-gradient-to-r text-white p-4", block.color)}>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Icon className="w-5 h-5" />
                              {block.title}
                            </CardTitle>
                            <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs">
                              {block.liveCount} ativos
                            </Badge>
                          </div>
                        </CardHeader>

                        <CardContent className="p-4">
                          <ul className={cn("space-y-2 mb-3", block.id === "value" && "grid md:grid-cols-2 lg:grid-cols-5 gap-3")}>
                            {block.content.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <span className="text-slate-700">{item}</span>
                              </li>
                            ))}
                          </ul>

                          {block.liveSample && block.liveSample.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <p className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                                <Radio className="w-3 h-3 text-purple-600" /> Registros no Microserviço:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {block.liveSample.map((s, si) => (
                                  <Badge key={si} variant="secondary" className="text-xs font-normal bg-slate-100 text-slate-800">
                                    {s}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            <Card className="mt-6 border-0 shadow-lg bg-gradient-to-br from-purple-50 to-indigo-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <Target className="w-6 h-6 text-purple-600 mt-1" />
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 mb-2">Visão Executiva &amp; Reatividade Operacional</h3>
                    <p className="text-slate-700 leading-relaxed">
                      A <strong>Prime Odontologia</strong> opera com um <strong>modelo premium orientado à tecnologia digital e automação operacional</strong>. 
                      Cada um dos 9 blocos possui microserviço autônomo acoplado ao barramento NATS, garantindo que aquisições em canais, 
                      avaliações clínicas, prescrições de laboratório e registros de receita reajam em tempo real sem atrito manual.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Event Mesh em Tempo Real */}
          <TabsContent value="mesh">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Painel de Controle e Status */}
              <div className="space-y-6">
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-500" />
                      Status do Event Mesh
                    </CardTitle>
                    <CardDescription>
                      Monitoramento da topologia de microserviços e barramento de mensagens.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                        <span className="font-semibold text-emerald-900 text-sm">NATS Message Broker</span>
                      </div>
                      <Badge className="bg-emerald-600 text-white">Online (Port 4222)</Badge>
                    </div>

                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                        <span className="font-semibold text-purple-900 text-sm">Traefik API Gateway</span>
                      </div>
                      <Badge className="bg-purple-600 text-white">Routed (Port 5001)</Badge>
                    </div>

                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                        <span className="font-semibold text-blue-900 text-sm">SSE Live Stream</span>
                      </div>
                      <Badge className="bg-blue-600 text-white">Ativo no Navegador</Badge>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-xs text-slate-500 mb-3 font-medium">DISPARO DE SIMULAÇÃO REATIVA:</p>
                      <div className="space-y-2">
                        <Button
                          size="sm"
                          className="w-full justify-start bg-indigo-600 hover:bg-indigo-700 text-white"
                          disabled={isSimulating}
                          onClick={triggerLeadSimulation}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Simular Lead (CHAN-X → CRM-X → SEG-X)
                        </Button>
                        <Button
                          size="sm"
                          className="w-full justify-start bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={isSimulating}
                          onClick={triggerPaymentSimulation}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Simular Pagamento (REV-X → PART-X → COST-X)
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="w-4 h-4 text-purple-600" />
                      Cadeia Reativa Automatizada
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-slate-600 space-y-2">
                    <p>• <strong>lead.captured:</strong> Converte lead em paciente e cria interação.</p>
                    <p>• <strong>customer.created:</strong> Dispara auto-segmentação dinâmica no SEG-X.</p>
                    <p>• <strong>customer.segmented:</strong> Associa proposta de valor no VALUE-X.</p>
                    <p>• <strong>transaction.created:</strong> Emite ordem no PART-X e calcula taxa no COST-X.</p>
                    <p>• <strong>lab_order.created:</strong> Reserva scanner e consultório no RES-X.</p>
                  </CardContent>
                </Card>
              </div>

              {/* Feed de Eventos em Tempo Real */}
              <div className="lg:col-span-2">
                <Card className="border-0 shadow-md h-full flex flex-col">
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                        Log de Eventos do Mesh em Tempo Real
                      </CardTitle>
                      <CardDescription>
                        Eventos propagados via NATS e entregues ao frontend via Server-Sent Events.
                      </CardDescription>
                    </div>
                    {meshLogs.length > 0 && (
                      <Button variant="ghost" size="xs" onClick={() => setMeshLogs([])}>
                        Limpar
                      </Button>
                    )}
                  </CardHeader>

                  <CardContent className="flex-1 overflow-y-auto max-h-[580px] p-4 bg-slate-900 rounded-b-xl text-slate-100 font-mono text-xs">
                    {meshLogs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 text-slate-500 space-y-2">
                        <Radio className="w-8 h-8 text-slate-600" />
                        <p>Aguardando eventos do barramento NATS...</p>
                        <p className="text-[11px] text-slate-600">Dispare uma simulação acima para observar a propagação.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {meshLogs.map((log) => (
                          <div key={log.id} className="p-3 bg-slate-800/80 rounded border border-slate-700">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-amber-400">{log.event}</span>
                              <span className="text-slate-400 text-[10px]">{log.timestamp}</span>
                            </div>
                            <pre className="text-[11px] text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(log.data, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Key Partners Detalhado */}
          <TabsContent value="partners">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(categoryLabels).map(([key, label]) => {
                const categoryPartners = partners.filter((p) => p.category === key);
                return (
                  <Card key={key} className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {categoryPartners.length > 0 ? (
                        <div className="space-y-2">
                          {categoryPartners.map((p) => (
                            <div key={p.id} className="p-2 bg-slate-50 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-sm">{p.name}</p>
                                <Badge className={cn(dependencyColors[p.dependency_level]?.bg, dependencyColors[p.dependency_level]?.text)}>
                                  {p.dependency_level || "média"}
                                </Badge>
                              </div>
                              {p.strategic_importance && (
                                <p className="text-xs text-purple-600 font-medium">Importância: {p.strategic_importance}</p>
                              )}
                              {p.contact_info && <p className="text-xs text-slate-500 mt-0.5">{p.contact_info}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 py-4">Nenhum parceiro cadastrado</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Matriz Dependência x Importância */}
          <TabsContent value="matrix">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  Matriz Estratégica: Dependência × Importância
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-red-50 rounded-xl border-2 border-red-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <h3 className="font-bold text-red-900">Alta Dependência / Alta Importância</h3>
                    </div>
                    <p className="text-sm text-red-700 mb-2">Parceiros Críticos (Estratégicos)</p>
                    <ul className="space-y-1 text-xs text-slate-600">
                      <li>• Align Technology (Invisalign &amp; iTero) — Fornecedor Crítico</li>
                      <li>• Laboratórios Odontológicos Especializados — Cerâmica e Prótese</li>
                      <li>• Straumann Group / Neodent — Implantes e Guias Cirúrgicos</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-xl border-2 border-amber-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <h3 className="font-bold text-amber-900">Média Dependência / Alta Importância</h3>
                    </div>
                    <p className="text-sm text-amber-700 mb-2">Parceiros de Alavancagem</p>
                    <ul className="space-y-1 text-xs text-slate-600">
                      <li>• Plataformas de Pagamento e Financiamento</li>
                      <li>• Gateways de Split e Antecipação</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-yellow-50 rounded-xl border-2 border-yellow-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <h3 className="font-bold text-yellow-900">Média Dependência / Média Importância</h3>
                    </div>
                    <p className="text-sm text-yellow-700 mb-2">Parceiros Operacionais</p>
                    <ul className="space-y-1 text-xs text-slate-600">
                      <li>• Fornecedores de Insumos Clínicos (Dental Cremer)</li>
                      <li>• Assistência Técnica de Equipamentos</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-green-50 rounded-xl border-2 border-green-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <h3 className="font-bold text-green-900">Baixa Dependência / Média Importância</h3>
                    </div>
                    <p className="text-sm text-green-700 mb-2">Parceiros de Suporte</p>
                    <ul className="space-y-1 text-xs text-slate-600">
                      <li>• Profissionais de Saúde Complementares</li>
                      <li>• Consultores e Especialistas Pontuais</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
