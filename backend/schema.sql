-- Sparky Tool — Neon PostgreSQL schema
-- Run once: psql $DATABASE_URL -f schema.sql

CREATE TABLE IF NOT EXISTS users (
  id           VARCHAR(255) PRIMARY KEY,       -- Clerk user_xxx
  email        VARCHAR(255) UNIQUE NOT NULL,
  first_name   VARCHAR(255) DEFAULT '',
  last_name    VARCHAR(255) DEFAULT '',
  role         VARCHAR(50)  DEFAULT 'user',    -- 'user' | 'admin'
  onboarded    BOOLEAN      DEFAULT FALSE,
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_configs (
  id                SERIAL PRIMARY KEY,
  user_id           VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL DEFAULT 'Default Configuration',
  -- PeopleSoft
  ps_base_url       TEXT    DEFAULT '',
  ps_auth_type      VARCHAR(50) DEFAULT 'basic',
  ps_username       VARCHAR(255) DEFAULT '',
  ps_password_enc   TEXT    DEFAULT '',
  ps_endpoint       TEXT    DEFAULT '',
  ps_status_endpoint TEXT   DEFAULT '',
  ps_process_name   VARCHAR(255) DEFAULT 'SM_DISCOVERY',
  -- Retrieval
  retrieval_method  VARCHAR(50) DEFAULT 'sftp',
  sftp_host         VARCHAR(255) DEFAULT '',
  sftp_port         INT     DEFAULT 22,
  sftp_username     VARCHAR(255) DEFAULT '',
  sftp_password_enc TEXT    DEFAULT '',
  sftp_remote_path  TEXT    DEFAULT '',
  -- Meta
  is_active   BOOLEAN     DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS run_logs (
  id          SERIAL PRIMARY KEY,
  user_id     VARCHAR(255) NOT NULL REFERENCES users(id),
  config_id   INT REFERENCES user_configs(id) ON DELETE SET NULL,
  config_name VARCHAR(255) DEFAULT '',
  status      VARCHAR(50)  NOT NULL,           -- running | success | error
  instance_id VARCHAR(100) DEFAULT '',
  report_id   VARCHAR(100) DEFAULT '',
  row_count   INT,
  error_detail TEXT,
  duration_ms INT,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_events (
  id         SERIAL PRIMARY KEY,
  user_id    VARCHAR(255) REFERENCES users(id),
  event_type VARCHAR(100) NOT NULL,
  detail     JSONB        DEFAULT '{}',
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_run_logs_user_id    ON run_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_run_logs_started    ON run_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_id       ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created       ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_configs_user_id     ON user_configs(user_id);
