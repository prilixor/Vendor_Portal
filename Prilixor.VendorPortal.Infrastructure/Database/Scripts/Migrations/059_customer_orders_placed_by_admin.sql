-- Apply on customer_portal_db: attribute orders placed by admin staff
alter table if exists public.customer_rental_orders
  add column if not exists placed_by_admin_id uuid null;

create index if not exists ix_customer_rental_orders_placed_by_admin_id
  on public.customer_rental_orders(placed_by_admin_id)
  where placed_by_admin_id is not null;
