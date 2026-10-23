-- Better Auth 1.7.10 core schema, with the model names configured in lib/auth.ts.
-- Run through npm run db:migrate before serving authenticated requests.
CREATE TABLE IF NOT EXISTS auth_user (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  image text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_session (
  id text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS auth_session_user_idx ON auth_session("userId");
CREATE INDEX IF NOT EXISTS auth_session_expires_idx ON auth_session("expiresAt");

CREATE TABLE IF NOT EXISTS auth_account (
  id text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("providerId", "accountId")
);
CREATE INDEX IF NOT EXISTS auth_account_user_idx ON auth_account("userId");

CREATE TABLE IF NOT EXISTS auth_verification (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_verification_identifier_idx ON auth_verification(identifier);

CREATE TABLE IF NOT EXISTS auth_rate_limit (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  count integer NOT NULL,
  "lastRequest" bigint NOT NULL
);
