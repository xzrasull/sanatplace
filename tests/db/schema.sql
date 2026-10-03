--
-- PostgreSQL database dump
--

\restrict 07klbNuujbs6Ke1yOzhi0E52uNp5cdGIoLD9QigB18Mejc9bhLbCRrKpE1nVd0b

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-0ubuntu0.26.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: application_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.application_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: artwork_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.artwork_status AS ENUM (
    'pending',
    'published',
    'rejected',
    'sold'
);


--
-- Name: role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.role AS ENUM (
    'buyer',
    'seller',
    'admin'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: artwork_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artwork_likes (
    user_id uuid NOT NULL,
    artwork_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: artworks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.artworks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    price integer NOT NULL,
    height_cm integer NOT NULL,
    width_cm integer NOT NULL,
    category_id uuid NOT NULL,
    technique_id uuid NOT NULL,
    image_url text NOT NULL,
    status public.artwork_status DEFAULT 'pending'::public.artwork_status NOT NULL,
    rejection_reason text,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp without time zone,
    reviewed_by_admin_id uuid,
    year integer,
    width_px integer,
    height_px integer
);


--
-- Name: banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    image_url text NOT NULL,
    image_mobile_url text,
    eyebrow text,
    title text NOT NULL,
    subtitle text,
    button_label text,
    button_url text,
    button2_label text,
    button2_url text,
    artwork_id uuid,
    "overlay" integer DEFAULT 45 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: exhibition_halls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exhibition_halls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exhibition_id uuid NOT NULL,
    "position" integer NOT NULL,
    title text NOT NULL,
    intro text,
    wall_color text
);


--
-- Name: exhibition_works; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exhibition_works (
    hall_id uuid NOT NULL,
    artwork_id uuid NOT NULL,
    exhibition_id uuid NOT NULL,
    "position" integer NOT NULL,
    curator_note text
);


--
-- Name: exhibitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exhibitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    subtitle text,
    curator_name text,
    intro text,
    cover_url text NOT NULL,
    starts_on date NOT NULL,
    ends_on date NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    post_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exhibitions_dates_order CHECK ((ends_on >= starts_on)),
    CONSTRAINT exhibitions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);


--
-- Name: home_collage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_collage (
    slot text NOT NULL,
    artwork_id uuid NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: login_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token_hash text NOT NULL,
    user_id uuid,
    is_new_user boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    confirmed_at timestamp without time zone,
    consumed_at timestamp without time zone
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    excerpt text,
    body text,
    cover_url text NOT NULL,
    starts_on date,
    ends_on date,
    time_text text,
    place text,
    price_text text,
    signup_url text,
    artist_id uuid,
    is_featured boolean DEFAULT false NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    published_at timestamp with time zone,
    source_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT posts_category_check CHECK ((category = ANY (ARRAY['exhibition'::text, 'event'::text, 'news'::text, 'article'::text]))),
    CONSTRAINT posts_dates_order CHECK (((ends_on IS NULL) OR (starts_on IS NULL) OR (ends_on >= starts_on))),
    CONSTRAINT posts_excerpt_check CHECK ((char_length(excerpt) <= 200)),
    CONSTRAINT posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);


--
-- Name: seller_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seller_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    display_name text NOT NULL,
    bio text NOT NULL,
    telegram_contact text,
    status public.application_status DEFAULT 'pending'::public.application_status NOT NULL,
    rejection_reason text,
    reviewed_by_admin_id uuid,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp without time zone,
    avatar_url text
);


--
-- Name: staff_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_accounts (
    login text NOT NULL,
    password_hash text NOT NULL,
    password_changed_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: techniques; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.techniques (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    telegram_id bigint NOT NULL,
    username text,
    full_name text NOT NULL,
    photo_url text,
    role public.role DEFAULT 'buyer'::public.role NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: artwork_likes artwork_likes_user_id_artwork_id_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artwork_likes
    ADD CONSTRAINT artwork_likes_user_id_artwork_id_pk PRIMARY KEY (user_id, artwork_id);


--
-- Name: artworks artworks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artworks
    ADD CONSTRAINT artworks_pkey PRIMARY KEY (id);


--
-- Name: banners banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_unique UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: exhibition_halls exhibition_halls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exhibition_halls
    ADD CONSTRAINT exhibition_halls_pkey PRIMARY KEY (id);


--
-- Name: exhibition_works exhibition_works_once; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exhibition_works
    ADD CONSTRAINT exhibition_works_once UNIQUE (exhibition_id, artwork_id);


--
-- Name: exhibition_works exhibition_works_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exhibition_works
    ADD CONSTRAINT exhibition_works_pkey PRIMARY KEY (hall_id, artwork_id);


--
-- Name: exhibitions exhibitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exhibitions
    ADD CONSTRAINT exhibitions_pkey PRIMARY KEY (id);


--
-- Name: exhibitions exhibitions_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exhibitions
    ADD CONSTRAINT exhibitions_slug_key UNIQUE (slug);


--
-- Name: home_collage home_collage_artwork_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_collage
    ADD CONSTRAINT home_collage_artwork_id_unique UNIQUE (artwork_id);


--
-- Name: home_collage home_collage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_collage
    ADD CONSTRAINT home_collage_pkey PRIMARY KEY (slot);


--
-- Name: login_requests login_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_requests
    ADD CONSTRAINT login_requests_pkey PRIMARY KEY (id);


--
-- Name: login_requests login_requests_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_requests
    ADD CONSTRAINT login_requests_token_hash_unique UNIQUE (token_hash);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: posts posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_slug_key UNIQUE (slug);


--
-- Name: seller_applications seller_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_applications
    ADD CONSTRAINT seller_applications_pkey PRIMARY KEY (id);


--
-- Name: seller_applications seller_applications_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_applications
    ADD CONSTRAINT seller_applications_user_id_unique UNIQUE (user_id);


--
-- Name: staff_accounts staff_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_accounts
    ADD CONSTRAINT staff_accounts_pkey PRIMARY KEY (login);


--
-- Name: techniques techniques_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.techniques
    ADD CONSTRAINT techniques_name_unique UNIQUE (name);


--
-- Name: techniques techniques_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.techniques
    ADD CONSTRAINT techniques_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_telegram_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_telegram_id_unique UNIQUE (telegram_id);


--
-- Name: artwork_likes_artwork_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX artwork_likes_artwork_id_idx ON public.artwork_likes USING btree (artwork_id);


--
-- Name: banners_active_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX banners_active_order_idx ON public.banners USING btree (is_active, sort_order);


--
-- Name: exhibition_halls_exhibition_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exhibition_halls_exhibition_idx ON public.exhibition_halls USING btree (exhibition_id, "position");


--
-- Name: exhibition_works_artwork_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exhibition_works_artwork_idx ON public.exhibition_works USING btree (artwork_id);


--
-- Name: exhibitions_status_starts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exhibitions_status_starts_idx ON public.exhibitions USING btree (status, starts_on);


--
-- Name: posts_one_featured_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX posts_one_featured_idx ON public.posts USING btree (is_featured) WHERE is_featured;


--
-- Name: posts_starts_on_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_starts_on_idx ON public.posts USING btree (starts_on);


--
-- Name: posts_status_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_status_published_idx ON public.posts USING btree (status, published_at);


--
-- Name: artwork_likes artwork_likes_artwork_id_artworks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artwork_likes
    ADD CONSTRAINT artwork_likes_artwork_id_artworks_id_fk FOREIGN KEY (artwork_id) REFERENCES public.artworks(id) ON DELETE CASCADE;


--
-- Name: artwork_likes artwork_likes_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artwork_likes
    ADD CONSTRAINT artwork_likes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: artworks artworks_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artworks
    ADD CONSTRAINT artworks_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: artworks artworks_reviewed_by_admin_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artworks
    ADD CONSTRAINT artworks_reviewed_by_admin_id_users_id_fk FOREIGN KEY (reviewed_by_admin_id) REFERENCES public.users(id);


--
-- Name: artworks artworks_seller_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artworks
    ADD CONSTRAINT artworks_seller_id_users_id_fk FOREIGN KEY (seller_id) REFERENCES public.users(id);


--
-- Name: artworks artworks_technique_id_techniques_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.artworks
    ADD CONSTRAINT artworks_technique_id_techniques_id_fk FOREIGN KEY (technique_id) REFERENCES public.techniques(id);


--
-- Name: banners banners_artwork_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_artwork_id_fkey FOREIGN KEY (artwork_id) REFERENCES public.artworks(id) ON DELETE SET NULL;


--
-- Name: exhibition_halls exhibition_halls_exhibition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exhibition_halls
    ADD CONSTRAINT exhibition_halls_exhibition_id_fkey FOREIGN KEY (exhibition_id) REFERENCES public.exhibitions(id) ON DELETE CASCADE;


--
-- Name: exhibition_works exhibition_works_artwork_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exhibition_works
    ADD CONSTRAINT exhibition_works_artwork_id_fkey FOREIGN KEY (artwork_id) REFERENCES public.artworks(id) ON DELETE CASCADE;


--
-- Name: exhibition_works exhibition_works_exhibition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exhibition_works
    ADD CONSTRAINT exhibition_works_exhibition_id_fkey FOREIGN KEY (exhibition_id) REFERENCES public.exhibitions(id) ON DELETE CASCADE;


--
-- Name: exhibition_works exhibition_works_hall_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exhibition_works
    ADD CONSTRAINT exhibition_works_hall_id_fkey FOREIGN KEY (hall_id) REFERENCES public.exhibition_halls(id) ON DELETE CASCADE;


--
-- Name: exhibitions exhibitions_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exhibitions
    ADD CONSTRAINT exhibitions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE SET NULL;


--
-- Name: home_collage home_collage_artwork_id_artworks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_collage
    ADD CONSTRAINT home_collage_artwork_id_artworks_id_fk FOREIGN KEY (artwork_id) REFERENCES public.artworks(id) ON DELETE CASCADE;


--
-- Name: login_requests login_requests_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_requests
    ADD CONSTRAINT login_requests_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: posts posts_artist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: seller_applications seller_applications_reviewed_by_admin_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_applications
    ADD CONSTRAINT seller_applications_reviewed_by_admin_id_users_id_fk FOREIGN KEY (reviewed_by_admin_id) REFERENCES public.users(id);


--
-- Name: seller_applications seller_applications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_applications
    ADD CONSTRAINT seller_applications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: banners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

--
-- Name: banners banners_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY banners_public_read ON public.banners FOR SELECT USING ((is_active AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at > now()))));


--
-- Name: exhibition_halls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exhibition_halls ENABLE ROW LEVEL SECURITY;

--
-- Name: exhibition_works; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exhibition_works ENABLE ROW LEVEL SECURITY;

--
-- Name: exhibitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exhibitions ENABLE ROW LEVEL SECURITY;

--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

--
-- Name: posts posts_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY posts_public_read ON public.posts FOR SELECT USING (((status = 'published'::text) AND (published_at IS NOT NULL) AND (published_at <= now())));


--
-- Name: staff_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

--
-- Name: artwork_likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.artwork_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: artworks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.artworks ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: home_collage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_collage ENABLE ROW LEVEL SECURITY;

--
-- Name: login_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.login_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: seller_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: techniques; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.techniques ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

\unrestrict 07klbNuujbs6Ke1yOzhi0E52uNp5cdGIoLD9QigB18Mejc9bhLbCRrKpE1nVd0b

