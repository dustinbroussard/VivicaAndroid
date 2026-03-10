import { useEffect, useState } from 'react';
import { resolveWeather } from '@/services/weatherService';

export const WeatherWidget = () => {
  const [weatherText, setWeatherText] = useState("Detecting weather…");
  const [locationHint, setLocationHint] = useState<string>('');

  useEffect(() => {
    const renderWeather = async () => {
      const result = await resolveWeather();
      setWeatherText(`🌤️ ${result.locationLabel}: ${result.weather}`);
      setLocationHint(result.hint || '');
    };

    renderWeather();
  }, []);

  return (
    <div className="p-4 rounded-lg bg-card/50 border border-accent/20">
      <div className="text-sm text-muted-foreground">{weatherText}</div>
      {locationHint && (
        <p className="mt-1 text-xs text-muted-foreground/90">
          {locationHint} Enable location access in browser/app settings for local weather.
        </p>
      )}
    </div>
  );
};
