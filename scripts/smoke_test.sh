#!/usr/bin/env bash
# Smoke test for docker-compose stack.
# Usage: ./scripts/smoke_test.sh
# Requires: docker, docker-compose, curl, jq

set -euo pipefail

SIDECAR="http://localhost:8000"
API="http://localhost:4000"

pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; exit 1; }

echo "=== RecruitIQ Smoke Test ==="
echo ""
echo "Starting stack..."
docker-compose up -d --build

echo "Waiting for sidecar health check..."
for i in $(seq 1 30); do
  if curl -sf "$SIDECAR/health" > /dev/null 2>&1; then break; fi
  echo "  waiting... ($i/30)"
  sleep 5
done

echo "Waiting for API health check..."
for i in $(seq 1 40); do
  if curl -sf "$API/health" > /dev/null 2>&1; then break; fi
  echo "  waiting... ($i/40)"
  sleep 5
done

echo ""
echo "Running checks..."

# 1. Sidecar health
STATUS=$(curl -sf "$SIDECAR/health" | jq -r '.status')
[ "$STATUS" = "ok" ] && pass "Sidecar /health returns ok" || fail "Sidecar health failed"

# 2. API health
STATUS=$(curl -sf "$API/health" | jq -r '.status')
[ "$STATUS" = "ok" ] && pass "API /health returns ok" || fail "API health failed"

# 3. GET /candidates returns data
COUNT=$(curl -sf "$API/candidates" | jq 'length')
[ "$COUNT" -gt 0 ] && pass "GET /candidates returns $COUNT candidates" || fail "No candidates found"

# 4. GET /jds returns data
JD_COUNT=$(curl -sf "$API/jds" | jq 'length')
[ "$JD_COUNT" -gt 0 ] && pass "GET /jds returns $JD_COUNT job descriptions" || fail "No JDs found"

# 5. UI is served (index.html)
HTTP_CODE=$(curl -so /dev/null -w "%{http_code}" "$API/")
[ "$HTTP_CODE" = "200" ] && pass "React UI served at $API/" || fail "UI not served (got $HTTP_CODE)"

echo ""
echo "=== All smoke tests passed! ==="
echo ""
echo "Tearing down..."
docker-compose down
