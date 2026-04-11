# Hearth 🏠

> Your household's AI chief of staff.

Hearth is a consumer AI app that manages documents, bills, groceries, home maintenance, and family health — all in one place, proactively, so nothing slips through the cracks.

---

## Monorepo Structure

```
hearth/
├── apps/
│   ├── mobile/          # React Native (Expo) — iOS + Android
│   └── web/             # Next.js — coming later
├── backend/
│   ├── api/             # FastAPI backend
│   └── workers/         # Celery background jobs
├── shared/
│   ├── types/           # Shared TypeScript types
│   └── utils/           # Shared utilities
├── infra/
│   ├── docker/          # Dockerfiles
│   └── supabase/        # DB migrations + RLS policies
└── docs/                # Internal documentation
```

---

## Modules

| # | Module | Status |
|---|--------|--------|
| 1 | Document Vault & Expiry Agent | 🔨 Building |
| 2 | Bill & Subscription Intelligence | 🔒 Coming soon |
| 3 | Grocery & Meal Intelligence | 🔒 Coming soon |
| 4 | Home Maintenance & Repair | 🔒 Coming soon |
| 5 | Family Health Triage | 🔒 Coming soon |

---

## Quick Start

### Mobile
```bash
cd apps/mobile
npm install
npx expo start
```

### Backend
```bash
cd backend/api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # fill in your keys
uvicorn app.main:app --reload
```

---

## Environment Variables

See `backend/api/.env.example` and `apps/mobile/.env.example` for required keys.

---

## Tech Stack

- **Mobile:** React Native + Expo
- **Backend:** FastAPI (Python)
- **Database:** Supabase (PostgreSQL)
- **AI:** Claude API (Anthropic)
- **OCR:** AWS Textract
- **Storage:** Supabase Storage
- **Background Jobs:** Celery + Redis
- **Push Notifications:** Expo + Firebase
- **Payments:** Paddle
- **Deployment:** Render (backend) + Expo EAS (mobile)
