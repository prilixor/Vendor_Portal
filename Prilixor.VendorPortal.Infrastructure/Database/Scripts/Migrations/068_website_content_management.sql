-- ----------------------------------------------------
-- Migration: 068_website_content_management.sql
-- Target Database: common_portal_db
-- Description: Website Content Management Schema & Seed Data (Home, About, Services, FAQ, Contact)
-- Execution: psql -d common_portal_db -f 068_website_content_management.sql
-- ----------------------------------------------------

\c common_portal_db

-- 1. HOME SECTION
CREATE TABLE IF NOT EXISTS public.website_home_content (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hero_title varchar(255) NOT NULL,
    hero_accent varchar(255) NOT NULL,
    hero_subtitle text NOT NULL,
    primary_cta_label varchar(100) NOT NULL,
    primary_cta_link varchar(255) NOT NULL,
    secondary_cta_label varchar(100) NOT NULL,
    secondary_cta_link varchar(255) NOT NULL DEFAULT '/#how-it-works',
    trust_label text NOT NULL,
    hero_image_url text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.website_home_features (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    home_content_id uuid NOT NULL REFERENCES public.website_home_content(id) ON DELETE CASCADE,
    title varchar(150) NOT NULL,
    subtitle varchar(255) NOT NULL,
    icon_name varchar(100) NULL,
    custom_icon_url text NULL,
    sort_order int NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS ix_website_home_features_active_sort
    ON public.website_home_features(home_content_id, is_active, sort_order)
    WHERE is_deleted = false;

-- 2. ABOUT SECTION
CREATE TABLE IF NOT EXISTS public.website_about_content (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    banner_title varchar(255) NOT NULL,
    banner_accent varchar(255) NOT NULL,
    banner_sub text NOT NULL,
    mission_title varchar(150) NOT NULL DEFAULT 'Our Mission',
    mission_text text NOT NULL,
    vision_title varchar(150) NOT NULL DEFAULT 'Our Vision',
    vision_text text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.website_audience_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    about_content_id uuid NULL REFERENCES public.website_about_content(id) ON DELETE CASCADE,
    title varchar(150) NOT NULL,
    description text NOT NULL,
    icon_name varchar(100) NULL,
    custom_icon_url text NULL,
    sort_order int NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS ix_website_audience_categories_active_sort
    ON public.website_audience_categories(is_active, sort_order)
    WHERE is_deleted = false;

-- 3. SERVICES SECTION
CREATE TABLE IF NOT EXISTS public.website_services_header (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    eyebrow varchar(100) NOT NULL,
    title varchar(255) NOT NULL,
    accent_text varchar(255) NOT NULL,
    subtitle text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.website_service_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    header_id uuid NULL REFERENCES public.website_services_header(id) ON DELETE CASCADE,
    title varchar(150) NOT NULL,
    description text NOT NULL,
    icon_name varchar(100) NULL,
    custom_icon_url text NULL,
    sort_order int NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS ix_website_service_items_active_sort
    ON public.website_service_items(is_active, sort_order)
    WHERE is_deleted = false;

-- 4. FAQ SECTION
CREATE TABLE IF NOT EXISTS public.website_faq_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    slug varchar(100) NOT NULL,
    sort_order int NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_website_faq_categories_slug
    ON public.website_faq_categories(slug)
    WHERE is_deleted = false;

CREATE TABLE IF NOT EXISTS public.website_faq_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL REFERENCES public.website_faq_categories(id) ON DELETE RESTRICT,
    question text NOT NULL,
    answer text NOT NULL,
    is_published boolean NOT NULL DEFAULT true,
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS ix_website_faq_items_category_published
    ON public.website_faq_items(category_id, is_published, sort_order)
    WHERE is_deleted = false;

-- 5. CONTACT SECTION
CREATE TABLE IF NOT EXISTS public.website_contact_content (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hero_title varchar(255) NOT NULL,
    hero_accent varchar(255) NOT NULL,
    hero_sub text NOT NULL,
    phone varchar(50) NOT NULL,
    email varchar(150) NOT NULL,
    operating_hours varchar(150) NOT NULL,
    institutional_note text NOT NULL,
    cta_title varchar(255) NOT NULL,
    cta_description text NOT NULL,
    cta_button_text varchar(100) NOT NULL,
    cta_button_link varchar(255) NOT NULL DEFAULT '/customer/shop',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

-- ====================================================
-- INITIAL SEED DATA
-- ====================================================

-- Seed Home Content & Features
DO $$
DECLARE
    v_home_id uuid := '11111111-1111-1111-1111-111111111111';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.website_home_content WHERE is_deleted = false) THEN
        INSERT INTO public.website_home_content (
            id, hero_title, hero_accent, hero_subtitle, primary_cta_label, primary_cta_link, secondary_cta_label, secondary_cta_link, trust_label
        ) VALUES (
            v_home_id,
            'A trusted marketplace for',
            'medical equipment & supplies.',
            'BlinksMed connects you with verified suppliers to rent or purchase medical equipment and source laboratory chemicals, all through one simple, trusted platform. Delivery, setup, and expert support are included at every step.',
            'Get Started',
            '/customer/shop',
            'Learn How It Works',
            '/#how-it-works',
            'TRUSTED BY HEALTHCARE PROFESSIONALS, CLINICS, HOSPITALS & LABORATORIES'
        );

        INSERT INTO public.website_home_features (id, home_content_id, title, subtitle, icon_name, sort_order) VALUES
            ('11111111-1111-1111-1111-111111111101', v_home_id, 'Verified Suppliers', 'Every partner vetted for quality', 'ShieldCheck', 1),
            ('11111111-1111-1111-1111-111111111102', v_home_id, 'Flexible Rental Options', 'Weekly, monthly, or ownership', 'CalendarRange', 2),
            ('11111111-1111-1111-1111-111111111103', v_home_id, 'Expert Customer Support', 'Guidance at every step', 'Headphones', 3);
    END IF;
END $$;

-- Seed About Content & Audiences
DO $$
DECLARE
    v_about_id uuid := '22222222-2222-2222-2222-222222222222';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.website_about_content WHERE is_deleted = false) THEN
        INSERT INTO public.website_about_content (
            id, banner_title, banner_accent, banner_sub, mission_title, mission_text, vision_title, vision_text
        ) VALUES (
            v_about_id,
            'A simpler way to access',
            'healthcare products.',
            'We exist to make sourcing healthcare products safer and more transparent, so hospitals, clinics, and families can rely on every supplier we work with.',
            'Our Mission',
            'To make healthcare products more accessible through technology, trusted suppliers, and a seamless customer experience, removing the friction from renting, buying, and sourcing what care requires.',
            'Our Vision',
            'To become one of the most trusted healthcare marketplaces, simplifying how medical equipment and laboratory products are accessed by individuals and institutions alike.'
        );

        INSERT INTO public.website_audience_categories (id, about_content_id, title, description, icon_name, sort_order) VALUES
            ('22222222-2222-2222-2222-222222222201', v_about_id, 'Individuals', 'Personal access to home healthcare equipment.', 'User', 1),
            ('22222222-2222-2222-2222-222222222202', v_about_id, 'Families', 'Equipment for caring for a loved one at home.', 'Users', 2),
            ('22222222-2222-2222-2222-222222222203', v_about_id, 'Hospitals', 'Reliable equipment sourcing at institutional scale.', 'Building2', 3),
            ('22222222-2222-2222-2222-222222222204', v_about_id, 'Clinics', 'Flexible rental and purchase options for daily practice.', 'Hospital', 4),
            ('22222222-2222-2222-2222-222222222205', v_about_id, 'Laboratories', 'Trusted sourcing for laboratory chemicals.', 'FlaskConical', 5),
            ('22222222-2222-2222-2222-222222222206', v_about_id, 'Healthcare Professionals', 'Quick access to trusted equipment and supplies.', 'Stethoscope', 6),
            ('22222222-2222-2222-2222-222222222207', v_about_id, 'Rehabilitation Centers', 'Mobility and recovery equipment, rented or bought.', 'Activity', 7),
            ('22222222-2222-2222-2222-222222222208', v_about_id, 'Research Organizations', 'Consistent supply of laboratory-grade chemicals.', 'Microscope', 8);
    END IF;
END $$;

-- Seed Services Header & Items
DO $$
DECLARE
    v_services_id uuid := '33333333-3333-3333-3333-333333333333';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.website_services_header WHERE is_deleted = false) THEN
        INSERT INTO public.website_services_header (
            id, eyebrow, title, accent_text, subtitle
        ) VALUES (
            v_services_id,
            'OUR SERVICES',
            'Medical equipment & ',
            'laboratory supplies.',
            'Rent or buy equipment. Buy lab chemicals. All in one place.'
        );

        INSERT INTO public.website_service_items (id, header_id, title, description, icon_name, sort_order) VALUES
            ('33333333-3333-3333-3333-333333333301', v_services_id, 'Medical Equipment', 'Hospital beds, wheelchairs, oxygen concentrators, and more. Available for rent or purchase.', 'Stethoscope', 1),
            ('33333333-3333-3333-3333-333333333302', v_services_id, 'Laboratory Chemicals', 'Quality reagents and consumables for labs. Available for purchase only.', 'FlaskConical', 2),
            ('33333333-3333-3333-3333-333333333303', v_services_id, 'Healthcare Marketplace', 'One platform connecting customers with trusted, verified suppliers.', 'Layers', 3),
            ('33333333-3333-3333-3333-333333333304', v_services_id, 'Delivery & Support', 'Reliable assistance throughout the customer journey, from order to setup.', 'Truck', 4),
            ('33333333-3333-3333-3333-333333333305', v_services_id, 'Bulk Procurement', 'Solutions for hospitals, clinics, laboratories, and institutions.', 'Building2', 5),
            ('33333333-3333-3333-3333-333333333306', v_services_id, 'Verified Suppliers', 'Every supplier is vetted before they can list products on the platform.', 'ShieldCheck', 6);
    END IF;
END $$;

-- Seed FAQ Categories & Items
DO $$
DECLARE
    v_cat_renting uuid := '44444444-4444-4444-4444-444444444401';
    v_cat_purchasing uuid := '44444444-4444-4444-4444-444444444402';
    v_cat_chemicals uuid := '44444444-4444-4444-4444-444444444403';
    v_cat_delivery uuid := '44444444-4444-4444-4444-444444444404';
    v_cat_orders uuid := '44444444-4444-4444-4444-444444444405';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.website_faq_categories WHERE is_deleted = false) THEN
        INSERT INTO public.website_faq_categories (id, name, slug, sort_order) VALUES
            (v_cat_renting, 'Renting Medical Equipment', 'renting-medical-equipment', 1),
            (v_cat_purchasing, 'Purchasing Medical Equipment', 'purchasing-medical-equipment', 2),
            (v_cat_chemicals, 'Laboratory Chemicals', 'laboratory-chemicals', 3),
            (v_cat_delivery, 'Delivery & Support', 'delivery-and-support', 4),
            (v_cat_orders, 'Orders & Payments', 'orders-and-payments', 5);

        INSERT INTO public.website_faq_items (id, category_id, question, answer, is_published, sort_order) VALUES
            ('44444444-4444-4444-4444-444444444101', v_cat_renting, 'How do I know whether I should rent or buy medical equipment?', 'It depends on how long you will need the equipment. If it is for short-term recovery or rehabilitation, renting is often the most practical choice. For long-term or permanent use, purchasing may be more suitable.', true, 1),
            ('44444444-4444-4444-4444-444444444102', v_cat_renting, 'Which medical equipment is available for rent?', 'We offer a wide range of medical equipment on weekly and monthly rental plans, including hospital beds, wheelchairs, oxygen concentrators, patient lifts, rehabilitation equipment, and more.', true, 2),
            ('44444444-4444-4444-4444-444444444103', v_cat_purchasing, 'Can I purchase the equipment instead of renting it?', 'Yes. Many of our medical equipment products are also available for purchase. If buying is a better option for a particular product, you will be able to see that directly while browsing.', true, 1),
            ('44444444-4444-4444-4444-444444444104', v_cat_chemicals, 'Do you rent laboratory chemicals?', 'No. All laboratory and industrial chemicals are available for purchase only. Chemicals are never offered on rent due to safety and regulatory requirements.', true, 1),
            ('44444444-4444-4444-4444-444444444105', v_cat_delivery, 'Are the rental medical equipment sanitized before delivery?', 'Absolutely. Every rental item is thoroughly cleaned, sanitized, inspected, and tested before it reaches you to ensure safety and hygiene.', true, 1),
            ('44444444-4444-4444-4444-444444444106', v_cat_orders, 'What payment methods do you accept?', 'We accept multiple secure payment methods, including UPI, credit cards, debit cards, net banking, and other supported online payment options.', true, 1);
    END IF;
END $$;

-- Seed Contact Content
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.website_contact_content WHERE is_deleted = false) THEN
        INSERT INTO public.website_contact_content (
            id, hero_title, hero_accent, hero_sub, phone, email, operating_hours, institutional_note, cta_title, cta_description, cta_button_text, cta_button_link
        ) VALUES (
            '55555555-5555-5555-5555-555555555555',
            'We are here to',
            'help.',
            'Reach our team directly. We respond quickly to every enquiry.',
            '+91 98765 43210',
            'hello@blinksmed.com',
            'Mon – Sat, 8:00 AM – 8:00 PM IST',
            'For institutions: bulk orders, hospital equipment, and laboratory supply quotations are welcome, call or email us directly.',
            'Ready to rent or purchase medical equipment?',
            'Enter the Customer Portal to browse, compare, and place your order.',
            'Get Started',
            '/customer/shop'
        );
    END IF;
END $$;

-- 6. RENT OR BUY SECTION
CREATE TABLE IF NOT EXISTS public.website_rent_vs_buy_content (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    eyebrow varchar(100) NOT NULL,
    title varchar(255) NOT NULL,
    accent_text varchar(255) NOT NULL,
    subtitle text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.website_rent_vs_buy_features (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rent_vs_buy_id uuid NOT NULL REFERENCES public.website_rent_vs_buy_content(id) ON DELETE CASCADE,
    feature_label varchar(150) NOT NULL,
    weekly_value varchar(255) NOT NULL,
    monthly_value varchar(255) NOT NULL,
    purchase_value varchar(255) NOT NULL,
    sort_order int NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.website_rent_vs_buy_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rent_vs_buy_id uuid NOT NULL REFERENCES public.website_rent_vs_buy_content(id) ON DELETE CASCADE,
    title varchar(255) NOT NULL,
    description text NOT NULL,
    sort_order int NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS ix_website_rent_vs_buy_features_rent_vs_buy_id
    ON public.website_rent_vs_buy_features(rent_vs_buy_id) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_website_rent_vs_buy_cards_rent_vs_buy_id
    ON public.website_rent_vs_buy_cards(rent_vs_buy_id) WHERE is_deleted = false;

-- Seed Rent or Buy Content
DO $$
DECLARE
    v_rvb_id uuid := '66666666-6666-6666-6666-666666666666';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.website_rent_vs_buy_content WHERE is_deleted = false) THEN
        INSERT INTO public.website_rent_vs_buy_content (id, eyebrow, title, accent_text, subtitle) VALUES (
            v_rvb_id,
            'RENT OR BUY',
            'Choose what fits your',
            'care timeline.',
            'Rent medical equipment on weekly or monthly plans for shorter recovery periods. Buy when long-term ownership is the practical choice. We help you compare options without making it confusing.'
        );

        INSERT INTO public.website_rent_vs_buy_features (id, rent_vs_buy_id, feature_label, weekly_value, monthly_value, purchase_value, sort_order) VALUES
            ('66666666-6666-6666-6666-666666666001', v_rvb_id, 'Upfront cost', 'Lowest', 'Low', 'Full price', 1),
            ('66666666-6666-6666-6666-666666666002', v_rvb_id, 'Ownership', 'No', 'No', 'Yes', 2),
            ('66666666-6666-6666-6666-666666666003', v_rvb_id, 'Maintenance', 'Included', 'Included', 'Buyer''s responsibility', 3),
            ('66666666-6666-6666-6666-666666666004', v_rvb_id, 'Best for', 'Short recovery', 'Extended recovery', 'Long-term or institutional use', 4);

        INSERT INTO public.website_rent_vs_buy_cards (id, rent_vs_buy_id, title, description, sort_order) VALUES
            ('66666666-6666-6666-6666-666666666101', v_rvb_id, 'When should I rent?', 'For recovery, rehabilitation, or any short-to-medium term need where flexibility matters more than ownership.', 1),
            ('66666666-6666-6666-6666-666666666102', v_rvb_id, 'When should I buy?', 'For ongoing or chronic care, or when institutions need equipment on a permanent basis.', 2);
    END IF;
END $$;

-- 7. WEBSITE GLOBAL SETTINGS
CREATE TABLE IF NOT EXISTS public.website_global_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    show_landing_page boolean NOT NULL DEFAULT true,
    show_about_section boolean NOT NULL DEFAULT true,
    show_services_section boolean NOT NULL DEFAULT true,
    show_rent_vs_buy_section boolean NOT NULL DEFAULT true,
    show_faq_section boolean NOT NULL DEFAULT true,
    show_contact_section boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

ALTER TABLE public.website_global_settings ADD COLUMN IF NOT EXISTS show_about_section boolean NOT NULL DEFAULT true;
ALTER TABLE public.website_global_settings ADD COLUMN IF NOT EXISTS show_services_section boolean NOT NULL DEFAULT true;
ALTER TABLE public.website_global_settings ADD COLUMN IF NOT EXISTS show_rent_vs_buy_section boolean NOT NULL DEFAULT true;
ALTER TABLE public.website_global_settings ADD COLUMN IF NOT EXISTS show_faq_section boolean NOT NULL DEFAULT true;
ALTER TABLE public.website_global_settings ADD COLUMN IF NOT EXISTS show_contact_section boolean NOT NULL DEFAULT true;

-- Seed Website Global Settings
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.website_global_settings WHERE is_deleted = false) THEN
        INSERT INTO public.website_global_settings (
            id, show_landing_page, show_about_section, show_services_section, show_rent_vs_buy_section, show_faq_section, show_contact_section
        ) VALUES (
            '77777777-7777-7777-7777-777777777777',
            true, true, true, true, true, true
        );
    END IF;
END $$;

-- 8. HOW IT WORKS SECTION
CREATE TABLE IF NOT EXISTS public.website_how_it_works_headers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    eyebrow varchar(100) NOT NULL DEFAULT 'HOW IT WORKS',
    title varchar(255) NOT NULL DEFAULT 'From browsing to',
    accent_text varchar(255) NOT NULL DEFAULT 'delivery.',
    subtitle text NOT NULL DEFAULT 'Five simple steps to get the equipment and supplies you need.',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.website_how_it_works_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    header_id uuid NULL REFERENCES public.website_how_it_works_headers(id) ON DELETE CASCADE,
    step_number int NOT NULL DEFAULT 1,
    title varchar(150) NOT NULL,
    description text NOT NULL,
    icon_name varchar(100) NULL,
    custom_icon_url text NULL,
    sort_order int NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_deleted boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS ix_website_how_it_works_steps_active_sort
    ON public.website_how_it_works_steps(is_active, sort_order)
    WHERE is_deleted = false;

ALTER TABLE public.website_global_settings ADD COLUMN IF NOT EXISTS show_how_it_works_section boolean NOT NULL DEFAULT true;

-- Seed How It Works Header & Steps
DO $$
DECLARE
    v_hiw_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.website_how_it_works_headers WHERE is_deleted = false) THEN
        v_hiw_id := '88888888-8888-8888-8888-888888888888'::uuid;
        INSERT INTO public.website_how_it_works_headers (
            id, eyebrow, title, accent_text, subtitle
        ) VALUES (
            v_hiw_id,
            'HOW IT WORKS',
            'From browsing to',
            'delivery.',
            'Five simple steps to get the equipment and supplies you need.'
        );

        INSERT INTO public.website_how_it_works_steps (
            id, header_id, step_number, title, description, icon_name, sort_order, is_active
        ) VALUES
            ('88888888-8888-8888-8888-888888888101', v_hiw_id, 1, 'Create an Account', 'Sign up on the Customer Portal in minutes.', 'UserCheck', 1, true),
            ('88888888-8888-8888-8888-888888888102', v_hiw_id, 2, 'Browse Solutions', 'Explore equipment and chemical categories.', 'Search', 2, true),
            ('88888888-8888-8888-8888-888888888103', v_hiw_id, 3, 'Choose Rent or Buy', 'Pick the option that fits your timeline.', 'CheckCircle2', 3, true),
            ('88888888-8888-8888-8888-888888888104', v_hiw_id, 4, 'Place Your Order', 'Confirm details and complete secure payment.', 'ShoppingBag', 4, true),
            ('88888888-8888-8888-8888-888888888105', v_hiw_id, 5, 'Delivery & Support', 'We deliver, set up, and stay reachable.', 'Truck', 5, true);
    END IF;
END $$;



