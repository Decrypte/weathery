from flask import Flask, render_template, jsonify, request, send_from_directory
import sqlite3
from datetime import datetime
import os

app = Flask(__name__, static_folder="static", static_url_path="")

DATABASE = "weather.db"


def init_db():
    with sqlite3.connect(DATABASE) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS search_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                location TEXT NOT NULL,
                search_type TEXT NOT NULL,
                temperature REAL,
                date_range TEXT,
                granularity TEXT,
                coordinates TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """
        )
        conn.commit()


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/history", methods=["GET", "POST", "DELETE"])
def handle_history():
    if request.method == "GET":
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, location, search_type, temperature, date_range, granularity, timestamp
            FROM search_history
            ORDER BY timestamp DESC
            LIMIT 20
        """
        )
        history = []
        for row in cursor.fetchall():
            history.append(
                {
                    "id": row["id"],
                    "location": row["location"],
                    "search_type": row["search_type"],
                    "temperature": row["temperature"],
                    "date_range": row["date_range"],
                    "granularity": row["granularity"],
                    "timestamp": row["timestamp"],
                }
            )
        conn.close()
        return jsonify(history)

    elif request.method == "POST":
        data = request.json
        conn = get_db()
        cursor = conn.cursor()

        coordinates = None
        if "coordinates" in data:
            coordinates = f"{data['coordinates']['lat']},{data['coordinates']['lon']}"

        cursor.execute(
            """
            INSERT INTO search_history (location, search_type, temperature, date_range, granularity, coordinates)
            VALUES (?, ?, ?, ?, ?, ?)
        """,
            (
                data.get("location"),
                data.get("search_type"),
                data.get("temperature"),
                data.get("date_range"),
                data.get("granularity"),
                coordinates,
            ),
        )
        conn.commit()
        conn.close()
        return jsonify({"status": "success"}), 201

    elif request.method == "DELETE":
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM search_history")
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})


@app.route("/api/history/<int:id>", methods=["DELETE"])
def delete_history_item(id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM search_history WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})


if __name__ == "__main__":
    init_db()
    print("🌤️ Weathery App Server Running!")
    print("📍 Open http://localhost:5000 in your browser")
    print("📚 Database: weather.db (SQLite)")
    app.run(debug=True, port=5000)
