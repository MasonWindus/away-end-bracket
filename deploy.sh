#!/usr/bin/env bash
set -euo pipefail

# ─── The Away End — World Cup 2026 Bracket — Deploy Script ────────────────────
# Usage: ./deploy.sh [staging|prod]
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#   - Node.js 20+ installed
#   - AWS CDK CLI: npm install -g aws-cdk
#   - SSM parameters created (see README.md)

STAGE="${1:-prod}"
echo "🚀 Deploying The Away End Bracket [${STAGE}]"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ─── 1. Install dependencies ──────────────────────────────────────────────────
echo "📦 Installing dependencies..."
cd backend  && npm install && cd ..
cd frontend && npm install && cd ..
cd infrastructure && npm install && cd ..

# ─── 2. Build backend ─────────────────────────────────────────────────────────
echo "🔨 Building backend..."
cd backend
npm run build
echo "  ✓ Backend built → dist/index.js"
cd ..

# ─── 3. Build frontend ────────────────────────────────────────────────────────
echo "🎨 Building frontend..."
cd frontend

# Set API URL: for prod/staging, use relative /api (served via CloudFront)
VITE_API_URL="/api" npm run build
echo "  ✓ Frontend built → dist/"
cd ..

# ─── 4. Deploy infrastructure (CDK) ──────────────────────────────────────────
echo "☁️  Deploying AWS infrastructure..."
cd infrastructure

# Bootstrap CDK if needed (first-time only)
if [ "${CDK_BOOTSTRAP:-false}" = "true" ]; then
  echo "  Bootstrapping CDK..."
  npx cdk bootstrap
fi

# Synthesize to check for errors
npx cdk synth --quiet

# Deploy the stack
npx cdk deploy AwayEndBracketStack \
  --require-approval never \
  --outputs-file ../cdk-outputs.json

echo "  ✓ Infrastructure deployed"
cd ..

# ─── 5. Print outputs ─────────────────────────────────────────────────────────
if [ -f cdk-outputs.json ]; then
  echo ""
  echo "✅ Deployment complete!"
  echo ""
  echo "📊 Stack outputs:"
  cat cdk-outputs.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
stack = list(data.values())[0]
for k, v in stack.items():
    print(f'  {k}: {v}')
"
  SITE_URL=$(cat cdk-outputs.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
stack = list(data.values())[0]
print(stack.get('CloudFrontUrl', ''))
")
  echo ""
  echo "🌐 Site: ${SITE_URL}"
fi

echo ""
echo "⚠️  Post-deployment checklist:"
echo "  1. Verify SES email identity is verified in AWS Console"
echo "  2. Update /away-end/frontend-url SSM parameter with the CloudFront URL above"
echo "  3. Re-run ./deploy.sh to pick up the updated FRONTEND_URL"
echo "  4. Test magic link auth flow end-to-end"
