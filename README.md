# Task Manageer / Todo with STT

A simple self-hosted task tracker built for DevOps/on-call style work — tasks have an environment (prod/staging), a severity (P0–P3), and an optional command/notes field, so it's easy to track ops-y to-dos instead of using a generic todo app.

I made this for personal use and just wanted to share it in case it's useful to someone else.

## Features

- Track tasks with environment, severity (P0–P3), command, tags, notes, and due date
- Drag-and-drop reordering
- Filter/search by severity, environment, or completion status
- Voice-to-text task creation (via a local Whisper speech-to-text service)
- SQLite storage (WAL mode), so it survives container restarts
- Fully dockerized — one `docker compose up` and you're running

## Stack

- **Backend:** FastAPI + SQLite
- **Frontend:** React (Vite) + nginx
- **Speech-to-text:** [openai-whisper-asr-webservice](https://github.com/ahmetoner/whisper-asr-webservice) (optional, for voice input)

## Getting Started

1. Clone the repo
2. Run:

   ```bash
   docker compose up -d --build
   ```

3. Open the app at [http://localhost:3000](http://localhost:3000)

The API runs on port `8080` and the (optional) speech-to-text service on port `9000`. Task data is stored in `./data`, so it persists across restarts.

## Notes

This was built for my own workflow, so it's kept intentionally simple — no auth, no multi-user support. Feel free to fork and adapt it if it's useful to you.
