// Runs on a schedule via .github/workflows/update-weather.yml.
// Fetches every crag in crags.json from Open-Meteo (in batches of locations)
// and writes weather-cache.json, which the site reads instead of calling
// Open-Meteo itself. Locations a visitor adds locally (via "+ 場所を編集")
// aren't in crags.json, so they're never in this cache and the page
// still fetches those live.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const crags = JSON.parse(readFileSync(root + "crags.json", "utf8"));
const BATCH = 40;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBatch(list) {
  const lats = list.map((c) => c.lat).join(",");
  const lons = list.map((c) => c.lon).join(",");
  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=" + lats +
    "&longitude=" + lons +
    "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,windspeed_10m_max" +
    "&timezone=Asia%2FTokyo&forecast_days=16";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json) ? json : [json];
    }
    if (attempt === 3) throw new Error("Open-Meteo request failed: HTTP " + res.status);
    await sleep(5000 * attempt);
  }
}

const byId = {};
for (let i = 0; i < crags.length; i += BATCH) {
  const list = crags.slice(i, i + BATCH);
  const results = await fetchBatch(list);
  list.forEach((c, j) => {
    byId[c.id] = results[j];
  });
  if (i + BATCH < crags.length) await sleep(1500);
}

const out = {
  generatedAt: new Date().toISOString(),
  byId,
};

writeFileSync(root + "weather-cache.json", JSON.stringify(out));
console.log("Wrote weather-cache.json for " + crags.length + " crags at " + out.generatedAt);