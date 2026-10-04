# AI Telecom – VDart Academy Call Assist

An AI-powered telecom call assistant developed during a VDart project/internship.

The system supports AI-assisted student calling, conversational data collection, missed-joining follow-up, Tamil/English language handling, call records, and an admin dashboard.

## Technology Stack

- Python
- FastAPI
- PostgreSQL
- React
- TypeScript
- Vite
- OpenRouter
- Deepgram
- ElevenLabs
- Exotel
- REST APIs
- WebSockets

## Project Structure

```text
AI_Tellecom-fixed/
├── backend/       # FastAPI backend and AI/call services
├── frontend/      # React + TypeScript frontend
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Backend Setup

1. Open a terminal in `backend/`.
2. Create a Python virtual environment.
3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Copy `.env.example` to `.env`.
5. Add your own PostgreSQL and API credentials to `.env`.
6. Start the backend:

```bash
python -m uvicorn main:app --reload
```

## Frontend Setup

1. Open a terminal in `frontend/`.
2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

## Important

API keys, passwords, database credentials, `.env` files, virtual environments, and `node_modules` are intentionally excluded from this repository.

This repository contains the project source code only.
