/**
 * Open-Meteo entegrasyonu — proje konumuna göre hava durumu çekme.
 *
 * Ücretsiz, anahtar gerekmez. Türkiye için doğruluk yüksek.
 * Endpoint: https://api.open-meteo.com/v1/forecast
 *
 * Saha kullanım kuralları:
 *   - Yağmur > 5mm → iş durabilir
 *   - Rüzgar > 50 km/h → iş durabilir (yüksek çalışma yasak)
 *   - Fırtına / dolu → iş durur
 */

const API_BASE = "https://api.open-meteo.com/v1/forecast";

/**
 * WMO weather codes — https://open-meteo.com/en/docs
 * Türkçe etiket + Lucide icon adı.
 */
const WEATHER_CODES: Record<number, { label: string; severity: "clear" | "cloudy" | "rain" | "snow" | "storm" }> = {
  0: { label: "Güneşli", severity: "clear" },
  1: { label: "Genelde Açık", severity: "clear" },
  2: { label: "Parçalı Bulutlu", severity: "cloudy" },
  3: { label: "Kapalı / Bulutlu", severity: "cloudy" },
  45: { label: "Sisli", severity: "cloudy" },
  48: { label: "Yoğun Sis", severity: "cloudy" },
  51: { label: "Hafif Çisenti", severity: "rain" },
  53: { label: "Çisenti", severity: "rain" },
  55: { label: "Yoğun Çisenti", severity: "rain" },
  56: { label: "Hafif Donan Çisenti", severity: "rain" },
  57: { label: "Donan Çisenti", severity: "rain" },
  61: { label: "Hafif Yağmur", severity: "rain" },
  63: { label: "Yağmurlu", severity: "rain" },
  65: { label: "Şiddetli Yağmur", severity: "rain" },
  66: { label: "Hafif Donan Yağmur", severity: "rain" },
  67: { label: "Donan Yağmur", severity: "rain" },
  71: { label: "Hafif Kar", severity: "snow" },
  73: { label: "Karlı", severity: "snow" },
  75: { label: "Yoğun Kar", severity: "snow" },
  77: { label: "Kar Taneleri", severity: "snow" },
  80: { label: "Hafif Sağanak", severity: "rain" },
  81: { label: "Sağanak", severity: "rain" },
  82: { label: "Şiddetli Sağanak", severity: "rain" },
  85: { label: "Hafif Kar Sağanağı", severity: "snow" },
  86: { label: "Kar Sağanağı", severity: "snow" },
  95: { label: "Fırtına", severity: "storm" },
  96: { label: "Doluyla Fırtına", severity: "storm" },
  99: { label: "Şiddetli Dolulu Fırtına", severity: "storm" },
};

export interface WeatherDay {
  date: string;             // ISO YYYY-MM-DD
  /** WMO weather code (0..99) */
  weatherCode: number;
  /** Türkçe açıklama */
  condition: string;
  /** Severity grubu */
  severity: "clear" | "cloudy" | "rain" | "snow" | "storm";
  /** Minimum sıcaklık (°C) */
  tempMin: number;
  /** Maksimum sıcaklık (°C) */
  tempMax: number;
  /** Günlük toplam yağış (mm) */
  precipitation: number;
  /** Maks rüzgar hızı (km/h) */
  windMax: number;
  /** Sahada iş durur mu? (yağmur > 5mm OR rüzgar > 50 OR fırtına/yoğun kar) */
  workStopped: boolean;
  /** İş durduysa Türkçe sebep — boş string ise yok */
  workStoppedReason: string;
}

/**
 * Proje konumu için hava durumu (geçmiş veya gelecek tek gün).
 * Open-Meteo otomatik olarak geçmiş için historical, gelecek için forecast döner.
 *
 * @param latitude  enlem (örn. Polatlı: 39.5867)
 * @param longitude boylam (örn. Polatlı: 32.1500)
 * @param date      ISO tarih YYYY-MM-DD
 */
export async function fetchWeatherDay(
  latitude: number,
  longitude: number,
  date: string
): Promise<WeatherDay> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "wind_speed_10m_max",
    ].join(","),
    timezone: "auto",
    start_date: date,
    end_date: date,
  });
  const url = `${API_BASE}?${params.toString()}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Open-Meteo isteği başarısız: ${resp.status}`);
  }
  const data = await resp.json() as {
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_sum?: number[];
      wind_speed_10m_max?: number[];
    };
  };
  if (!data.daily?.time?.length) {
    throw new Error("Open-Meteo: o gün için veri yok (tarih çok ileride olabilir)");
  }
  const wc = data.daily.weather_code?.[0] ?? 0;
  const tempMax = data.daily.temperature_2m_max?.[0] ?? 0;
  const tempMin = data.daily.temperature_2m_min?.[0] ?? 0;
  const precipitation = data.daily.precipitation_sum?.[0] ?? 0;
  const windMax = data.daily.wind_speed_10m_max?.[0] ?? 0;
  const meta = WEATHER_CODES[wc] ?? { label: "Bilinmeyen", severity: "cloudy" as const };

  // İş durdu kriterleri
  let workStopped = false;
  let workStoppedReason = "";
  if (precipitation > 5) {
    workStopped = true;
    workStoppedReason = `Yağış ${precipitation.toFixed(1)} mm — sınır 5mm`;
  } else if (windMax > 50) {
    workStopped = true;
    workStoppedReason = `Rüzgar ${windMax.toFixed(0)} km/h — sınır 50`;
  } else if (meta.severity === "storm") {
    workStopped = true;
    workStoppedReason = "Fırtına";
  } else if (meta.severity === "snow" && precipitation > 2) {
    workStopped = true;
    workStoppedReason = `${meta.label} (yağış ${precipitation.toFixed(1)} mm)`;
  }

  return {
    date,
    weatherCode: wc,
    condition: meta.label,
    severity: meta.severity,
    tempMin: Math.round(tempMin),
    tempMax: Math.round(tempMax),
    precipitation: Math.round(precipitation * 10) / 10,
    windMax: Math.round(windMax),
    workStopped,
    workStoppedReason,
  };
}

/**
 * Aynı (lat, lng, date) için tarayıcı session'ında cache.
 * Aynı sayfa içinde tekrar tekrar fetch'i önler.
 */
const cache = new Map<string, Promise<WeatherDay>>();

export function fetchWeatherDayCached(
  latitude: number,
  longitude: number,
  date: string
): Promise<WeatherDay> {
  const key = `${latitude},${longitude},${date}`;
  let p = cache.get(key);
  if (!p) {
    p = fetchWeatherDay(latitude, longitude, date);
    cache.set(key, p);
    p.catch(() => cache.delete(key)); // hatada cache'i temizle, yeniden denesin
  }
  return p;
}
