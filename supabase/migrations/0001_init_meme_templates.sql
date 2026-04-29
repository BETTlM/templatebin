create extension if not exists pg_trgm;

create table if not exists public.meme_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  storage_path text not null unique,
  mime_type text not null,
  tags text[] not null default '{}',
  tags_text text not null default '',
  width integer,
  height integer,
  uploader_ip_hash text not null,
  uploader_name text,
  download_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.meme_templates
add column if not exists tags_text text not null default '';
alter table public.meme_templates
add column if not exists uploader_name text;

create or replace function public.sync_meme_template_tags_text()
returns trigger
language plpgsql
as $$
begin
  new.tags_text := array_to_string(new.tags, ' ');
  return new;
end;
$$;

drop trigger if exists trg_sync_meme_template_tags_text on public.meme_templates;

create trigger trg_sync_meme_template_tags_text
before insert or update of tags
on public.meme_templates
for each row
execute function public.sync_meme_template_tags_text();

update public.meme_templates
set tags_text = array_to_string(tags, ' ')
where tags_text = '';

alter table public.meme_templates enable row level security;

create policy "public_read_templates"
on public.meme_templates
for select
using (true);

create index if not exists meme_templates_created_idx
on public.meme_templates (created_at desc);

create index if not exists meme_templates_title_trgm_idx
on public.meme_templates using gin (title gin_trgm_ops);

create index if not exists meme_templates_tags_gin_idx
on public.meme_templates using gin (tags);

create index if not exists meme_templates_tags_trgm_idx
on public.meme_templates using gin (tags_text gin_trgm_ops);

create or replace function public.search_meme_templates(
  search_query text,
  tag_filter text[] default null,
  result_limit integer default 24
)
returns table (
  id uuid,
  title text,
  storage_path text,
  mime_type text,
  tags text[],
  width integer,
  height integer,
  uploader_name text,
  download_count integer,
  created_at timestamptz
)
language sql
stable
as $$
  with scored as (
    select
      mt.*,
      greatest(
        similarity(mt.title, coalesce(search_query, '')),
        similarity(mt.tags_text, coalesce(search_query, ''))
      ) as trigram_score,
      ts_rank_cd(
        to_tsvector('simple', mt.title || ' ' || mt.tags_text),
        plainto_tsquery('simple', coalesce(nullif(search_query, ''), 'meme'))
      ) as fts_score
    from public.meme_templates mt
    where (
      coalesce(search_query, '') = ''
      or mt.title % search_query
      or mt.tags_text % search_query
      or to_tsvector('simple', mt.title || ' ' || mt.tags_text) @@ plainto_tsquery('simple', search_query)
    )
    and (tag_filter is null or mt.tags && tag_filter)
  )
  select id, title, storage_path, mime_type, tags, width, height, uploader_name, download_count, created_at
  from scored
  order by (trigram_score * 0.7 + fts_score * 0.3) desc,
    char_length(title) asc
  limit greatest(1, least(result_limit, 50));
$$;

create or replace function public.increment_download_count(template_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.meme_templates
  set download_count = download_count + 1
  where id = template_id;
$$;

revoke all on function public.increment_download_count(uuid) from public;
grant execute on function public.increment_download_count(uuid) to service_role;
