// Runs on a schedule via .github/workflows/update-weather.yml.
// Fetches every crag in crags.json in ONE batched Open-Meteo call and
// writes weather-cache.json, which the site reads instead of calling
// Open-Meteo itself. Locations a visitor adds locally (via "+ 場所を編集")
// aren't in crags.json, so they're never in this cache and the page
// still fetches those live.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const crags = JSON.parse(readFileSync(root + "crags.json", "utf8"));

const lats = crags.map((c) => c.lat).join(",");
const lons = crags.map((c) => c.lon).join(",");
const url =
  "https://api.open-meteo.com/v1/forecast?latitude=" + lats +
  "&longitude=" + lons +
  "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,windspeed_10m_max" +
  "&timezone=Asia%2FTokyo&forecast_days=16";

const res = await fetch(url);
if (!res.ok) throw new Error("Open-Meteo request failed: HTTP " + res.status);
const json = await res.json();
const results = Array.isArray(json) ? json : [json];

const byId = {};
crags.forEach((c, i) => {
  byId[c.id] = results[i];
});

const out = {
  generatedAt: new Date().toISOString(),
  byId,
};

writeFileSync(root + "weather-cache.json", JSON.stringify(out));
console.log("Wrote weather-cache.json for " + crags.length + " crags at " + out.generatedAt);
