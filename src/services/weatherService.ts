interface Coords {
  lat: number;
  lon: number;
  name: string;
}

interface WeatherResult {
  weather: string;
  locationLabel: string;
  usedFallback: boolean;
  hint?: string;
}

const DEFAULT_LOCATION: Coords = { lat: 30.2366, lon: -92.8204, name: 'Welsh, LA' };
const GEO_TIMEOUT_MS = 4000;

function weatherCodeToText(code: number): string {
  const map: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Dense drizzle',
    56: 'Freezing drizzle',
    57: 'Freezing dense drizzle',
    61: 'Slight rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight showers',
    81: 'Showers',
    82: 'Violent showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Violent thunderstorm',
  };

  return map[code] || 'Unknown';
}

async function fetchWeatherOpenMeteo(lat: number, lon: number): Promise<string> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=fahrenheit`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      return 'Weather unavailable.';
    }

    const data = await resp.json();
    const current = data.current_weather;
    if (!current || typeof current.temperature !== 'number' || typeof current.weathercode !== 'number') {
      return 'Weather unavailable.';
    }

    const temp = `${Math.round(current.temperature)}°F`;
    const condText = weatherCodeToText(current.weathercode);
    return `${condText}, ${temp}`;
  } catch {
    return 'Weather unavailable.';
  }
}

async function canAttemptGeolocation(): Promise<{ canUse: boolean; hint?: string }> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { canUse: false, hint: 'Location services unavailable on this device.' };
  }

  if (!window.isSecureContext) {
    return { canUse: false, hint: 'Location is unavailable in non-secure browser context.' };
  }

  if (!('geolocation' in navigator)) {
    return { canUse: false, hint: 'Location services are not supported in this browser.' };
  }

  if (!('permissions' in navigator)) {
    return { canUse: true };
  }

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    if (status.state === 'denied') {
      return { canUse: false, hint: 'Location access is blocked. Showing fallback weather.' };
    }
  } catch {
    // If permissions API is unavailable, still try geolocation directly.
  }

  return { canUse: true };
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: GEO_TIMEOUT_MS,
      maximumAge: 180000,
    });
  });
}

export async function resolveWeather(): Promise<WeatherResult> {
  const geoCheck = await canAttemptGeolocation();

  if (geoCheck.canUse) {
    try {
      const pos = await getCurrentPosition();
      const weather = await fetchWeatherOpenMeteo(pos.coords.latitude, pos.coords.longitude);
      return {
        weather,
        locationLabel: 'Your location',
        usedFallback: false,
      };
    } catch {
      const weather = await fetchWeatherOpenMeteo(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
      return {
        weather,
        locationLabel: DEFAULT_LOCATION.name,
        usedFallback: true,
        hint: 'Location unavailable right now. Showing fallback weather.',
      };
    }
  }

  const fallbackWeather = await fetchWeatherOpenMeteo(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
  return {
    weather: fallbackWeather,
    locationLabel: DEFAULT_LOCATION.name,
    usedFallback: true,
    hint: geoCheck.hint || 'Location unavailable. Showing fallback weather.',
  };
}

export async function getPromptWeatherText(): Promise<string> {
  const result = await resolveWeather();
  if (result.usedFallback) {
    return `${result.weather} (approximate location: ${result.locationLabel})`;
  }

  return result.weather;
}
