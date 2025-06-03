// Weather App Configuration
const CONFIG = {
    API_KEY: 'ec99804f2bbb7798e335613b25df0d27', // Replace with your actual OpenWeatherMap API key
    BASE_URL: 'https://api.openweathermap.org/data/2.5',

    // Mapbox API key for location maps
    MAPBOX_API_KEY: 'pk.eyJ1IjoiMWJ5dGUiLCJhIjoiY2xmemk0amYzMGYxODNvbXQ1dm1kNDhldiJ9.RcfNvWx-fmn4UiGbkvokRw',

    // Alternative CORS proxies for better reliability
    CORS_PROXIES: [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/'
    ]
};

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}