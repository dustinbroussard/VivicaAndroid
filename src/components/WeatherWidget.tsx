import { useEffect, useState } from 'react';
import { Storage } from '@/utils/storage';

// Open-Meteo weather codes to human descriptions
function weatherCodeToText(code: number): string {
  const map: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Dense drizzle",
    56: "Freezing drizzle",
    57: "Freezing dense drizzle",
    61: "Slight rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight showers",
    81: "Showers",
    82: "Violent showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Violent thunderstorm"
  };
  return map[code] || "Unknown";
}

async function fetchWeatherOpenMeteo(lat: number, lon: number): Promise<string> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=fahrenheit`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    const current = data.current_weather;
    const temp = Math.round(current.temperature) + "°F";
    const condText = weatherCodeToText(current.weathercode);
    return `${condText}, ${temp}`;
  } catch (err) {
    return "Weather unavailable.";
  }
}

export const WeatherWidget = () => {
  const [weatherText, setWeatherText] = useState("Detecting weather…");

  useEffect(() => {
    const renderWeather = async () => {
      // Default/fallback: Welsh, LA
      const fallback = { lat: 30.2366, lon: -92.8204, name: "Welsh, LA" };

      // Try browser geolocation
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const weather = await fetchWeatherOpenMeteo(lat, lon);
            setWeatherText(`🌤️ Your location: ${weather}`);
          },
          async (err) => {
            // User denied, fallback
            const weather = await fetchWeatherOpenMeteo(fallback.lat, fallback.lon);
            setWeatherText(`🌤️ ${fallback.name}: ${weather}`);
          },
          { enableHighAccuracy: false, timeout: 4000, maximumAge: 180000 }
        );
      } else {
        // No geolocation, fallback
        const weather = await fetchWeatherOpenMeteo(fallback.lat, fallback.lon);
        setWeatherText(`🌤️ ${fallback.name}: ${weather}`);
      }
    };

    renderWeather();
  }, []);

  return (
    <div className="p-4 rounded-lg bg-card/50 border border-accent/20">
      <div className="text-sm text-muted-foreground">{weatherText}</div>
    </div>
  );
};
