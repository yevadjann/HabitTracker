import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from sqlalchemy import text

from models import COLORS, Habit, HabitLog, db

load_dotenv()

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ["DATABASE_URL"]
db.init_app(app)

# Demo habits created when the table is empty: 1 = done, oldest day first, last = today
DEMO_HABITS = [
    ("Read 20 pages", "00111111111111111111"),
    ("Drink water", "11011111011110111111"),
    ("Walk 8k steps", "10110111001011010110"),
]


def utc_today():
    return datetime.now(timezone.utc).date()


def setup_database():
    db.create_all()
    if Habit.query.count() > 0:
        return
    today = utc_today()
    for i, (name, pattern) in enumerate(DEMO_HABITS):
        habit = Habit(name=name, color=COLORS[i % len(COLORS)])
        for k, mark in enumerate(pattern):
            if mark == "1":
                habit.logs.append(HabitLog(day=today - timedelta(days=len(pattern) - 1 - k)))
        db.session.add(habit)
    db.session.commit()


def error(message, status):
    return jsonify(error=message), status


def clean_name(data):
    name = data.get("name") if isinstance(data, dict) else None
    if not isinstance(name, str):
        return None
    name = name.strip()
    return name if 1 <= len(name) <= 100 else None


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/health")
def health():
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify(status="ok", db="connected")
    except Exception as e:
        return jsonify(status="error", db="disconnected", error=str(e)), 500


@app.route("/api/habits", methods=["GET"])
def list_habits():
    habits = Habit.query.order_by(Habit.id).all()
    return jsonify([habit.to_dict() for habit in habits])


@app.route("/api/habits", methods=["POST"])
def create_habit():
    name = clean_name(request.get_json(silent=True))
    if name is None:
        return error("Name must be 1-100 characters", 400)
    habit = Habit(name=name, color=COLORS[Habit.query.count() % len(COLORS)])
    db.session.add(habit)
    db.session.commit()
    return jsonify(habit.to_dict()), 201


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
