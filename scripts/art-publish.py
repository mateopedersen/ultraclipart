#!/usr/bin/env python3
"""Compatibility notice: scripts/r2 is the only supported R2 ingestion path."""
import sys
print('Use node scripts/r2/make-batch.mjs, plan.mjs and ingest.mjs. This superseded entry point does not upload anything.', file=sys.stderr)
raise SystemExit(2)
