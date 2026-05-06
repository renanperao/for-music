-- =====================================================================
-- 0003_auto_approve_cron.sql
-- Auto-aprovação após 5 dias sem resposta do contratante.
-- Roda a cada 15 minutos via pg_cron.
-- =====================================================================

create extension if not exists pg_cron;

-- Conclui pedidos cujo prazo de aprovação venceu. A liberação do repasse
-- via Asaas é disparada por uma Edge Function que escuta a transição.
create or replace function public.auto_approve_expired_deliveries()
returns table (order_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.orders
     set status       = 'COMPLETED',
         completed_at = now()
   where status         = 'DELIVERED'
     and auto_approve_at is not null
     and auto_approve_at <= now()
  returning id;
end;
$$;

-- Agenda no banco de dados (pg_cron). A entrada é idempotente:
-- se o job já existir com mesmo nome, pg_cron mantém o último schedule.
select cron.schedule(
  'auto-approve-expired-deliveries',
  '*/15 * * * *',
  $$select public.auto_approve_expired_deliveries();$$
);
