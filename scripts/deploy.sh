#!/usr/bin/env bash
# Deploy RecruitIQ to GCP Cloud Run.
# Usage: ANTHROPIC_API_KEY=sk-... ./scripts/deploy.sh
#
# Pre-requisites (already completed):
#   gcloud auth login
#   gcloud projects create recruitiq-494623
#   gcloud billing enable ...
#   gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com

set -euo pipefail

PROJECT_ID="recruitiq-494623"
REGION="us-west2"
REPO="recruitiq"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "ERROR: ANTHROPIC_API_KEY must be set"
  echo "Usage: ANTHROPIC_API_KEY=sk-... ./scripts/deploy.sh"
  exit 1
fi

echo "=== RecruitIQ — GCP Cloud Run Deploy ==="
echo "Project:  ${PROJECT_ID}"
echo "Region:   ${REGION}"
echo ""

# ── 1. Configure Docker auth ──────────────────────────────────────────────────
echo "[1/6] Configuring Docker auth..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# ── 2. Create Artifact Registry repo ─────────────────────────────────────────
echo "[2/6] Ensuring Artifact Registry repo exists..."
gcloud artifacts repositories create "${REPO}" \
  --repository-format=docker \
  --location="${REGION}" \
  --project="${PROJECT_ID}" \
  --quiet 2>/dev/null \
  && echo "  Created: ${REPO}" \
  || echo "  Already exists: ${REPO}"

# ── 3. Build + push sidecar ───────────────────────────────────────────────────
echo "[3/6] Building and pushing sidecar image..."
docker build \
  --platform linux/amd64 \
  -t "${REGISTRY}/sidecar:latest" \
  ./sidecar
docker push "${REGISTRY}/sidecar:latest"
echo "  Pushed: ${REGISTRY}/sidecar:latest"

# ── 4. Build + push API (multi-stage, includes UI) ───────────────────────────
echo "[4/6] Building and pushing API image (includes UI build)..."
docker build \
  --platform linux/amd64 \
  -t "${REGISTRY}/api:latest" \
  -f api/Dockerfile \
  .
docker push "${REGISTRY}/api:latest"
echo "  Pushed: ${REGISTRY}/api:latest"

# ── 5. Deploy sidecar ────────────────────────────────────────────────────────
echo "[5/6] Deploying sidecar to Cloud Run..."
gcloud run deploy recruitiq-sidecar \
  --image="${REGISTRY}/sidecar:latest" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --platform=managed \
  --allow-unauthenticated \
  --memory=4Gi \
  --cpu=2 \
  --timeout=600 \
  --concurrency=10 \
  --set-env-vars="ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}" \
  --quiet

SIDECAR_URL=$(gcloud run services describe recruitiq-sidecar \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.url)")
echo "  Sidecar live at: ${SIDECAR_URL}"

# ── 6. Deploy API ─────────────────────────────────────────────────────────────
echo "[6/6] Deploying API to Cloud Run..."
gcloud run deploy recruitiq-api \
  --image="${REGISTRY}/api:latest" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --platform=managed \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=1 \
  --timeout=600 \
  --concurrency=50 \
  --set-env-vars="ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY},SIDECAR_URL=${SIDECAR_URL},NODE_ENV=production" \
  --quiet

API_URL=$(gcloud run services describe recruitiq-api \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.url)")
echo "  API live at: ${API_URL}"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "=== Deploy complete! ==="
echo ""
echo "  Sidecar:  ${SIDECAR_URL}"
echo "  API + UI: ${API_URL}"
echo ""
echo "Run smoke tests:"
echo "  API_URL=${API_URL} ./scripts/verify_deploy.sh"
