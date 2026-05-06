-- =====================================================================
-- 0001_initial_schema.sql
-- Tabelas, enums, índices e triggers da plataforma de contratação musical.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- ENUMS ----------------------------------------------------

create type user_role as enum ('contractor', 'musician', 'both');

create type pix_key_type as enum ('cpf', 'cnpj', 'email', 'phone', 'evp');

create type order_status as enum (
  'OPEN',
  'ACCEPTED',
  'PAID',
  'DELIVERED',
  'IN_REVISION',
  'COMPLETED',
  'DISPUTED'
);

-- ---------- USERS ----------------------------------------------------
-- Espelha auth.users com perfil da plataforma. O cadastro do músico
-- exige apenas a chave PIX — usada pela API Asaas para repasse direto.

create table public.users (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null,
  full_name           text,
  role                user_role not null default 'contractor',
  bio                 text,
  avatar_url          text,

  -- Recebimento (músico): chave PIX. Validação de formato fica no app.
  pix_key             text,
  pix_key_type        pix_key_type,

  -- Pagamento (contratante): id de cliente Asaas para emitir cobranças.
  asaas_customer_id   text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint pix_key_pair_complete
    check ((pix_key is null and pix_key_type is null)
        or (pix_key is not null and pix_key_type is not null))
);

create index users_role_idx on public.users(role);

-- ---------- ORDERS ---------------------------------------------------
-- Pedido de contratação. Status é o enum central da máquina de estados.
-- Valores monetários sempre em centavos (integer) para evitar float.

create table public.orders (
  id                uuid primary key default gen_random_uuid(),

  contractor_id     uuid not null references public.users(id) on delete restrict,
  musician_id       uuid          references public.users(id) on delete restrict,

  title             text not null,
  instrument        text not null,
  style             text not null,
  briefing          text not null,
  usage_rights      text not null,

  deadline          timestamptz not null,
  budget_cents      integer     not null check (budget_cents >= 5000), -- min R$50,00

  status            order_status not null default 'OPEN',

  -- Integração Asaas
  -- asaas_payment_id : id da cobrança PIX/cartão criada no checkout
  -- asaas_transfer_id: id da PIX Transfer disparada na liberação (90% pro músico)
  asaas_payment_id  text,
  asaas_transfer_id text,
  released_at       timestamptz, -- quando a PIX Transfer foi disparada

  -- Controle de revisões: máximo 2 (regra de negócio)
  revision_count    smallint not null default 0 check (revision_count between 0 and 2),

  -- Carimbos da máquina de estados
  accepted_at       timestamptz,
  paid_at           timestamptz,
  delivered_at      timestamptz,
  auto_approve_at   timestamptz, -- delivered_at + 5 dias
  completed_at      timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint contractor_not_musician
    check (musician_id is null or musician_id <> contractor_id)
);

create index orders_status_idx       on public.orders(status);
create index orders_contractor_idx   on public.orders(contractor_id);
create index orders_musician_idx     on public.orders(musician_id);
create index orders_open_idx         on public.orders(created_at desc) where status = 'OPEN';
create index orders_auto_approve_idx on public.orders(auto_approve_at) where status = 'DELIVERED';

-- ---------- DELIVERIES ----------------------------------------------
-- Cada upload do músico vira uma linha. Apenas uma é "is_current = true"
-- por pedido (entrega vigente). As anteriores ficam como histórico.

create table public.deliveries (
  id                uuid primary key default gen_random_uuid(),

  order_id          uuid not null references public.orders(id)  on delete cascade,
  musician_id       uuid not null references public.users(id)   on delete restrict,

  file_key          text   not null, -- chave do objeto no R2
  file_name         text   not null,
  file_size_bytes   bigint not null check (file_size_bytes > 0
                                       and file_size_bytes <= 209715200), -- 200MB
  mime_type         text   not null check (mime_type in (
                      'audio/wav', 'audio/x-wav',
                      'audio/mpeg',
                      'audio/aiff', 'audio/x-aiff'
                    )),
  duration_seconds  integer check (duration_seconds is null or duration_seconds > 0),

  notes             text,

  delivered_at      timestamptz not null default now(),
  is_current        boolean     not null default true
);

create index deliveries_order_idx on public.deliveries(order_id);
-- Garante apenas uma entrega vigente por pedido
create unique index deliveries_one_current_per_order
  on public.deliveries(order_id) where is_current;

-- ---------- REVISIONS ------------------------------------------------
-- Pedido de revisão do contratante sobre uma entrega específica.

create table public.revisions (
  id              uuid primary key default gen_random_uuid(),

  order_id        uuid not null references public.orders(id)      on delete cascade,
  delivery_id     uuid not null references public.deliveries(id)  on delete cascade,
  contractor_id   uuid not null references public.users(id)       on delete restrict,

  feedback        text not null check (length(feedback) between 10 and 4000),

  requested_at    timestamptz not null default now()
);

create index revisions_order_idx on public.revisions(order_id);

-- ---------- REVIEWS --------------------------------------------------
-- Avaliação pós-conclusão. Cada participante pode avaliar uma vez.

create table public.reviews (
  id            uuid primary key default gen_random_uuid(),

  order_id      uuid     not null references public.orders(id) on delete cascade,
  reviewer_id   uuid     not null references public.users(id)  on delete restrict,
  reviewee_id   uuid     not null references public.users(id)  on delete restrict,

  rating        smallint not null check (rating between 1 and 5),
  comment       text     check (comment is null or length(comment) <= 1000),

  created_at    timestamptz not null default now(),

  constraint reviewer_not_reviewee check (reviewer_id <> reviewee_id),
  unique (order_id, reviewer_id)
);

create index reviews_reviewee_idx on public.reviews(reviewee_id);

-- ---------- TRIGGERS -------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Sincroniza auth.users -> public.users na criação de conta
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name',
             new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
