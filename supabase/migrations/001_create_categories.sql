-- migration 001: create categories table

create table if not exists public.categories (
    id        uuid        not null primary key default gen_random_uuid(),
    name      text        not null,
    slug      text        not null unique,
    icon      text,
    parent_id uuid        references public.categories(id)
);

create index if not exists idx_categories_parent on public.categories(parent_id);
create index if not exists idx_categories_slug   on public.categories(slug);
