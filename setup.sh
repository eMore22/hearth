#!/bin/bash
# Run this once from the hearth/ root directory
# Sets up git, makes first commit, ready to push to GitHub

set -e

echo "🏠 Setting up Hearth git repository..."

# Init git
git init

# Copy env examples (don't commit real .env files)
cp backend/api/.env.example backend/api/.env
cp apps/mobile/.env.example apps/mobile/.env

echo ""
echo "📝 Fill in your API keys before running the app:"
echo "   backend/api/.env     → Supabase, Anthropic, AWS keys"
echo "   apps/mobile/.env     → Supabase public keys + API URL"
echo ""

# Stage everything
git add .

# First commit
git commit -m "feat: initial Hearth project scaffold

- Full monorepo structure (mobile + backend + infra)
- FastAPI backend with all 5 module routers (Module 1 fully built)
- React Native + Expo mobile app with auth + document vault
- Document agent: OCR extraction, expiry monitoring, AI Q&A
- Supabase schema: all 5 modules, RLS policies
- Celery workers: daily expiry monitor, weekly meal planner stub
- Feature flags: activate modules progressively
- Docker Compose for local dev
- Render deployment config"

echo ""
echo "✅ Git initialized with first commit."
echo ""
echo "Next steps:"
echo "  1. Create a GitHub repo: https://github.com/new"
echo "  2. git remote add origin https://github.com/eMore22/hearth.git"
echo "  3. git push -u origin main"
echo ""
echo "To run the backend locally:"
echo "  cd backend/api"
echo "  python -m venv venv && source venv/bin/activate"
echo "  pip install -r requirements.txt"
echo "  uvicorn app.main:app --reload"
echo ""
echo "To run the mobile app:"
echo "  cd apps/mobile"
echo "  npm install"
echo "  npx expo start"
