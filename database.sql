-- ============================================================
-- RADAR DE OPORTUNIDADES INVISÍVEIS — Banco de Dados Supabase
-- Cole este SQL no: Supabase → SQL Editor → New Query → Run
-- ============================================================

-- Tabela de usuários (complementa o Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  name          TEXT,
  area          TEXT DEFAULT 'Tecnologia',
  city          TEXT,
  linkedin      TEXT,
  contract_type TEXT DEFAULT 'CLT',
  level         TEXT DEFAULT 'Pleno',
  modality      TEXT DEFAULT 'Indiferente',
  interests     TEXT[] DEFAULT '{}',

  -- Plano
  is_premium              BOOLEAN DEFAULT FALSE,
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  premium_since           TIMESTAMPTZ,
  premium_until           TIMESTAMPTZ,

  -- Uso gratuito (reseta diariamente)
  free_used_today   INTEGER DEFAULT 0,
  free_reset_date   DATE DEFAULT CURRENT_DATE,

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de oportunidades detectadas
CREATE TABLE IF NOT EXISTS opportunities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company     TEXT NOT NULL,
  role        TEXT NOT NULL,
  area        TEXT,
  city        TEXT,
  score       INTEGER CHECK (score >= 0 AND score <= 100),
  level       TEXT CHECK (level IN ('high', 'medium', 'low')),
  reason      TEXT,
  signals     TEXT[],
  strategy    TEXT[],
  tags        TEXT[],
  source      TEXT[],
  initials    TEXT,
  color       TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de favoritos
CREATE TABLE IF NOT EXISTS favorites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id  UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, opportunity_id)
);

-- Tabela de histórico de ações
CREATE TABLE IF NOT EXISTS history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id  UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  action          TEXT NOT NULL, -- 'viewed', 'anticipated', 'applied'
  company         TEXT,
  role            TEXT,
  score           INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de pagamentos (log)
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id),
  stripe_session_id   TEXT,
  stripe_event_type   TEXT,
  amount_cents        INTEGER,
  status              TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== SEGURANÇA (RLS) ====================
-- Habilita Row Level Security: cada usuário vê só seus dados

ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites   ENABLE ROW LEVEL SECURITY;
ALTER TABLE history     ENABLE ROW LEVEL SECURITY;

-- Usuários só acessam seus próprios dados
CREATE POLICY "users_own" ON users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "favorites_own" ON favorites
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "history_own" ON history
  FOR ALL USING (auth.uid() = user_id);

-- Oportunidades são públicas para leitura
CREATE POLICY "opportunities_read" ON opportunities
  FOR SELECT USING (is_active = TRUE);

-- ==================== FUNÇÃO: resetar uso gratuito diário ====================
CREATE OR REPLACE FUNCTION reset_free_usage()
RETURNS void AS $$
  UPDATE users
  SET free_used_today = 0, free_reset_date = CURRENT_DATE
  WHERE free_reset_date < CURRENT_DATE;
$$ LANGUAGE sql SECURITY DEFINER;

-- Rode esta função diariamente com o Supabase Cron (ou manualmente)
-- SELECT reset_free_usage();

-- ==================== DADOS INICIAIS (oportunidades de exemplo) ====================
INSERT INTO opportunities (company, role, area, city, score, level, reason, signals, strategy, tags, initials, color) VALUES
('Nubank', 'Engenharia de Software', 'Tecnologia', 'São Paulo / Remoto', 92, 'high',
  'A empresa anunciou expansão para México e Argentina. Histórico indica abertura massiva de vagas.',
  ARRAY['Abriu capital em nova rodada de investimento', 'Post LinkedIn: "Escalando time de engenharia"', '3 vagas similares fechadas em semanas'],
  ARRAY['Conectar com o CTO no LinkedIn', 'Demonstrar experiência com alta escala', 'Mencionar interesse em mercados latinos'],
  ARRAY['Tech', 'Remoto', 'Senior'], 'NU', '#8B5CF6'),
('iFood', 'Product Manager', 'Tecnologia', 'São Paulo / Remoto', 88, 'high',
  'Expansão para 12 novas cidades e repositório GitHub mostra novo produto em desenvolvimento.',
  ARRAY['Expansão para 12 novas cidades', '3 VPs de produto contratados em 60 dias', 'Repositório GitHub mostra novo produto'],
  ARRAY['Mostrar experiência com produtos de logística', 'Analisar produto atual e propor melhorias', 'Abordar Head of Product com insight'],
  ARRAY['Produto', 'PJ', 'Remoto'], 'IF', '#EF4444'),
('Creditas', 'Data Scientist', 'Tecnologia', 'São Paulo / Remoto', 91, 'high',
  'Investimento declarado em IA e novo VP de Data contratado — sinal fortíssimo de contratações.',
  ARRAY['Notícia: "Creditas investe em IA para análise de crédito"', 'Busca no LinkedIn por ML aumentou 300%', 'Novo VP de Data contratado'],
  ARRAY['Demonstrar experiência com modelos de crédito', 'Apresentar trabalhos com XAI', 'Contato via email do novo VP'],
  ARRAY['Dados', 'Remoto', 'PJ'], 'CR', '#F59E0B');

COMMIT;
