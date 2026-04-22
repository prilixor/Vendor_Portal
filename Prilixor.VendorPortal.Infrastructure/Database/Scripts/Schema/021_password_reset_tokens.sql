CREATE TABLE public.password_reset_tokens (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	email varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	expires_at timestamptz NOT NULL,
	is_used bool DEFAULT false NOT NULL,
	used_at timestamptz NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id),
	CONSTRAINT password_reset_tokens_token_key UNIQUE (token)
);
CREATE INDEX idx_password_reset_tokens_email ON public.password_reset_tokens USING btree (email);
CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);