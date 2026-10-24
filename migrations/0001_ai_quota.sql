CREATE TABLE IF NOT EXISTS ai_jobs (
 id TEXT PRIMARY KEY, day TEXT NOT NULL, visitor TEXT NOT NULL, network TEXT NOT NULL,
 created INTEGER NOT NULL, lease INTEGER NOT NULL, status TEXT NOT NULL,
 model TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, steps INTEGER NOT NULL,
 reserved REAL NOT NULL CHECK(reserved>=0), actual REAL, error_code TEXT
);
CREATE INDEX IF NOT EXISTS ai_jobs_day ON ai_jobs(day);
CREATE INDEX IF NOT EXISTS ai_jobs_visitor ON ai_jobs(day,visitor);
CREATE INDEX IF NOT EXISTS ai_jobs_network ON ai_jobs(day,network,created);
CREATE INDEX IF NOT EXISTS ai_jobs_active ON ai_jobs(status,lease);
CREATE TABLE IF NOT EXISTS ai_control (id INTEGER PRIMARY KEY CHECK(id=1), blocked_until INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO ai_control(id,blocked_until) VALUES(1,0);
