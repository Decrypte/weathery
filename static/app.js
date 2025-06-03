const locationInput = document.getElementById('locationInput');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const weatherData = document.getElementById('weatherData');
const forecastSection = document.getElementById('forecastSection');

let historicalData = null;
let currentHistoricalParams = null;

locationInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        searchWeather();
    }
});

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    if (tab === 'forecast') {
        document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
        document.getElementById('forecastTab').classList.add('active');
    } else if (tab === 'historical') {
        document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
        document.getElementById('historicalTab').classList.add('active');
    } else if (tab === 'history') {
        document.querySelector('.tab-btn:nth-child(3)').classList.add('active');
        document.getElementById('historyTab').classList.add('active');
        loadSearchHistory();
    }
}

function toggleInputMode() {
    const mode = document.querySelector('input[name="inputMode"]:checked').value;
    document.getElementById('placeInput').classList.toggle('hidden', mode !== 'place');
    document.getElementById('coordsInput').classList.toggle('hidden', mode !== 'coords');
}

async function searchWeather() {
    const query = locationInput.value.trim();
    if (!query) {
        showError('Please enter a location to search for weather');
        return;
    }

    if (CONFIG.API_KEY === 'YOUR_API_KEY_HERE') {
        showError('Please add your OpenWeatherMap API key to the configuration');
        return;
    }

    showLoading(true);
    hideError();

    try {
        const coords = await getCoordinates(query);
        console.log('Coordinates found:', coords);

        const [currentWeather, forecast] = await Promise.all([
            getCurrentWeather(coords.lat, coords.lon),
            getForecast(coords.lat, coords.lon)
        ]);

        displayWeather(currentWeather);
        displayForecast(forecast);
        displayLocationMap(coords.lat, coords.lon, currentWeather.name, currentWeather.sys?.country);

        saveToHistory({
            location: `${currentWeather.name}, ${currentWeather.sys?.country || ''}`,
            search_type: 'forecast',
            temperature: currentWeather.main.temp,
            coordinates: { lat: coords.lat, lon: coords.lon }
        });

    } catch (err) {
        console.error('Search error:', err);
        showError(err.message);
    } finally {
        showLoading(false);
    }
}

async function getCurrentLocation() {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser');
        return;
    }

    showLoading(true);
    hideError();

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            try {
                const { latitude, longitude } = position.coords;

                const [currentWeather, forecast] = await Promise.all([
                    getCurrentWeather(latitude, longitude),
                    getForecast(latitude, longitude)
                ]);

                displayWeather(currentWeather);
                displayForecast(forecast);
                displayLocationMap(latitude, longitude, currentWeather.name, currentWeather.sys?.country);

                saveToHistory({
                    location: `${currentWeather.name}, ${currentWeather.sys?.country || ''}`,
                    search_type: 'forecast',
                    temperature: currentWeather.main.temp,
                    coordinates: { lat: latitude, lon: longitude }
                });

            } catch (err) {
                console.error('Location weather error:', err);
                showError(err.message);
            } finally {
                showLoading(false);
            }
        },
        (err) => {
            showLoading(false);
            let errorMessage = 'Unable to get your location. ';
            switch (err.code) {
                case err.PERMISSION_DENIED:
                    errorMessage += 'Please allow location access and try again.';
                    break;
                case err.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information is unavailable.';
                    break;
                case err.TIMEOUT:
                    errorMessage += 'Location request timed out.';
                    break;
                default:
                    errorMessage += 'Please enter location manually.';
                    break;
            }
            showError(errorMessage);
        }
    );
}

async function getCoordinates(query) {
    const coordRegex = /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/;
    if (coordRegex.test(query)) {
        const [lat, lon] = query.split(',').map(num => parseFloat(num.trim()));
        if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
            return { lat, lon };
        }
    }

    let enhancedQuery = query;

    if (/^\d{5}(-\d{4})?$/.test(query)) {
        enhancedQuery = `${query},US`;
    }
    else if (/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(query)) {
        enhancedQuery = `${query},UK`;
    }
    else if (/^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(query)) {
        enhancedQuery = `${query},CA`;
    }

    console.log('Enhanced query:', enhancedQuery);

    const geocodingUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(enhancedQuery)}&limit=5&appid=${CONFIG.API_KEY}`;

    try {
        console.log('Trying direct geocoding call...');
        const response = await fetch(geocodingUrl);

        if (response.ok) {
            const data = await response.json();
            console.log('Geocoding response:', data);

            if (data && data.length > 0) {
                const result = data[0];
                console.log('Selected location:', result);
                return {
                    lat: result.lat,
                    lon: result.lon,
                    name: result.name,
                    country: result.country,
                    state: result.state
                };
            }
        }
    } catch (error) {
        console.log('Direct geocoding failed:', error.message);
    }

    for (let i = 0; i < CONFIG.CORS_PROXIES.length; i++) {
        try {
            console.log(`Trying geocoding proxy ${i + 1}:`, CONFIG.CORS_PROXIES[i]);
            const proxyUrl = CONFIG.CORS_PROXIES[i] + encodeURIComponent(geocodingUrl);
            const response = await fetch(proxyUrl);

            if (response.ok) {
                const data = await response.json();
                if (data && data.length > 0) {
                    console.log('Proxy geocoding successful:', data[0]);
                    const result = data[0];
                    return {
                        lat: result.lat,
                        lon: result.lon,
                        name: result.name,
                        country: result.country,
                        state: result.state
                    };
                }
            }
        } catch (error) {
            console.log(`Geocoding proxy ${i + 1} failed:`, error.message);
            continue;
        }
    }

    throw new Error(`Location "${query}" not found. Please try:\n• Full city name with country (e.g., "New York, US")\n• Coordinates (e.g., "40.7128,-74.0060")\n• ZIP code with country (e.g., "10001,US")`);
}

async function getCurrentWeather(lat, lon) {
    const weatherUrl = `${CONFIG.BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${CONFIG.API_KEY}&units=metric`;

    try {
        console.log('Trying direct weather call...');
        const response = await fetch(weatherUrl);

        if (response.ok) {
            const data = await response.json();
            console.log('Weather data received:', data);

            if (data && data.main && data.main.temp !== undefined) {
                return data;
            } else {
                throw new Error('Invalid weather data structure');
            }
        }
    } catch (error) {
        console.log('Direct weather call failed:', error.message);
    }

    for (let i = 0; i < CONFIG.CORS_PROXIES.length; i++) {
        try {
            console.log(`Trying weather proxy ${i + 1}:`, CONFIG.CORS_PROXIES[i]);
            const proxyUrl = CONFIG.CORS_PROXIES[i] + encodeURIComponent(weatherUrl);
            const response = await fetch(proxyUrl);

            if (response.ok) {
                const data = await response.json();
                console.log('Weather proxy data received:', data);

                if (data && data.main && data.main.temp !== undefined) {
                    return data;
                }
            }
        } catch (error) {
            console.log(`Weather proxy ${i + 1} failed:`, error.message);
            continue;
        }
    }

    throw new Error('Unable to get weather data. Please check your connection and try again.');
}

async function getForecast(lat, lon) {
    const forecastUrl = `${CONFIG.BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${CONFIG.API_KEY}&units=metric`;

    try {
        console.log('Trying direct forecast call...');
        const response = await fetch(forecastUrl);

        if (response.ok) {
            const data = await response.json();
            console.log('Forecast data received:', data);

            if (data && data.list && Array.isArray(data.list)) {
                return data;
            } else {
                throw new Error('Invalid forecast data structure');
            }
        }
    } catch (error) {
        console.log('Direct forecast call failed:', error.message);
    }

    for (let i = 0; i < CONFIG.CORS_PROXIES.length; i++) {
        try {
            console.log(`Trying forecast proxy ${i + 1}:`, CONFIG.CORS_PROXIES[i]);
            const proxyUrl = CONFIG.CORS_PROXIES[i] + encodeURIComponent(forecastUrl);
            const response = await fetch(proxyUrl);

            if (response.ok) {
                const data = await response.json();
                console.log('Forecast proxy data received:', data);

                if (data && data.list && Array.isArray(data.list)) {
                    return data;
                }
            }
        } catch (error) {
            console.log(`Forecast proxy ${i + 1} failed:`, error.message);
            continue;
        }
    }

    throw new Error('Unable to get forecast data. Please check your connection and try again.');
}

function displayWeather(data) {
    try {
        if (!data || !data.main || data.main.temp === undefined) {
            throw new Error('Invalid weather data structure');
        }

        document.getElementById('temperature').textContent = `${Math.round(data.main.temp)}°C`;
        document.getElementById('description').textContent = data.weather?.[0]?.description || 'Weather data unavailable';
        document.getElementById('location').textContent = `${data.name || 'Unknown'}, ${data.sys?.country || ''}`;
        document.getElementById('feelsLike').textContent = `${Math.round(data.main.feels_like || data.main.temp)}°C`;
        document.getElementById('humidity').textContent = `${data.main.humidity || 0}%`;
        document.getElementById('windSpeed').textContent = `${Math.round((data.wind?.speed || 0) * 3.6)} km/h`;
        document.getElementById('pressure').textContent = `${data.main.pressure || 0} hPa`;

        const iconCode = data.weather?.[0]?.icon || '01d';
        const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
        document.getElementById('weatherIcon').src = iconUrl;
        document.getElementById('weatherIcon').alt = data.weather?.[0]?.description || 'Weather icon';

        weatherData.classList.remove('hidden');
    } catch (error) {
        console.error('Error displaying weather:', error);
        showError('Error displaying weather data: ' + error.message);
    }
}

function displayForecast(data) {
    try {
        const forecastContainer = document.getElementById('forecastContainer');
        forecastContainer.innerHTML = '';

        if (!data || !data.list || !Array.isArray(data.list)) {
            throw new Error('Invalid forecast data structure');
        }

        const dailyForecasts = [];
        const processedDays = new Set();

        data.list.forEach(forecast => {
            const date = new Date(forecast.dt * 1000);
            const dateString = date.toDateString();
            const hour = date.getHours();

            if (!processedDays.has(dateString) || hour === 12) {
                if (!processedDays.has(dateString) || hour === 12) {
                    if (hour === 12) {
                        const existingIndex = dailyForecasts.findIndex(f =>
                            new Date(f.dt * 1000).toDateString() === dateString
                        );
                        if (existingIndex !== -1) {
                            dailyForecasts[existingIndex] = forecast;
                        } else {
                            dailyForecasts.push(forecast);
                        }
                    } else {
                        dailyForecasts.push(forecast);
                    }
                    processedDays.add(dateString);
                }
            }
        });

        const limitedForecasts = dailyForecasts.slice(0, 5);

        if (limitedForecasts.length === 0) {
            throw new Error('No forecast data available');
        }

        limitedForecasts.forEach(forecast => {
            const date = new Date(forecast.dt * 1000);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            const forecastItem = document.createElement('div');
            forecastItem.className = 'forecast-item';

            const iconCode = forecast.weather?.[0]?.icon || '01d';
            const temp = Math.round(forecast.main?.temp || 0);
            const tempMax = Math.round(forecast.main?.temp_max || forecast.main?.temp || 0);
            const tempMin = Math.round(forecast.main?.temp_min || forecast.main?.temp || 0);
            const description = forecast.weather?.[0]?.description || '';

            forecastItem.innerHTML = `
                <div class="forecast-day">${dayName}</div>
                <div style="font-size: 0.8rem; color: #666; margin-bottom: 8px;">${monthDay}</div>
                <img class="forecast-icon" src="https://openweathermap.org/img/wn/${iconCode}@2x.png" alt="${description}">
                <div style="font-size: 0.8rem; margin-bottom: 8px; text-transform: capitalize;">${description}</div>
                <div class="forecast-temps">
                    <span class="temp-high">${tempMax}°</span>
                    <span class="temp-low">${tempMin}°</span>
                </div>
            `;
            forecastContainer.appendChild(forecastItem);
        });

        forecastSection.classList.remove('hidden');
    } catch (error) {
        console.error('Error displaying forecast:', error);
        showError('Error displaying forecast data: ' + error.message);
    }
}

async function fetchHistoricalData() {
    const mode = document.querySelector('input[name="inputMode"]:checked').value;
    let latitude, longitude, place;

    if (mode === 'place') {
        place = document.getElementById('historicalPlace').value.trim();
        if (!place) {
            showHistoricalError('Please enter a place name');
            return;
        }

        try {
            const coords = await getCoordinatesFromPlace(place);
            latitude = coords.lat;
            longitude = coords.lon;
        } catch (err) {
            showHistoricalError(err.message);
            return;
        }
    } else {
        latitude = parseFloat(document.getElementById('latitude').value);
        longitude = parseFloat(document.getElementById('longitude').value);

        if (isNaN(latitude) || isNaN(longitude)) {
            showHistoricalError('Please enter valid coordinates');
            return;
        }

        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            showHistoricalError('Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180');
            return;
        }
    }

    const startDate = document.getElementById('startDate').value;
    const numDays = parseInt(document.getElementById('numDays').value);
    const granularity = document.getElementById('granularity').value;

    if (!startDate) {
        showHistoricalError('Please select a start date');
        return;
    }

    if (numDays < 1 || numDays > 10) {
        showHistoricalError('Number of days must be between 1 and 10');
        return;
    }

    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + numDays - 1);

    const today = new Date();
    if (start > today || end > today) {
        showHistoricalError('Cannot fetch weather data for future dates');
        return;
    }

    showHistoricalLoading(true);
    hideHistoricalError();

    try {
        const data = await getHistoricalWeather(latitude, longitude, startDate, end.toISOString().split('T')[0], granularity);

        currentHistoricalParams = {
            latitude,
            longitude,
            startDate,
            endDate: end.toISOString().split('T')[0],
            granularity,
            place: place || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        };

        displayHistoricalData(data, granularity);

        saveToHistory({
            location: currentHistoricalParams.place,
            search_type: 'historical',
            date_range: `${currentHistoricalParams.startDate} to ${currentHistoricalParams.endDate}`,
            granularity: granularity
        });
    } catch (err) {
        console.error('Historical data error:', err);
        showHistoricalError(err.message);
    } finally {
        showHistoricalLoading(false);
    }
}

async function getCoordinatesFromPlace(placeName) {
    console.log(`Geocoding place: ${placeName}...`);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`;

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Weathery/1.0' }
        });

        if (!response.ok) {
            throw new Error('Geocoding service unavailable');
        }

        const data = await response.json();

        if (!data || data.length === 0) {
            throw new Error('No location found for the given place name');
        }

        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        console.log(`Found: Latitude = ${lat}, Longitude = ${lon}`);

        return { lat, lon };
    } catch (error) {
        throw new Error('Unable to find location. Please try coordinates instead.');
    }
}

async function getHistoricalWeather(latitude, longitude, startDate, endDate, granularity) {
    const baseUrl = 'https://archive-api.open-meteo.com/v1/archive';

    let variables;
    if (granularity === 'hourly') {
        variables = [
            'temperature_2m',
            'relative_humidity_2m',
            'precipitation',
            'wind_speed_10m',
            'wind_direction_10m',
            'pressure_msl',
            'cloudcover',
            'weather_code'
        ];
    } else {
        variables = [
            'temperature_2m_max',
            'temperature_2m_min',
            'precipitation_sum',
            'windspeed_10m_max',
            'windgusts_10m_max',
            'weathercode'
        ];
    }

    const params = new URLSearchParams({
        latitude: latitude,
        longitude: longitude,
        start_date: startDate,
        end_date: endDate,
        [granularity]: variables.join(','),
        timezone: 'auto'
    });

    console.log(`Fetching ${granularity} weather data for (${latitude}, ${longitude}) from ${startDate} to ${endDate}...`);

    const response = await fetch(`${baseUrl}?${params}`, {
        headers: { 'User-Agent': 'Weathery/1.0' }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch historical weather data');
    }

    const data = await response.json();

    if (!data || !data[granularity]) {
        throw new Error('Invalid response format from weather service');
    }

    console.log(`Weather data fetched successfully (${data[granularity].time.length} ${granularity} records)`);

    historicalData = data;
    return data;
}

function displayHistoricalData(data, granularity) {
    const results = document.getElementById('historicalResults');
    const summary = document.getElementById('historicalSummary');
    const tableContainer = document.getElementById('historicalTable');

    const content = data[granularity];

    let summaryHTML = `
        <p><strong>Location:</strong> ${currentHistoricalParams.place}</p>
        <p><strong>Period:</strong> ${currentHistoricalParams.startDate} to ${currentHistoricalParams.endDate}</p>
        <p><strong>Data Type:</strong> ${granularity.charAt(0).toUpperCase() + granularity.slice(1)}</p>
        <p><strong>Total Records:</strong> ${content.time.length}</p>
    `;

    if (granularity === 'daily') {
        const temps = content.temperature_2m_max || [];
        const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
        const maxTemp = Math.max(...temps);
        const minTemp = Math.min(...(content.temperature_2m_min || []));
        const totalPrecip = (content.precipitation_sum || []).reduce((a, b) => a + b, 0);

        summaryHTML += `
            <p><strong>Average High:</strong> ${avgTemp.toFixed(1)}°C</p>
            <p><strong>Highest Temp:</strong> ${maxTemp.toFixed(1)}°C</p>
            <p><strong>Lowest Temp:</strong> ${minTemp.toFixed(1)}°C</p>
            <p><strong>Total Precipitation:</strong> ${totalPrecip.toFixed(1)} mm</p>
        `;
    }

    summary.innerHTML = summaryHTML;

    let tableHTML = '<table class="data-table"><thead><tr>';

    if (granularity === 'hourly') {
        tableHTML += `
            <th>Date & Time</th>
            <th>Temperature (°C)</th>
            <th>Humidity (%)</th>
            <th>Precipitation (mm)</th>
            <th>Wind Speed (m/s)</th>
            <th>Pressure (hPa)</th>
        `;
    } else {
        tableHTML += `
            <th>Date</th>
            <th>Max Temp (°C)</th>
            <th>Min Temp (°C)</th>
            <th>Precipitation (mm)</th>
            <th>Max Wind (m/s)</th>
            <th>Weather Code</th>
        `;
    }

    tableHTML += '</tr></thead><tbody>';

    const maxRows = Math.min(content.time.length, 100);

    for (let i = 0; i < maxRows; i++) {
        tableHTML += '<tr>';

        if (granularity === 'hourly') {
            tableHTML += `
                <td>${new Date(content.time[i]).toLocaleString()}</td>
                <td>${content.temperature_2m?.[i]?.toFixed(1) || 'N/A'}</td>
                <td>${content.relative_humidity_2m?.[i] || 'N/A'}</td>
                <td>${content.precipitation?.[i]?.toFixed(1) || '0.0'}</td>
                <td>${content.wind_speed_10m?.[i]?.toFixed(1) || 'N/A'}</td>
                <td>${content.pressure_msl?.[i]?.toFixed(0) || 'N/A'}</td>
            `;
        } else {
            tableHTML += `
                <td>${new Date(content.time[i]).toLocaleDateString()}</td>
                <td>${content.temperature_2m_max?.[i]?.toFixed(1) || 'N/A'}</td>
                <td>${content.temperature_2m_min?.[i]?.toFixed(1) || 'N/A'}</td>
                <td>${content.precipitation_sum?.[i]?.toFixed(1) || '0.0'}</td>
                <td>${content.windspeed_10m_max?.[i]?.toFixed(1) || 'N/A'}</td>
                <td>${content.weathercode?.[i] || 'N/A'}</td>
            `;
        }

        tableHTML += '</tr>';
    }

    if (content.time.length > maxRows) {
        tableHTML += `<tr><td colspan="6" style="text-align: center; font-style: italic;">Showing first ${maxRows} of ${content.time.length} records. Export to CSV to see all data.</td></tr>`;
    }

    tableHTML += '</tbody></table>';

    tableContainer.innerHTML = tableHTML;
    results.classList.remove('hidden');
}

function exportToCSV() {
    if (!historicalData || !currentHistoricalParams) {
        showHistoricalError('No data to export');
        return;
    }

    const granularity = currentHistoricalParams.granularity;
    const content = historicalData[granularity];

    let csv = '';

    if (granularity === 'hourly') {
        csv = 'Date & Time,Temperature (°C),Humidity (%),Precipitation (mm),Wind Speed (m/s),Wind Direction (°),Pressure (hPa),Cloud Cover (%),Weather Code\n';

        for (let i = 0; i < content.time.length; i++) {
            csv += `"${new Date(content.time[i]).toLocaleString()}",`;
            csv += `${content.temperature_2m?.[i] || ''},`;
            csv += `${content.relative_humidity_2m?.[i] || ''},`;
            csv += `${content.precipitation?.[i] || '0'},`;
            csv += `${content.wind_speed_10m?.[i] || ''},`;
            csv += `${content.wind_direction_10m?.[i] || ''},`;
            csv += `${content.pressure_msl?.[i] || ''},`;
            csv += `${content.cloudcover?.[i] || ''},`;
            csv += `${content.weather_code?.[i] || ''}\n`;
        }
    } else {
        csv = 'Date,Max Temperature (°C),Min Temperature (°C),Precipitation (mm),Max Wind Speed (m/s),Max Wind Gusts (m/s),Weather Code\n';

        for (let i = 0; i < content.time.length; i++) {
            csv += `"${new Date(content.time[i]).toLocaleDateString()}",`;
            csv += `${content.temperature_2m_max?.[i] || ''},`;
            csv += `${content.temperature_2m_min?.[i] || ''},`;
            csv += `${content.precipitation_sum?.[i] || '0'},`;
            csv += `${content.windspeed_10m_max?.[i] || ''},`;
            csv += `${content.windgusts_10m_max?.[i] || ''},`;
            csv += `${content.weathercode?.[i] || ''}\n`;
        }
    }

    const place = currentHistoricalParams.place.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const startDate = currentHistoricalParams.startDate.replace(/-/g, '');
    const endDate = currentHistoricalParams.endDate.replace(/-/g, '');
    const filename = `${place}_${startDate}_${endDate}_${granularity}.csv`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    console.log(`Data exported to ${filename}`);
}

function showLoading(show) {
    loading.classList.toggle('hidden', !show);
}

function showError(message) {
    error.textContent = message;
    error.classList.remove('hidden');
}

function hideError() {
    error.classList.add('hidden');
}

function showHistoricalLoading(show) {
    document.getElementById('historicalLoading').classList.toggle('hidden', !show);
}

function showHistoricalError(message) {
    const errorEl = document.getElementById('historicalError');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
}

function hideHistoricalError() {
    document.getElementById('historicalError').classList.add('hidden');
}

function showInfo() {
    document.getElementById('infoModal').classList.remove('hidden');
}

function closeInfo() {
    document.getElementById('infoModal').classList.add('hidden');
}

function displayLocationMap(lat, lon, cityName, country) {
    const mapSection = document.getElementById('mapSection');
    const locationMap = document.getElementById('locationMap');
    const mapLocationText = document.getElementById('mapLocation');

    if (CONFIG.MAPBOX_API_KEY && CONFIG.MAPBOX_API_KEY !== 'YOUR_MAPBOX_API_KEY_HERE') {
        const zoom = 11;
        const width = 600;
        const height = 300;
        const marker = `pin-l-marker+ef4444(${lon},${lat})`;

        const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/${marker}/${lon},${lat},${zoom},0/${width}x${height}@2x?access_token=${CONFIG.MAPBOX_API_KEY}`;

        locationMap.src = mapUrl;
        locationMap.alt = `Map of ${cityName}`;

        const locationText = country ? `${cityName}, ${country}` : cityName;
        mapLocationText.textContent = `📍 ${locationText} (${lat.toFixed(4)}, ${lon.toFixed(4)})`;

        mapSection.classList.remove('hidden');
    } else {
        mapSection.classList.add('hidden');
    }
}

window.onclick = function (event) {
    const modal = document.getElementById('infoModal');
    if (event.target == modal) {
        modal.classList.add('hidden');
    }
}

const today = new Date();
const maxDate = today.toISOString().split('T')[0];
document.getElementById('startDate').setAttribute('max', maxDate);

const defaultStartDate = new Date();
defaultStartDate.setDate(defaultStartDate.getDate() - 7);
document.getElementById('startDate').value = defaultStartDate.toISOString().split('T')[0];

console.log('🌤️ Weathery App Ready!');
console.log('Features: Current weather, 5-day forecast, and historical weather data with CSV export');

async function saveToHistory(searchData) {
    try {
        const response = await fetch('/api/history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(searchData)
        });

        if (!response.ok) {
            console.error('Failed to save to history');
        }
    } catch (error) {
        console.error('Error saving to history:', error);
    }
}

async function loadSearchHistory() {
    const historyList = document.getElementById('historyList');
    const historyLoading = document.getElementById('historyLoading');
    const historyError = document.getElementById('historyError');

    historyLoading.classList.remove('hidden');
    historyError.classList.add('hidden');

    try {
        const response = await fetch('/api/history');

        if (!response.ok) {
            throw new Error('Failed to load history');
        }

        const history = await response.json();

        if (history.length === 0) {
            historyList.innerHTML = '<div class="empty-history">No search history yet. Start searching to build your history!</div>';
        } else {
            historyList.innerHTML = history.map(item => `
                <div class="history-item" onclick='rerunSearch(${JSON.stringify(item).replace(/'/g, "&apos;")})'>
                    <div class="history-info">
                        <div class="history-location">${item.location}</div>
                        <div class="history-details">
                            <span class="history-type">${item.search_type === 'forecast' ? '🌤️ Forecast' : '📊 Historical'}</span>
                            ${item.temperature ? `<span>${Math.round(item.temperature)}°C</span>` : ''}
                            ${item.date_range ? `<span>${item.date_range}</span>` : ''}
                            <span>${new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="history-actions">
                        <button class="history-delete" onclick="deleteHistoryItem(event, ${item.id})">Delete</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading history:', error);
        historyError.textContent = 'Failed to load search history';
        historyError.classList.remove('hidden');
        historyList.innerHTML = '';
    } finally {
        historyLoading.classList.add('hidden');
    }
}

function rerunSearch(item) {
    if (item.search_type === 'forecast') {
        switchTab('forecast');
        if (item.coordinates) {
            getCurrentWeatherByCoords(item.coordinates.lat, item.coordinates.lon);
        } else {
            document.getElementById('locationInput').value = item.location;
            searchWeather();
        }
    } else {
        switchTab('historical');
    }
}

async function getCurrentWeatherByCoords(lat, lon) {
    showLoading(true);
    hideError();

    try {
        const [currentWeather, forecast] = await Promise.all([
            getCurrentWeather(lat, lon),
            getForecast(lat, lon)
        ]);

        displayWeather(currentWeather);
        displayForecast(forecast);
        displayLocationMap(lat, lon, currentWeather.name, currentWeather.sys?.country);
    } catch (err) {
        console.error('Weather error:', err);
        showError(err.message);
    } finally {
        showLoading(false);
    }
}

async function deleteHistoryItem(event, id) {
    event.stopPropagation();

    try {
        const response = await fetch(`/api/history/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadSearchHistory();
        } else {
            console.error('Failed to delete history item');
        }
    } catch (error) {
        console.error('Error deleting history:', error);
    }
}

async function clearHistory() {
    if (confirm('Are you sure you want to clear all search history?')) {
        try {
            const response = await fetch('/api/history', {
                method: 'DELETE'
            });

            if (response.ok) {
                loadSearchHistory();
            } else {
                console.error('Failed to clear history');
            }
        } catch (error) {
            console.error('Error clearing history:', error);
        }
    }
}