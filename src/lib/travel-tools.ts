const AMAP_KEY = process.env.AMAP_KEY || "";

const weatherCache = new Map<string, { data: string; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export const TRAVEL_TOOLS: any[] = AMAP_KEY
  ? [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "查询指定城市未来几天的天气预报，包括温度、天气状况、风力等。支持国内外主要城市。",
          parameters: {
            type: "object",
            properties: {
              city: { type: "string", description: "城市名称，如'东京'、'曼谷'、'巴黎'" },
            },
            required: ["city"],
          },
        },
      },
    ]
  : [];

export async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  if (name === "get_weather") return getWeather(args.city);
  throw new Error(`Unknown tool: ${name}`);
}

async function getWeather(city: string): Promise<string> {
  const cached = weatherCache.get(city);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  try {
    // Resolve city to adcode
    const districtUrl = `https://restapi.amap.com/v3/config/district?keywords=${encodeURIComponent(city)}&key=${AMAP_KEY}&subdistrict=0`;
    const distRes = await fetch(districtUrl);
    const distData: any = await distRes.json();
    const adcode = distData.districts?.[0]?.adcode;
    if (!adcode) return JSON.stringify({ error: `未找到城市: ${city}` });

    // Get weather
    const weatherUrl = `https://restapi.amap.com/v3/weather/weatherInfo?city=${adcode}&key=${AMAP_KEY}&extensions=all`;
    const weatherRes = await fetch(weatherUrl);
    const weatherData: any = await weatherRes.json();

    const forecasts = weatherData.forecasts?.[0]?.casts || [];
    const result = {
      city,
      province: weatherData.forecasts?.[0]?.province || "",
      forecasts: forecasts.map((f: any) => ({
        date: f.date,
        dayweather: f.dayweather,
        nightweather: f.nightweather,
        daytemp: f.daytemp,
        nighttemp: f.nighttemp,
        daywind: f.daywind,
        nightwind: f.nightwind,
        daypower: f.daypower,
        nightpower: f.nightpower,
      })),
    };

    const dataStr = JSON.stringify(result);
    weatherCache.set(city, { data: dataStr, ts: Date.now() });
    return dataStr;
  } catch (err: any) {
    return JSON.stringify({ error: `天气查询失败: ${err.message}` });
  }
}
