CREATE TABLE customer_favorites (
    id uuid NOT NULL,
    customer_id uuid NOT NULL,
    vendor_product_listing_id uuid NOT NULL,
    added_at_utc timestamp with time zone NOT NULL,
    CONSTRAINT pk_customer_favorites PRIMARY KEY (id),
    CONSTRAINT fk_customer_favorites_customers_customer_id FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
);

CREATE INDEX ix_customer_favorites_customer_id ON customer_favorites (customer_id);
CREATE INDEX ix_customer_favorites_vendor_product_listing_id ON customer_favorites (vendor_product_listing_id);
