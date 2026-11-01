from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Colors are assigned to new habits in this order
COLORS = ["lime", "violet", "pink"]


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Habit(db.Model):
    __tablename__ = "habits"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)
    logs = db.relationship(
        "HabitLog", backref="habit", cascade="all, delete-orphan", order_by="HabitLog.day"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "color": self.color,
            "created_at": self.created_at.isoformat(timespec="seconds"),
            "logs": [log.day.isoformat() for log in self.logs],
        }


class HabitLog(db.Model):
    __tablename__ = "habit_logs"
    __table_args__ = (db.UniqueConstraint("habit_id", "day"),)

    id = db.Column(db.Integer, primary_key=True)
    habit_id = db.Column(db.Integer, db.ForeignKey("habits.id", ondelete="CASCADE"), nullable=False)
    day = db.Column(db.Date, nullable=False)
