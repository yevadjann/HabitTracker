# Habit Tracker

Flask + PostgreSQL app for tracking habits with streaks and logs.

## Setup

```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
docker run -d --name postgres-habit -p 5434:5432 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=mysecretpassword -e POSTGRES_DB=habitdb postgres:16
python app.py
```
