# Weathery - Smart Lightweight Weather App

A comprehensive weather application that provides current weather, 5-day forecasts, historical weather data, and search history tracking.

## Features
- 🌤️ Current weather and 5-day forecast
- 📊 Historical weather data with CSV export
- 📍 Interactive location maps
- 📜 Search history with SQLite database
- 🔍 Multiple search options: city names, ZIP codes, coordinates
- 💾 CRUD operations for search history

## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Flask (Python)
- Database: SQLite
- APIs: OpenWeatherMap, Open-Meteo, Mapbox

## Project Structure
```
weathery/
├── app.py              # Flask backend
├── weather.db          # SQLite database (auto-created)
├── static/
│   ├── index.html      # Main HTML file
│   ├── styles.css      # Styling
│   ├── app.js          # Frontend JavaScript
│   └── config.js       # API configuration
└── README.md
```

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/Decrypte/weathery.git
   cd weathery
   ```

2. **Install Flask**
   ```bash
   pip install flask
   ```

3. **Run the application**
   ```bash
   python app.py
   ```

4. **Open in browser**
   Navigate to `http://localhost:5000`

## How to Use

### Current Weather & Forecast
1. Enter a location (city name, ZIP code, or coordinates)
2. Click "Search" or "My Location"
3. View current weather and 5-day forecast
4. See location on map

### Historical Weather Data
1. Switch to "Historical Data" tab
2. Choose input method (place name or coordinates)
3. Select date range and data type (hourly/daily)
4. Click "Fetch Historical Data"
5. Export data as CSV if needed

### Search History
1. Switch to "Search History" tab
2. View your recent searches
3. Click any item to re-run that search
4. Delete individual items or clear all history

## Database Schema
```sql
CREATE TABLE search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT NOT NULL,
    search_type TEXT NOT NULL,
    temperature REAL,
    date_range TEXT,
    granularity TEXT,
    coordinates TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Keys
The application uses free tier API keys included in `config.js`:
- OpenWeatherMap: For current weather and forecasts
- Mapbox: For location maps
- Open-Meteo: For historical weather data (no key required)

## Developer
Tirtha N.

## About PM Accelerator
Product Manager Accelerator is the world's first AI-powered product management learning platform.

© 2025 TSN