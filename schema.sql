-- Extensión Taquería Los Amigos: fiado y branding PDF
alter table public.menu_settings add column if not exists tax_id text;
alter table public.menu_settings add column if not exists email text;
alter table public.menu_settings add column if not exists footer_text text default 'Gracias por tu preferencia';
alter table public.menu_settings add column if not exists watermark_url text;
alter table public.menu_settings add column if not exists social_text text;
alter table public.orders add column if not exists payment_status text default 'pendiente';
alter table public.orders add column if not exists credit_due_date date;

create table if not exists public.credit_accounts (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 customer_id uuid not null references public.customers(id),
 original_amount numeric(12,2) not null default 0,
 balance numeric(12,2) not null default 0,
 status text not null default 'pendiente' check(status in ('pendiente','parcial','pagado')),
 due_date date, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(order_id)
);
create table if not exists public.credit_payments (
 id uuid primary key default gen_random_uuid(),
 credit_account_id uuid not null references public.credit_accounts(id) on delete cascade,
 amount numeric(12,2) not null check(amount>0),
 method text not null default 'efectivo', notes text, created_at timestamptz not null default now()
);
