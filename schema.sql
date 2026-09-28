CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  source_article_id TEXT,
  title_original TEXT,
  title_gujarati TEXT NOT NULL,
  title_english TEXT,
  summary_gujarati TEXT,
  summary_english TEXT,
  content_gujarati TEXT,
  content_english TEXT,
  category TEXT,
  city TEXT,
  image_url TEXT,
  image_width INTEGER DEFAULT 1000,
  image_height INTEGER DEFAULT 600,
  published_at TEXT,
  fetched_at TEXT NOT NULL,
  status TEXT DEFAULT 'published',
  slug TEXT UNIQUE,
  seo_title TEXT,
  seo_description TEXT,
  tags TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  feed_url TEXT,
  homepage_url TEXT,
  enabled INTEGER DEFAULT 1,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS publishing_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_at TEXT NOT NULL,
  source_name TEXT,
  fetched INTEGER DEFAULT 0,
  published INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  message TEXT
);

CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_city ON articles(city);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
