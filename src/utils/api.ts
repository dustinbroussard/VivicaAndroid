export function getPrimaryApiKey(): string {
  const direct = localStorage.getItem('openrouter-api-key');
  if (direct) return direct;
  try {
    const settings = JSON.parse(localStorage.getItem('vivica-settings') || '{}');
    return settings.apiKey1 || settings.apiKey2 || settings.apiKey3 || '';
  } catch {
    return '';
  }
}
