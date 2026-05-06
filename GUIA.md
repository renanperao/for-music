# Guia de desenvolvimento — for-music

Marketplace onde **contratantes** publicam pedidos de gravação e **músicos** os aceitam, entregam e recebem via PIX. Este documento cobre tudo: configuração local, arquitetura, rotas de API, UI, pagamentos e jobs automáticos.

---

## Sumário

1. [Stack e estrutura de pastas](#1-stack-e-estrutura-de-pastas)
2. [Variáveis de ambiente](#2-variáveis-de-ambiente)
3. [Rodando localmente](#3-rodando-localmente)
4. [Autenticação](#4-autenticação)
5. [Ciclo de vida de um pedido](#5-ciclo-de-vida-de-um-pedido)
6. [API REST — referência completa](#6-api-rest--referência-completa)
7. [Páginas da UI](#7-páginas-da-ui)
8. [Fluxo de pagamento (Asaas)](#8-fluxo-de-pagamento-asaas)
9. [Fluxo de entrega de áudio (R2)](#9-fluxo-de-entrega-de-áudio-r2)
10. [Auto-aprovação](#10-auto-aprovação)
11. [Convenções de código](#11-convenções-de-código)
12. [Tipos e banco de dados](#12-tipos-e-banco-de-dados)

---

## 1. Stack e estrutura de pastas

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 14 (App Router) |
| Auth + DB | Supabase (PostgreSQL + RLS) |
| Pagamentos | Asaas (PIX e cartão) |
| Storage | Cloudflare R2 (uploads de áudio) |
| Estilos | Tailwind CSS (tema escuro zinc/violet) |
| Validação | Zod |
| Linguagem | TypeScript strict |

```
src/
├── app/
│   ├── (auth)/login/          # página de login (magic link)
│   ├── (app)/                 # layout protegido + páginas autenticadas
│   │   ├── layout.tsx         # sidebar nav — verifica sessão server-side
│   │   ├── dashboard/
│   │   ├── orders/
│   │   │   ├── page.tsx       # lista de pedidos
│   │   │   ├── new/           # formulário de criação
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # detalhe do pedido (Server Component)
│   │   │       └── order-actions.tsx # ações interativas (Client Component)
│   │   └── profile/
│   ├── api/                   # route handlers Next.js
│   │   ├── me/
│   │   ├── orders/
│   │   ├── internal/          # endpoints internos (jobs)
│   │   ├── webhooks/asaas/
│   │   └── auth/signout/
│   ├── auth/callback/         # troca code→sessão (OAuth/magic link)
│   └── auth/confirm/          # verifica OTP token_hash
├── lib/
│   ├── auth.ts                # requireUser(), requireRole()
│   ├── http.ts                # HttpError, withErrorHandling, parseJson
│   ├── env.ts                 # variáveis de ambiente tipadas
│   ├── format.ts              # formatCents, formatDate, formatDateTime
│   ├── release.ts             # lógica de escrow → PIX Transfer
│   ├── payouts.ts             # cálculo de fee (plataforma) e repasse (músico)
│   ├── supabase/
│   │   ├── server.ts          # cliente SSR (usa cookie da sessão)
│   │   ├── client.ts          # cliente browser (para Client Components)
│   │   └── service.ts         # service-role (bypassa RLS — só em jobs/webhooks)
│   ├── asaas/                 # integração com a API Asaas
│   │   ├── client.ts
│   │   ├── customers.ts
│   │   ├── payments.ts
│   │   └── transfers.ts
│   ├── r2/client.ts           # presigned URLs do Cloudflare R2
│   └── validations/           # schemas Zod reutilizáveis
├── middleware.ts              # protege rotas /dashboard /orders /profile
└── types/database.ts          # tipos TypeScript do schema Supabase
supabase/
└── functions/auto-approve-runner/  # Edge Function Deno
```

---

## 2. Variáveis de ambiente

Crie um `.env.local` na raiz com as seguintes variáveis:

```env
# Supabase — obrigatórios
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...   # apenas server-side, nunca expor

# Asaas — pagamentos (sandbox: https://api-sandbox.asaas.com/v3)
ASAAS_API_URL=https://api-sandbox.asaas.com/v3
ASAAS_API_KEY=$aact_...
ASAAS_WEBHOOK_TOKEN=seu-token-secreto   # validação do webhook
ASAAS_PLATFORM_WALLET_ID=              # opcional: wallet da plataforma para split

# Cloudflare R2 — uploads de áudio
R2_ACCOUNT_ID=abc123
R2_ACCESS_KEY_ID=key
R2_SECRET_ACCESS_KEY=secret
R2_BUCKET_NAME=for-music-audio
R2_PUBLIC_BASE_URL=                     # opcional: CDN pública

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
PLATFORM_FEE_PERCENT=10                 # % de fee da plataforma (padrão: 10)
AUTO_APPROVE_AFTER_DAYS=5               # dias até auto-aprovação (padrão: 5)
MAX_REVISIONS=2                         # máx. revisões por pedido (padrão: 2)
INTERNAL_JOB_TOKEN=segredo-job          # token para o job de auto-approve
```

> **Dica de sandbox:** No Asaas sandbox use `$aact_` como prefixo da API key. O webhook pode ser testado com [ngrok](https://ngrok.com/) apontando para `http://localhost:3000/api/webhooks/asaas`.

---

## 3. Rodando localmente

```bash
npm install
npm run dev          # Next.js em http://localhost:3000
npm run typecheck    # verificação de tipos TypeScript
npm run build        # build de produção
```

Para gerar os tipos TypeScript a partir do schema real do Supabase:

```bash
npm run db:types
# equivale a: supabase gen types typescript --linked > src/types/database.ts
```

---

## 4. Autenticação

### Fluxo do magic link

1. Usuário acessa `/login` e digita seu email.
2. O frontend chama `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: '/auth/callback' } })`.
3. Supabase envia um email com um link de acesso.
4. Ao clicar no link, o usuário é redirecionado para `/auth/callback?code=...` (ou `/auth/confirm?token_hash=...&type=magiclink`).
5. O route handler troca o `code`/`token_hash` por uma sessão e armazena o cookie.
6. Redirect final para `/dashboard`.

### Proteção de rotas

O `src/middleware.ts` intercepta todas as requisições (exceto `/api`, `/auth`, assets):

- Se o caminho começa com `/dashboard`, `/orders` ou `/profile` e não há sessão → redireciona para `/login`.
- Se o caminho é `/login` e há sessão → redireciona para `/dashboard`.
- Em todos os casos o middleware também **renova o cookie de sessão** antes de continuar.

### Papéis de usuário (`role`)

| Papel | O que pode fazer |
|-------|-----------------|
| `contractor` | Criar pedidos, pagar, aprovar/revisar entregas, avaliar músico |
| `musician` | Aceitar pedidos abertos, fazer upload de áudio, avaliar contratante |
| `both` | Tudo acima (exceto aceitar o próprio pedido) |

O papel é definido em `/profile` e verificado pelo helper `requireRole()` nos route handlers.

> **Atenção:** Para aceitar um pedido, o músico precisa ter a chave PIX cadastrada no perfil. O endpoint `/accept` valida isso antes de prosseguir.

---

## 5. Ciclo de vida de um pedido

```
OPEN → ACCEPTED → PAID → DELIVERED ──────────────────→ COMPLETED
                              │                              ↑
                              └→ IN_REVISION → (novo upload) ┘

(qualquer estado pode ser escalado para DISPUTED por admin)
```

| Status | Quem age | Como avançar |
|--------|----------|--------------|
| `OPEN` | Músico | `POST /api/orders/:id/accept` |
| `ACCEPTED` | Contratante | `POST /api/orders/:id/checkout` (gera cobrança Asaas) |
| `PAID` | Músico | Upload via R2 + `POST /api/orders/:id/deliveries` |
| `DELIVERED` | Contratante | `POST /api/orders/:id/approve` **ou** `POST /api/orders/:id/revisions` |
| `IN_REVISION` | Músico | Novo upload — mesmo fluxo de `PAID` |
| `COMPLETED` | Ambos | `POST /api/orders/:id/reviews` (avaliação opcional) |

A transição `ACCEPTED → PAID` **não** é feita por route handler — é acionada pelo **webhook Asaas** (`PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED`).

A transição `DELIVERED → COMPLETED` pode ser acionada automaticamente pelo **pg_cron** após `AUTO_APPROVE_AFTER_DAYS` dias sem aprovação manual.

---

## 6. API REST — referência completa

Todos os endpoints retornam JSON. Erros seguem o formato:

```json
{ "error": "Mensagem legível", "details": "..." }
```

### Perfil

#### `GET /api/me`
Retorna o perfil do usuário autenticado.

```json
// 200
{ "profile": { "id": "uuid", "email": "...", "role": "musician", ... } }
```

#### `PATCH /api/me`
Atualiza campos do perfil. Todos os campos são opcionais.

```json
// body
{
  "full_name": "João Silva",
  "role": "musician",          // "contractor" | "musician" | "both"
  "bio": "Violinista clássico com 10 anos...",
  "pix_key": "joao@email.com",
  "pix_key_type": "email"      // "cpf" | "cnpj" | "email" | "phone" | "evp"
}
```

> `pix_key` e `pix_key_type` devem ser fornecidos juntos — ou ambos com valor, ou ambos `null`.

---

### Pedidos

#### `POST /api/orders`
Cria um novo pedido. Requer papel `contractor` ou `both`.

```json
// body
{
  "title": "Gravação de violino para trilha",
  "instrument": "Violino",
  "style": "Clássico",
  "briefing": "Precisamos de uma melodia de 60s com tom emotivo...",
  "usage_rights": "Uso comercial em campanha nacional",
  "deadline": "2026-06-01T18:00:00.000Z",  // pelo menos 24h no futuro
  "budget_cents": 50000                     // mínimo 5000 (R$ 50,00)
}
```

```json
// 201
{ "order": { "id": "uuid", "status": "OPEN", ... } }
```

#### `GET /api/orders`
Lista pedidos. Aceita query params:

| Param | Valores | Comportamento |
|-------|---------|---------------|
| `scope` | `open` | Todos os pedidos OPEN (para músicos navegarem) |
| `scope` | `mine` | Pedidos onde o usuário é contratante ou músico |
| *(sem scope)* | — | Contratante vê os seus; músico vê OPEN + participações |
| `status` | `OPEN`, `PAID`, etc. | Filtra por status (combinável com scope) |
| `limit` | 1–100 | Padrão: 50 |

```json
// 200
{ "orders": [ { "id": "uuid", "title": "...", "status": "OPEN", ... } ] }
```

#### `GET /api/orders/:id`
Detalhe de um pedido com entregas e revisões. Disponível apenas para participantes (ou qualquer um se `OPEN`).

```json
// 200
{
  "order": { ... },
  "deliveries": [ { "id": "uuid", "file_name": "...", "is_current": true, ... } ],
  "revisions": [ { "id": "uuid", "feedback": "...", ... } ],
  "currentDeliveryUrl": "https://..."  // URL assinada R2, válida 10 min
}
```

#### `POST /api/orders/:id/accept`
Músico aceita um pedido `OPEN`. Requer papel `musician` ou `both` e chave PIX cadastrada.

```json
// 200
{ "order": { "status": "ACCEPTED", "musician_id": "uuid", ... } }
```

> Usa update condicional (`.eq('status', 'OPEN').is('musician_id', null)`) para evitar race condition entre dois músicos clicando ao mesmo tempo.

#### `POST /api/orders/:id/checkout`
Contratante gera uma cobrança Asaas para pagar um pedido `ACCEPTED`.

```json
// body
{
  "billingType": "PIX",          // ou "CREDIT_CARD"
  "payerCpfCnpj": "12345678901", // CPF (11 dígitos) ou CNPJ (14 dígitos)
  "payerPhone": "11999999999"    // opcional
}
```

```json
// 200 — quando billingType = "PIX"
{
  "paymentId": "pay_xxx",
  "billingType": "PIX",
  "pix": {
    "payload": "00020126...",        // copia e cola
    "encodedImage": "iVBOR...",      // base64 do QR code PNG
    "expiresAt": "2026-05-09T..."
  }
}

// 200 — quando billingType = "CREDIT_CARD"
{
  "paymentId": "pay_xxx",
  "billingType": "CREDIT_CARD",
  "invoiceUrl": "https://www.asaas.com/i/..."
}
```

> O status só muda para `PAID` quando o webhook Asaas confirmar o pagamento.

#### `POST /api/orders/:id/deliveries/upload-url`
Músico solicita uma URL de upload direto ao R2. Pedido deve estar em `PAID` ou `IN_REVISION`.

```json
// body
{
  "fileName": "violino-final.wav",
  "mimeType": "audio/wav",     // wav, x-wav, mpeg, aiff, x-aiff
  "sizeBytes": 52428800        // máximo 200MB
}
```

```json
// 200
{
  "fileKey": "orders/uuid/uuid.wav",
  "uploadUrl": "https://...",        // PUT direto para o R2, expira em 10 min
  "expiresInSeconds": 600,
  "maxBytes": 209715200
}
```

#### `POST /api/orders/:id/deliveries`
Músico registra a entrega após o upload R2. Transiciona para `DELIVERED` e calcula `auto_approve_at`.

```json
// body
{
  "file_key": "orders/uuid/uuid.wav",  // retornado pelo upload-url
  "file_name": "violino-final.wav",
  "file_size_bytes": 52428800,
  "mime_type": "audio/wav",
  "duration_seconds": 62,              // opcional
  "notes": "Gravei em dois takes..."   // opcional
}
```

```json
// 201
{ "delivery": { ... }, "order": { "status": "DELIVERED", ... } }
```

#### `POST /api/orders/:id/approve`
Contratante aprova a entrega vigente. Transiciona para `COMPLETED` e dispara o PIX Transfer para o músico (90% do valor; 10% fica na plataforma).

```json
// 200
{
  "order": { "status": "COMPLETED", ... },
  "release": {
    "orderId": "uuid",
    "transferId": "tr_xxx",
    "amountCents": 45000,
    "feeCents": 5000,
    "alreadyReleased": false
  }
}
```

> Se a Asaas falhar no repasse, o pedido fica `COMPLETED` (não é revertido) e o `release` retorna um objeto de erro. Um admin pode retentar via `POST /api/internal/release-payment`.

#### `POST /api/orders/:id/revisions`
Contratante pede revisão da entrega vigente. Pedido deve estar em `DELIVERED`. Máximo `MAX_REVISIONS` revisões por pedido (padrão: 2).

```json
// body
{ "feedback": "O tom ficou muito agudo no compasso 8. Pode suavizar?" }
```

```json
// 201
{ "revision": { ... }, "order": { "status": "IN_REVISION", ... } }
```

#### `POST /api/orders/:id/reviews`
Participante avalia o outro após o pedido ser `COMPLETED`. Cada participante pode avaliar uma vez.

```json
// body
{
  "rating": 5,                      // 1 a 5
  "comment": "Excelente trabalho!"  // opcional
}
```

```json
// 201
{ "review": { "rating": 5, ... } }
```

---

### Webhooks e jobs internos

#### `POST /api/webhooks/asaas`
Recebe eventos da Asaas. Protegido pelo header `asaas-access-token` (deve ser igual ao `ASAAS_WEBHOOK_TOKEN`).

Eventos tratados:
- `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` → `ACCEPTED → PAID`
- `PAYMENT_REFUNDED` / `PAYMENT_DELETED` → reverte para `ACCEPTED`, limpa `asaas_payment_id`

Eventos ignorados devolvem `200 { "ignored": true }` para não causar retentativas.

#### `POST /api/internal/release-payment`
Endpoint chamado pela Edge Function para disparar repasses em lote. Autenticado por `Authorization: Bearer <INTERNAL_JOB_TOKEN>`.

```json
// body
{ "orderIds": ["uuid1", "uuid2"] }

// 200
{ "results": [ { "ok": true, "orderId": "uuid1", "transferId": "tr_xxx", ... } ] }
```

---

## 7. Páginas da UI

### `/login`
Formulário de magic link. Estado do componente local (`useState`):
- Após envio bem-sucedido: exibe mensagem de confirmação com o email.
- Em caso de erro Supabase: exibe a mensagem de erro inline.

### `/dashboard`
Server Component. Busca em paralelo:
- Perfil do usuário (nome + papel)
- Últimos 20 pedidos onde o usuário é parte

Exibe 3 cards de stats (Ativos / Concluídos / Abertos) e lista os 8 pedidos mais recentes.

Botões de ação rápida dependem do papel:
- `contractor`/`both`: "Novo pedido" → `/orders/new`
- `musician`/`both`: "Ver pedidos abertos" → `/orders?scope=open`

### `/orders`
Server Component com `searchParams`. Aceita os mesmos parâmetros da API (`scope`, `status`). Renderiza tabs de escopo e chips de filtro como links `<Link href="...">` — sem JavaScript de estado, todo o filtro vai para a URL.

### `/orders/new`
Client Component puro. Converte o campo "Orçamento em R$" para centavos antes de enviar para `POST /api/orders`. Após criação bem-sucedida redireciona para `/orders/:id`.

### `/orders/:id`
**Server Component** responsável por:
1. Buscar order com joins de `contractor` e `musician` (nome + email)
2. Buscar deliveries, revisions e reviews em paralelo
3. Gerar URL assinada R2 para a entrega atual (expira em 10 min)
4. Renderizar player `<audio>` se houver URL

Passa os dados para o **Client Component `<OrderActions>`** que renderiza o painel de ação correto conforme `status` e identidade do usuário:

| Condição | Painel exibido |
|----------|---------------|
| OPEN + não é contratante | Botão "Aceitar pedido" |
| OPEN + é contratante | "Aguardando aceite" |
| ACCEPTED + é contratante | Formulário de checkout PIX/cartão com QR code |
| PAID ou IN_REVISION + é músico | Uploader de arquivo de áudio com barra de progresso |
| DELIVERED + é contratante | Botões "Aprovar" e "Pedir revisão" (com campo de feedback) |
| COMPLETED + sem avaliação | Formulário de avaliação com estrelas |
| COMPLETED + já avaliou | Mensagem de confirmação |
| DISPUTED | Mensagem de suporte |

Após cada ação bem-sucedida o componente chama `router.refresh()` para o Server Component refazer o fetch com os dados atualizados.

### `/profile`
Híbrido: Server Component carrega o perfil e renderiza o Client Component `<ProfileForm>`. O formulário chama `PATCH /api/me` e exibe feedback de sucesso/erro inline.

---

## 8. Fluxo de pagamento (Asaas)

```
Contratante → /checkout → Asaas cria cobrança
                              │
                    PIX: QR exibido na UI
                    Cartão: link de fatura
                              │
                    Pagador paga na Asaas
                              │
                    Asaas envia webhook PAYMENT_CONFIRMED
                              ↓
              /api/webhooks/asaas → atualiza status → PAID
                              ↓
          Músico faz upload e chama /deliveries → DELIVERED
                              ↓
     Contratante aprova → /approve → COMPLETED
                              ↓
     releasePayment() → Asaas PIX Transfer (90%) → músico recebe
```

### Cálculo de split

```
totalCents = budget_cents do pedido
feeCents   = floor(totalCents * PLATFORM_FEE_PERCENT / 100)
payoutCents = totalCents - feeCents
```

Com `PLATFORM_FEE_PERCENT=10` e pedido de R$ 500,00:
- Plataforma: R$ 50,00
- Músico recebe: R$ 450,00

O arredondamento sempre favorece o músico (`Math.floor` na fee).

### Idempotência

O campo `asaas_transfer_id` é usado para evitar double-release: se já estiver preenchido, `releasePayment()` retorna `{ alreadyReleased: true }` sem criar nova transferência.

---

## 9. Fluxo de entrega de áudio (R2)

O upload é feito diretamente do browser para o R2 (sem proxy pelo servidor), em 3 passos:

```
1. Browser → POST /api/orders/:id/deliveries/upload-url
   ← { fileKey, uploadUrl }

2. Browser → PUT uploadUrl (direto ao R2)
   body: o arquivo de áudio
   header: Content-Type: audio/wav (ou o mime correto)

3. Browser → POST /api/orders/:id/deliveries
   body: { file_key, file_name, file_size_bytes, mime_type, notes? }
   ← pedido transiciona para DELIVERED
```

**Formatos aceitos:** `audio/wav`, `audio/x-wav`, `audio/mpeg`, `audio/aiff`, `audio/x-aiff`

**Tamanho máximo:** 200 MB

**Expiração da URL de upload:** 10 minutos

A URL de leitura (para o player de áudio) é gerada server-side pelo `GET /api/orders/:id` e tem validade de 10 minutos. Se o R2 não estiver configurado no ambiente, a URL simplesmente não é gerada e o player não aparece.

---

## 10. Auto-aprovação

Pedidos em `DELIVERED` são aprovados automaticamente após `AUTO_APPROVE_AFTER_DAYS` dias (padrão: 5) sem ação do contratante. O campo `auto_approve_at` é calculado no momento da entrega.

**Arquitetura:**

```
pg_cron (Supabase) → a cada 15 min chama auto_approve_expired_deliveries()
     ↓
 função SQL: DELIVERED onde auto_approve_at < now() → status COMPLETED
     ↓
Edge Function auto-approve-runner (Deno):
   1. Busca pedidos COMPLETED sem asaas_transfer_id
   2. POST /api/internal/release-payment com os IDs
     ↓
   releasePayment() dispara PIX Transfer para cada músico
```

**Configuração da Edge Function:**

```bash
# Deploy
supabase functions deploy auto-approve-runner

# Secrets (equivalentes às env vars do app)
supabase secrets set APP_URL=https://for-music.app
supabase secrets set INTERNAL_JOB_TOKEN=segredo-job
```

**Trigger alternativo:** A Edge Function também pode ser chamada por um Cron Job do Supabase Dashboard (Settings → Edge Functions → Schedules) a cada 15 minutos com `0/15 * * * *`.

---

## 11. Convenções de código

### Route handlers

Todo handler usa `withErrorHandling()`:

```ts
export const POST = withErrorHandling(async (req: NextRequest, ctx) => {
  const { supabase, userId, profile } = await requireUser(); // lança 401 se não autenticado
  requireRole(profile, 'contractor');                        // lança 403 se papel errado

  const input = await parseJson(req, meuSchema);            // lança 422 se inválido

  // ... lógica de negócio

  return jsonOk({ resultado });    // 200
  return jsonOk({ criado }, 201);  // 201
});
```

### Erros consistentes

```ts
throw new HttpError(404, 'Pedido não encontrado');
throw new HttpError(409, 'Conflito', detalhesExtras);
```

`withErrorHandling` converte `HttpError` em `{ error: "...", details: "..." }` com o status correto. Erros não tratados viram 500.

### Clientes Supabase — qual usar onde

| Arquivo | Cliente | Quando usar |
|---------|---------|-------------|
| Server Components / Route Handlers | `createServerClient()` de `@/lib/supabase/server` | Acesso autenticado com cookie da sessão (RLS ativo) |
| Client Components | `createClient()` de `@/lib/supabase/client` | Apenas para auth (`signInWithOtp`, `signOut`) |
| Webhooks / jobs internos | `createServiceClient()` de `@/lib/supabase/service` | Bypassa RLS — use com cuidado |

### Validação com Zod

Schemas ficam em `src/lib/validations/`. Reutilize no frontend para consistência:

```ts
import { createOrderSchema } from '@/lib/validations/orders';
// O mesmo schema valida o body da API e pode guiar a UI
```

### Formatação

```ts
import { formatCents, formatDate, formatDateTime } from '@/lib/format';

formatCents(50000)                  // "R$ 500,00"
formatDate('2026-06-01T18:00:00Z')  // "01/06/2026"
formatDateTime('2026-06-01T18:00:00Z') // "01/06/2026, 18:00"
```

---

## 12. Tipos e banco de dados

O arquivo `src/types/database.ts` define todos os tipos TypeScript do schema. Para regenerar após alterar o banco:

```bash
npm run db:types
```

Aliases convenientes (use estes, não os tipos genéricos do Supabase):

```ts
import type {
  UserRow,     // users.Row — perfil completo
  OrderRow,    // orders.Row
  DeliveryRow, // deliveries.Row
  RevisionRow, // revisions.Row
  ReviewRow,   // reviews.Row
  OrderStatus, // 'OPEN' | 'ACCEPTED' | 'PAID' | 'DELIVERED' | 'IN_REVISION' | 'COMPLETED' | 'DISPUTED'
  UserRole,    // 'contractor' | 'musician' | 'both'
  PixKeyType,  // 'cpf' | 'cnpj' | 'email' | 'phone' | 'evp'
} from '@/types/database';
```

### Tabelas principais

| Tabela | Propósito |
|--------|-----------|
| `users` | Perfil estendido do usuário (complementa `auth.users` do Supabase) |
| `orders` | Pedidos com todo o lifecycle — status, datas, IDs externos (Asaas) |
| `deliveries` | Arquivos de áudio entregues; apenas um `is_current = true` por vez |
| `revisions` | Histórico de feedbacks de revisão |
| `reviews` | Avaliações pós-conclusão (1 por participante por pedido) |

### RLS (Row Level Security)

O banco usa RLS no Supabase: o cliente com cookie da sessão só acessa dados permitidos pelas policies. Os route handlers fazem verificações adicionais explícitas (defense-in-depth). O `createServiceClient()` bypassa o RLS — use apenas em webhooks e jobs internos onde não há sessão de usuário.
