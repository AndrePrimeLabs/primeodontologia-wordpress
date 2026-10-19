import { useEffect, useRef } from 'react';
import { toast } from '@/components/ui/use-toast';
import { queryClientInstance } from '@/lib/query-client';

const DEFAULT_TENANT_ID = '00000000-0000-4000-a000-000000000001';

export function useRealtimeMesh() {
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    const tenantId =
      localStorage.getItem('primeos_active_tenant_id') ||
      import.meta.env.VITE_TENANT_ID ||
      DEFAULT_TENANT_ID;

    const apiBaseUrl =
      import.meta.env.VITE_PRIMEOS_API_URL || 'http://localhost:5001/api';

    const streamUrl = `${apiBaseUrl}/events/stream?tenantId=${encodeURIComponent(tenantId)}`;

    function connect() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      console.log(`[Realtime Mesh] Connecting to SSE stream: ${streamUrl}`);
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.addEventListener('connected', (e) => {
        try {
          const payload = JSON.parse(e.data);
          console.log('[Realtime Mesh] Connected successfully:', payload);
        } catch {}
      });

      // 1. Omnichannel Lead Captured
      es.addEventListener('lead.captured', (e) => {
        try {
          const data = JSON.parse(e.data);
          toast({
            title: '📥 Novo Lead Capturado',
            description: `${data.lead?.name || 'Novo Lead'} via ${data.lead?.channel_name || 'Canal Digital'}`
          });
          queryClientInstance.invalidateQueries({ queryKey: ['leads'] });
          queryClientInstance.invalidateQueries({ queryKey: ['campaigns'] });
          queryClientInstance.invalidateQueries({ queryKey: ['channels'] });
        } catch (err) {
          console.warn('[Realtime Mesh] Error parsing lead.captured event:', err);
        }
      });

      // 2. Patient / Customer Created
      es.addEventListener('customer.created', (e) => {
        try {
          const data = JSON.parse(e.data);
          toast({
            title: '👤 Novo Paciente Cadastrado',
            description: data.customer?.name || 'Paciente adicionado ao CRM'
          });
          queryClientInstance.invalidateQueries({ queryKey: ['customers'] });
          queryClientInstance.invalidateQueries({ queryKey: ['patients'] });
        } catch (err) {
          console.warn('[Realtime Mesh] Error parsing customer.created event:', err);
        }
      });

      // 3. Customer Segmented
      es.addEventListener('customer.segmented', (e) => {
        try {
          const data = JSON.parse(e.data);
          toast({
            title: '🎯 Segmentação Concluída',
            description: `Perfil clínico atribuído: ${data.segmentName}`
          });
          queryClientInstance.invalidateQueries({ queryKey: ['customers'] });
          queryClientInstance.invalidateQueries({ queryKey: ['segments'] });
        } catch (err) {
          console.warn('[Realtime Mesh] Error parsing customer.segmented event:', err);
        }
      });

      // 4. Ticket Created
      es.addEventListener('ticket.created', (e) => {
        try {
          const data = JSON.parse(e.data);
          toast({
            title: '🎫 Novo Chamado Clínico',
            description: `Prioridade ${data.ticket?.priority || 'normal'} (#${data.ticket?.id?.slice(0, 8)})`
          });
          queryClientInstance.invalidateQueries({ queryKey: ['tickets'] });
        } catch (err) {
          console.warn('[Realtime Mesh] Error parsing ticket.created event:', err);
        }
      });

      // 5. Activity Created
      es.addEventListener('activity.created', (e) => {
        try {
          const data = JSON.parse(e.data);
          toast({
            title: '📋 Atividade Operacional',
            description: data.activity?.name || 'Nova atividade agendada'
          });
          queryClientInstance.invalidateQueries({ queryKey: ['activities'] });
          queryClientInstance.invalidateQueries({ queryKey: ['key_activities'] });
        } catch (err) {
          console.warn('[Realtime Mesh] Error parsing activity.created event:', err);
        }
      });

      // 6. Financial Transaction Created
      es.addEventListener('transaction.created', (e) => {
        try {
          const data = JSON.parse(e.data);
          const amount = Number(data.transaction?.amount || 0).toLocaleString('pt-BR', {
            style: 'currency',
            currency: data.transaction?.currency || 'BRL'
          });
          toast({
            title: '💰 Pagamento Registrado',
            description: `${amount} via ${(data.transaction?.payment_method || 'PIX').toUpperCase()}`
          });
          queryClientInstance.invalidateQueries({ queryKey: ['transactions'] });
          queryClientInstance.invalidateQueries({ queryKey: ['revenue'] });
          queryClientInstance.invalidateQueries({ queryKey: ['financial'] });
        } catch (err) {
          console.warn('[Realtime Mesh] Error parsing transaction.created event:', err);
        }
      });

      // 7. Partner Lab Order Dispatched
      es.addEventListener('lab_order.created', (e) => {
        try {
          const data = JSON.parse(e.data);
          toast({
            title: '🔬 Ordem de Laboratório Enviada',
            description: `Pedido de fabricação despachado para ${data.partner?.name || 'Parceiro'}`
          });
          queryClientInstance.invalidateQueries({ queryKey: ['partners'] });
          queryClientInstance.invalidateQueries({ queryKey: ['lab_orders'] });
        } catch (err) {
          console.warn('[Realtime Mesh] Error parsing lab_order.created event:', err);
        }
      });

      // 8. Expense / Fee Recorded
      es.addEventListener('expense.created', () => {
        queryClientInstance.invalidateQueries({ queryKey: ['expenses'] });
        queryClientInstance.invalidateQueries({ queryKey: ['costs'] });
      });

      es.onerror = () => {
        console.warn('[Realtime Mesh] SSE stream disconnected. Reconnecting in 5s...');
        es.close();
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);
}

export function RealtimeMeshListener() {
  useRealtimeMesh();
  return null;
}
