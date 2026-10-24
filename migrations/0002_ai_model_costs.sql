-- No prompts, images, raw IPs, user agents, or credentials are retained here.
-- Reservations are portions of the parent job's 250-Neuron budget, never extra allowance.
CREATE TABLE IF NOT EXISTS ai_model_calls (
 job_id TEXT NOT NULL REFERENCES ai_jobs(id) ON DELETE CASCADE,
 operation TEXT NOT NULL CHECK(operation IN ('translate','generate')),
 model TEXT NOT NULL,
 created INTEGER NOT NULL,
 width INTEGER,
 height INTEGER,
 steps INTEGER,
 max_output_tokens INTEGER,
 reserved REAL NOT NULL CHECK(reserved>=0),
 actual REAL,
 status TEXT NOT NULL CHECK(status IN ('running','complete','failed','uncertain')),
 error_code TEXT,
 PRIMARY KEY(job_id,operation)
);
CREATE INDEX IF NOT EXISTS ai_model_calls_created ON ai_model_calls(created);
-- Keep retention cleanup bounded even when quota is read frequently.
CREATE INDEX IF NOT EXISTS ai_jobs_created ON ai_jobs(created);
