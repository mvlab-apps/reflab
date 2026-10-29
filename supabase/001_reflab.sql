-- REF LAB · tabelas no mesmo projeto Supabase do gestor de equipamentos.
-- Reaproveita auth.users, public.perfis e as funções is_membro() / is_admin().

create table public.ref_projetos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cliente text,
  formato text,
  local text,
  diretor_foto text,
  descricao text,
  notas text,
  tags text[] not null default '{}',
  capa_midia_id uuid,
  ultima_gravacao date,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- câmeras e luzes: campos fixos e extras ficam em jsonb para poder crescer sem migração
create table public.ref_specs (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.ref_projetos(id) on delete cascade,
  tipo text not null check (tipo in ('camera', 'luz')),
  codigo text not null,
  nome text not null default '',
  campos jsonb not null default '{}',
  extra jsonb not null default '[]',
  nota text,
  ordem int not null default 100,
  criado_em timestamptz not null default now(),
  unique (projeto_id, tipo, codigo)
);

create table public.ref_equipamento (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.ref_projetos(id) on delete cascade,
  quantidade int not null default 1 check (quantidade >= 0),
  tipo text not null default '',
  modelos text,
  categoria text references public.categorias(nome) on update cascade on delete set null,
  ordem int not null default 100
);

create table public.ref_plantas (
  projeto_id uuid primary key references public.ref_projetos(id) on delete cascade,
  largura_cm int not null default 600,
  profundidade_cm int not null default 450,
  itens jsonb not null default '[]',
  atualizado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now()
);

create table public.ref_midias (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.ref_projetos(id) on delete cascade,
  tipo text not null check (tipo in ('still', 'bts')),
  path text not null,
  thumb_path text,
  largura int,
  altura int,
  camera text,
  diaria text,
  categoria text,
  legenda text,
  ordem int not null default 100,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);

alter table public.ref_projetos
  add constraint ref_projetos_capa_fkey foreign key (capa_midia_id) references public.ref_midias(id) on delete set null;

create index ref_specs_projeto_idx on public.ref_specs (projeto_id);
create index ref_equipamento_projeto_idx on public.ref_equipamento (projeto_id);
create index ref_midias_projeto_idx on public.ref_midias (projeto_id, tipo);
create index ref_projetos_capa_idx on public.ref_projetos (capa_midia_id);

-- RLS: membros ativos leem e editam; apagar projeto/mídia só admin ou quem criou
alter table public.ref_projetos enable row level security;
alter table public.ref_specs enable row level security;
alter table public.ref_equipamento enable row level security;
alter table public.ref_plantas enable row level security;
alter table public.ref_midias enable row level security;

create policy ler on public.ref_projetos for select to authenticated using (is_membro());
create policy membro_adiciona on public.ref_projetos for insert to authenticated with check (is_membro());
create policy membro_edita on public.ref_projetos for update to authenticated using (is_membro()) with check (is_membro());
create policy apagar on public.ref_projetos for delete to authenticated using (is_admin() or criado_por = auth.uid());

create policy membro_escreve on public.ref_specs for all to authenticated using (is_membro()) with check (is_membro());
create policy membro_escreve on public.ref_equipamento for all to authenticated using (is_membro()) with check (is_membro());
create policy membro_escreve on public.ref_plantas for all to authenticated using (is_membro()) with check (is_membro());

create policy ler on public.ref_midias for select to authenticated using (is_membro());
create policy membro_adiciona on public.ref_midias for insert to authenticated with check (is_membro());
create policy membro_edita on public.ref_midias for update to authenticated using (is_membro()) with check (is_membro());
create policy apagar on public.ref_midias for delete to authenticated using (is_admin() or criado_por = auth.uid());

-- fotos: bucket privado, 25 MB por arquivo, só imagens
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ref-midias', 'ref-midias', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy ref_midias_ler on storage.objects for select to authenticated using (bucket_id = 'ref-midias' and is_membro());
create policy ref_midias_enviar on storage.objects for insert to authenticated with check (bucket_id = 'ref-midias' and is_membro());
create policy ref_midias_apagar on storage.objects for delete to authenticated using (bucket_id = 'ref-midias' and (is_admin() or owner = auth.uid()));
