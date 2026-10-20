import os

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

load_dotenv()

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ["DATABASE_URL"]
db = SQLAlchemy(app)


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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
