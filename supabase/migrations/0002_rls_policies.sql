-- =====================================================================
-- 0002_rls_policies.sql
-- Row Level Security. Tudo que não estiver explicitamente liberado é
-- bloqueado para o role `authenticated` / `anon`.
-- =====================================================================

alter table public.users      enable row level security;
alter table public.orders     enable row level security;
alter table public.deliveries enable row level security;
alter table public.revisions  enable row level security;
alter table public.reviews    enable row level security;

-- ---------- USERS ----------------------------------------------------

create policy "users readable by authenticated"
  on public.users for select
  to authenticated
  using (true);

create policy "users update own profile"
  on public.users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------- ORDERS ---------------------------------------------------

create policy "orders visible: open or own"
  on public.orders for select
  to authenticated
  using (
    status = 'OPEN'
    or contractor_id = auth.uid()
    or musician_id   = auth.uid()
  );

create policy "contractor creates own order"
  on public.orders for insert
  to authenticated
  with check (contractor_id = auth.uid() and status = 'OPEN');

create policy "participants update own order"
  on public.orders for update
  to authenticated
  using (contractor_id = auth.uid() or musician_id = auth.uid());

-- ---------- DELIVERIES ----------------------------------------------

create policy "deliveries visible to participants"
  on public.deliveries for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
       where o.id = deliveries.order_id
         and (o.contractor_id = auth.uid() or o.musician_id = auth.uid())
    )
  );

create policy "musician inserts delivery for own accepted order"
  on public.deliveries for insert
  to authenticated
  with check (
    musician_id = auth.uid()
    and exists (
      select 1 from public.orders o
       where o.id = deliveries.order_id
         and o.musician_id = auth.uid()
         and o.status in ('PAID', 'IN_REVISION')
    )
  );

-- ---------- REVISIONS ------------------------------------------------

create policy "revisions visible to participants"
  on public.revisions for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
       where o.id = revisions.order_id
         and (o.contractor_id = auth.uid() or o.musician_id = auth.uid())
    )
  );

create policy "contractor requests revision on own order"
  on public.revisions for insert
  to authenticated
  with check (
    contractor_id = auth.uid()
    and exists (
      select 1 from public.orders o
       where o.id = revisions.order_id
         and o.contractor_id = auth.uid()
         and o.status = 'DELIVERED'
         and o.revision_count < 2
    )
  );

-- ---------- REVIEWS --------------------------------------------------

create policy "reviews readable by authenticated"
  on public.reviews for select
  to authenticated
  using (true);

create policy "participant inserts review on completed order"
  on public.reviews for insert
  to authenticated
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from public.orders o
       where o.id = reviews.order_id
         and o.status = 'COMPLETED'
         and (o.contractor_id = auth.uid() or o.musician_id = auth.uid())
         and (
           (auth.uid() = o.contractor_id and reviews.reviewee_id = o.musician_id)
        or (auth.uid() = o.musician_id   and reviews.reviewee_id = o.contractor_id)
         )
    )
  );
