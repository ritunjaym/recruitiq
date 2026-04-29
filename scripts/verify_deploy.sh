#!/usr/bin/env bash
# Verify a live Cloud Run deployment.
# Usage: API_URL=https://recruitiq-api-xxx-uw.a.run.app ./scripts/verify_deploy.sh

set -euo pipefail

API_URL="${API_URL:-}"
if [ -z "${API_URL}" ]; then
  # Try to fetch from gcloud if not provided
  API_URL=$(gcloud run services describe recruitiq-api \
    --region="us-west2" \
    --project="recruitiq-494623" \
    --format="value(status.url)" 2>/dev/null || true)
fi

if [ -z "${API_URL}" ]; then
  echo "ERROR: API_URL not set. Run: API_URL=https://... ./scripts/verify_deploy.sh"
  exit 1
fi

pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; FAILURES=$((FAILURES + 1)); }
FAILURES=0

echo "=== Verifying RecruitIQ at ${API_URL} ==="
echo ""

# 1. API health
STATUS=$(curl -sf "${API_URL}/health" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "error")
[ "${STATUS}" = "ok" ] && pass "GET /health → ok" || fail "GET /health failed (got: ${STATUS})"

# 2. Candidates endpoint
COUNT=$(curl -sf "${API_URL}/candidates" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
[ "${COUNT}" -gt 0 ] && pass "GET /candidates → ${COUNT} candidates" || fail "GET /candidates returned no data"

# 3. JDs endpoint
JD_COUNT=$(curl -sf "${API_URL}/jds" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
[ "${JD_COUNT}" -gt 0 ] && pass "GET /jds → ${JD_COUNT} job descriptions" || fail "GET /jds returned no data"

# 4. UI is served
HTTP_CODE=$(curl -so /dev/null -w "%{http_code}" "${API_URL}/" 2>/dev/null || echo "0")
[ "${HTTP_CODE}" = "200" ] && pass "React UI served (HTTP ${HTTP_CODE})" || fail "UI not served (HTTP ${HTTP_CODE})"

# 5. Single candidate endpoint
CANDIDATE_ID=$(curl -sf "${API_URL}/candidates" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])" 2>/dev/null || echo "")
if [ -n "${CANDIDATE_ID}" ]; then
  NAME=$(curl -sf "${API_URL}/candidates/${CANDIDATE_ID}" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])" 2>/dev/null || echo "")
  [ -n "${NAME}" ] && pass "GET /candidates/${CANDIDATE_ID} → ${NAME}" || fail "GET /candidates/:id failed"
fi

echo ""
if [ "${FAILURES}" -eq 0 ]; then
  echo "=== All checks passed! RecruitIQ is live. ==="
  echo ""
  echo "  Open: ${API_URL}"
else
  echo "=== ${FAILURES} check(s) failed. ==="
  exit 1
fi
