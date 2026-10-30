-- ---------------------------------------------------------------------
-- 0051  The product editor grows: page count, "ideal for", previews,
--       related products, and a public view of the delivery formats.
--
-- The product page could not say which formats a book ships in: the
-- product_files table is readable only by staff and by the readers who
-- already own the product (brief §21, the right rule for downloads), so a
-- visitor's page saw no files and said "being prepared" about books whose
-- files had been uploaded weeks before. product_formats exposes the
-- format, size and version of the ACTIVE files and nothing else; the
-- storage path never leaves the table.
--
-- Previews live in the public bucket on purpose: a sample is meant to be
-- read before buying. The paid files stay where they are.
-- ---------------------------------------------------------------------

alter table products add column if not exists page_count integer
  constraint products_page_count_positive check (page_count is null or page_count > 0);
alter table products add column if not exists ideal_for text;
comment on column products.page_count is 'Shown on the product page when set.';
comment on column products.ideal_for is 'Who this is for, in the owner''s words. Shown on the product page when set.';

-- The delivery formats, for everyone. No path, no checksum.
create or replace view public.product_formats
  with (security_invoker = false) as
  select product_id, format::text as format, file_size_bytes, version
  from product_files
  where is_active;
grant select on public.product_formats to anon, authenticated;

-- Previews: a sample PDF, or pictures of pages.
create table if not exists product_previews (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products(id) on delete cascade,
  kind            text not null check (kind in ('pdf', 'image')),
  title           text,
  storage_path    text not null,
  public_url      text not null,
  file_size_bytes bigint,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists product_previews_product_idx on product_previews (product_id, sort_order);
alter table product_previews enable row level security;
drop policy if exists product_previews_public_read on product_previews;
create policy product_previews_public_read on product_previews for select using (true);
drop policy if exists product_previews_staff_write on product_previews;
create policy product_previews_staff_write on product_previews for all
  using (is_staff()) with check (is_staff());

-- "You may also find meaning in": chosen by the owner, per product.
create table if not exists product_related (
  product_id uuid not null references products(id) on delete cascade,
  related_id uuid not null references products(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (product_id, related_id),
  constraint no_self_relation check (product_id <> related_id)
);
alter table product_related enable row level security;
drop policy if exists product_related_public_read on product_related;
create policy product_related_public_read on product_related for select using (true);
drop policy if exists product_related_staff_write on product_related;
create policy product_related_staff_write on product_related for all
  using (is_staff()) with check (is_staff());
