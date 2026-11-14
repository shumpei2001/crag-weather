window.CragShared = (function(){
  "use strict";

  var LOCAL_KEY = "crag-weather-custom-v1";
  var HIDE_KEY = "crag-weather-hidden-v1";
  var LANG_KEY = "crag-weather-lang";

  // Pages are served in two languages: Japanese at the site root, English under /en/.
  // The page's <html lang> picks the language; ROOT points back to the site root
  // so both languages read the same crags.json and weather-cache.json.
  var LANG = document.documentElement.lang === "en" ? "en" : "ja";
  var ROOT = window.CW_ROOT || "";

  var STR = {
    ja: {
      fav: "お気に入り", favOnly: "お気に入りのみ",
      favEmpty: "お気に入りが未登録です（★を押して追加）", noneShown: "表示中の地点がありません",
      loading: "読み込み中…", fetching: "取得中…", updated: "最終更新", fail: "取得に失敗しました",
      failWeather: "天気の取得に失敗しました", retry: "再試行", remove: "✕ 削除",
      hiddenN: "非表示 {0}件", showAll: "すべて表示",
      editOn: "＋ 場所を編集", editOff: "編集を終了",
      searching: "検索中…", notFound: "見つかりませんでした。別の表記で試してください。",
      searchFail: "検索に失敗しました。しばらくして再試行してください。", add: "追加",
      cragsFail: "crags.json の読み込みに失敗しました",
      count: "登録数", countUnit: "か所", refresh: "更新",
      allPref: "すべての地域", searchPh: "岩場を検索", more: "もっと見る", moreN: "もっと見る（残り{0}か所）",
      detail: "詳細を見る →", showMore: "その他の岩場も表示",
      today: "今日", tomorrow: "明日", sat: "土曜", sun: "日曜",
      best: "おすすめ順", rankHint: "降水確率が低い岩場から順に並べています。",
      sortGeo: "地域順", sortRain: "降水確率が低い順",
      wd: ["日","月","火","水","木","金","土"],
      popTitle: "降水確率", dateLabel: "日付", shown: "表示中 {0}か所"
    },
    en: {
      fav: "Favorite", favOnly: "Favorites only",
      favEmpty: "No favorites yet (tap ★ to add)", noneShown: "No crags to show",
      loading: "Loading…", fetching: "Loading…", updated: "Last updated", fail: "Could not load the weather",
      failWeather: "Could not load the weather", retry: "Retry", remove: "✕ Remove",
      hiddenN: "{0} hidden", showAll: "Show all",
      editOn: "+ Edit places", editOff: "Done editing",
      searching: "Searching…", notFound: "Not found. Try another spelling.",
      searchFail: "The search failed. Please try again in a moment.", add: "Add",
      cragsFail: "Could not load crags.json",
      count: "Crags", countUnit: "", refresh: "Refresh",
      allPref: "All areas", searchPh: "Search crags", more: "Show more", moreN: "Show more ({0} left)",
      detail: "Details →", showMore: "Show more crags",
      today: "Today", tomorrow: "Tomorrow", sat: "Sat", sun: "Sun",
      best: "Best first", rankHint: "Crags with the lowest chance of rain come first.",
      sortGeo: "By area", sortRain: "Lowest rain chance",
      wd: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
      popTitle: "Chance of rain", dateLabel: "Date", shown: "{0} crags shown"
    }
  };
  function t(key){
    var s = (STR[LANG] && STR[LANG][key] !== undefined) ? STR[LANG][key] : STR.ja[key];
    if(typeof s !== "string") return s;
    for(var i = 1; i < arguments.length; i++){ s = s.replace("{" + (i - 1) + "}", arguments[i]); }
    return s;
  }

  var WMO_JA = {
    0:["☀️","快晴"],1:["🌤️","晴れ"],2:["⛅","晴れ時々曇り"],3:["☁️","曇り"],
    45:["🌫️","霧"],48:["🌫️","霧氷"],
    51:["🌦️","霧雨"],53:["🌦️","霧雨"],55:["🌦️","強い霧雨"],
    56:["🌧️","着氷性霧雨"],57:["🌧️","着氷性霧雨"],
    61:["🌧️","小雨"],63:["🌧️","雨"],65:["🌧️","強い雨"],
    66:["🌧️","着氷性の雨"],67:["🌧️","着氷性の雨"],
    71:["🌨️","小雪"],73:["🌨️","雪"],75:["❄️","大雪"],77:["🌨️","霧雪"],
    80:["🌦️","にわか雨"],81:["🌦️","にわか雨"],82:["⛈️","激しいにわか雨"],
    85:["🌨️","にわか雪"],86:["🌨️","にわか雪"],
    95:["⛈️","雷雨"],96:["⛈️","雷雨(雹)"],99:["⛈️","雷雨(雹)"]
  };
  var WMO_EN = {
    0:["☀️","Clear"],1:["🌤️","Mostly clear"],2:["⛅","Partly cloudy"],3:["☁️","Cloudy"],
    45:["🌫️","Fog"],48:["🌫️","Rime fog"],
    51:["🌦️","Light drizzle"],53:["🌦️","Drizzle"],55:["🌦️","Heavy drizzle"],
    56:["🌧️","Freezing drizzle"],57:["🌧️","Freezing drizzle"],
    61:["🌧️","Light rain"],63:["🌧️","Rain"],65:["🌧️","Heavy rain"],
    66:["🌧️","Freezing rain"],67:["🌧️","Freezing rain"],
    71:["🌨️","Light snow"],73:["🌨️","Snow"],75:["❄️","Heavy snow"],77:["🌨️","Snow grains"],
    80:["🌦️","Showers"],81:["🌦️","Showers"],82:["⛈️","Heavy showers"],
    85:["🌨️","Snow showers"],86:["🌨️","Snow showers"],
    95:["⛈️","Thunderstorm"],96:["⛈️","Thunderstorm with hail"],99:["⛈️","Thunderstorm with hail"]
  };
  var WMO = LANG === "en" ? WMO_EN : WMO_JA;

  // Names shown to the visitor. Japanese pages use the Japanese fields; English
  // pages use the English ones and fall back to Japanese when there is none.
  function nm(loc){ return LANG === "en" ? (loc.nameEn || loc.name) : loc.name; }
  function rg(loc){
    if(LANG === "en") return loc.regionEn || loc.prefectureEn || "";
    return loc.region || "";
  }
  function esc(s){
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function loadJSON(key){
    try{
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }
  function saveJSON(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
  }
  function loadCustom(){ var v = loadJSON(LOCAL_KEY); return Array.isArray(v) ? v : []; }
  function saveCustom(list){ saveJSON(LOCAL_KEY, list); }
  function loadHidden(){ var v = loadJSON(HIDE_KEY); return Array.isArray(v) ? v : []; }
  function saveHidden(list){ saveJSON(HIDE_KEY, list); }

  function classify(pct){
    if(pct === null || pct === undefined) return "caution";
    if(pct <= 20) return "good";
    if(pct <= 50) return "caution";
    return "poor";
  }
  function fmtDate(iso){
    var d = new Date(iso + "T00:00:00");
    return (d.getMonth()+1) + "/" + d.getDate();
  }
  function fmtWeekday(iso){
    var d = new Date(iso + "T00:00:00");
    return STR[LANG].wd[d.getDay()];
  }
  function dowOf(iso){ return new Date(iso + "T00:00:00").getDay(); }
  function todayISO(){
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }
  function addDaysISO(iso, n){
    var d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + n);
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }
  // The next Saturday (or today if it is one), for the "weekend" shortcuts.
  function nextDowISO(dow){
    var d = new Date();
    var diff = (dow - d.getDay() + 7) % 7;
    return addDaysISO(todayISO(), diff);
  }

  function dayCellHtml(iso, code, hi, lo, pop){
    var w = WMO[code] || ["🌡️","-"];
    var cls = classify(pop);
    return (
      '<div class="day">' +
      '<span class="wd">' + fmtWeekday(iso) + '</span>' +
      '<span class="dt">' + fmtDate(iso) + '</span>' +
      '<span class="icon" title="' + w[1] + '">' + w[0] + '</span>' +
      '<span class="temps"><span class="hi">' + Math.round(hi) + '°</span>/<span class="lo">' + Math.round(lo) + '°</span></span>' +
      '<span class="pop ' + cls + '">' + (pop === null || pop === undefined ? "–" : pop + "%") + '</span>' +
      '</div>'
    );
  }

  // How good a given day looks at a crag: the chance of rain first, then the
  // amount of rain, then how far the daytime high is from a comfortable 18 degrees.
  // Lower is better. A missing forecast sorts last.
  function dayScore(data, idx){
    if(!data || !data.daily || idx < 0 || idx >= data.daily.time.length) return 1e9;
    var d = data.daily;
    var pop = d.precipitation_probability_max ? d.precipitation_probability_max[idx] : null;
    var rain = d.precipitation_sum ? d.precipitation_sum[idx] : 0;
    var hi = d.temperature_2m_max[idx];
    return (pop === null || pop === undefined ? 50 : pop) * 100 + Math.min(rain || 0, 50) * 10 + Math.abs(hi - 18);
  }

  function fetchForecastBatch(locs, days){
    days = days || 16;
    if(!locs.length) return Promise.resolve([]);
    var chunks = [];
    for(var i = 0; i < locs.length; i += 40) chunks.push(locs.slice(i, i + 40));
    return Promise.all(chunks.map(function(chunk){
      var lats = chunk.map(function(l){ return l.lat; }).join(",");
      var lons = chunk.map(function(l){ return l.lon; }).join(",");
      var url = "https://api.open-meteo.com/v1/forecast?latitude=" + lats +
        "&longitude=" + lons +
        "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,windspeed_10m_max" +
        "&timezone=Asia%2FTokyo&forecast_days=" + days;
      return fetch(url).then(function(res){
        if(!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      }).then(function(json){
        return Array.isArray(json) ? json : [json];
      });
    })).then(function(parts){
      return [].concat.apply([], parts);
    });
  }

  // weather-cache.json is written on a schedule by .github/workflows/update-weather.yml
  // (a batched Open-Meteo call for everything in crags.json). Pages read it instead of
  // calling Open-Meteo themselves; a location not in it (added locally via the editor,
  // or the cache file missing/stale) still gets fetched live, per-page.
  function loadWeatherCache(){
    return fetch(ROOT + "weather-cache.json", { cache: "no-store" })
      .then(function(r){ if(!r.ok) throw new Error("no cache"); return r.json(); })
      .catch(function(){ return null; });
  }

  function fmtUpdated(iso){
    var d = iso ? new Date(iso) : new Date();
    return (d.getMonth()+1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
  }

  // Resolves { map: {id -> forecast}, generatedAt, liveFailed } for the given
  // locations, preferring the cache and falling back to a live batched fetch
  // for whatever isn't in it. Never rejects: a location simply missing from
  // `map` means neither source had it.
  function getForecasts(locations, days){
    days = days || 16;
    return loadWeatherCache().then(function(cache){
      var byId = (cache && cache.byId) ? cache.byId : {};
      var generatedAt = cache ? cache.generatedAt : null;
      var live = locations.filter(function(loc){ return !byId[loc.id]; });
      return fetchForecastBatch(live, days).catch(function(){ return null; }).then(function(liveResults){
        var map = {};
        locations.forEach(function(loc){
          if(byId[loc.id]) map[loc.id] = byId[loc.id];
        });
        if(liveResults){
          live.forEach(function(loc, i){ map[loc.id] = liveResults[i]; });
        }
        return { map: map, generatedAt: generatedAt, liveFailed: live.length > 0 && !liveResults };
      });
    });
  }

  function fetchForecastOne(loc, days){
    days = days || 16;
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + loc.lat +
      "&longitude=" + loc.lon +
      "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,windspeed_10m_max" +
      "&timezone=Asia%2FTokyo&forecast_days=" + days;
    return fetch(url).then(function(res){
      if(!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  function geocodeSearch(query){
    return fetch("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(query) + "&count=6&language=" + LANG + "&format=json")
      .then(function(r){ return r.json(); })
      .then(function(data){ return data.results || []; });
  }

  function loadCrags(){
    return fetch(ROOT + "crags.json", { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(base){
      return base.concat(loadCustom());
    });
  }

  var FAV_KEY = "crag-weather-favs-v1";
  var FAVONLY_KEY = "crag-weather-favonly-v1";

  function loadFavs(){ var v = loadJSON(FAV_KEY); return Array.isArray(v) ? v : []; }
  function isFav(id){ return loadFavs().indexOf(id) !== -1; }
  function toggleFav(id){
    var f = loadFavs();
    var i = f.indexOf(id);
    if(i === -1) f.push(id); else f.splice(i, 1);
    saveJSON(FAV_KEY, f);
    return i === -1;
  }
  function loadFavOnly(){ return loadJSON(FAVONLY_KEY) === true; }
  function saveFavOnly(v){ saveJSON(FAVONLY_KEY, !!v); }

  function starBtnHtml(id){
    var on = isFav(id);
    return '<button class="star-btn' + (on ? " on" : "") + '" data-fav="' + id + '" aria-pressed="' + on + '" title="' + t("fav") + '">' + (on ? "★" : "☆") + '</button>';
  }
  function syncStar(btn, on){
    btn.classList.toggle("on", on);
    btn.textContent = on ? "★" : "☆";
    btn.setAttribute("aria-pressed", on);
  }
  // Capture phase so it still fires inside Leaflet popups, which stop click propagation.
  function bindFavClicks(container, onChange){
    container.addEventListener("click", function(e){
      var b = e.target.closest("[data-fav]");
      if(!b) return;
      var on = toggleFav(b.getAttribute("data-fav"));
      syncStar(b, on);
      if(onChange) onChange(b.getAttribute("data-fav"), on);
    }, true);
  }
  function initFavToggle(btn, onChange){
    function paint(){
      var on = loadFavOnly();
      btn.classList.toggle("on", on);
      btn.textContent = (on ? "★" : "☆") + " " + t("favOnly");
      btn.setAttribute("aria-pressed", on);
    }
    paint();
    btn.addEventListener("click", function(){
      saveFavOnly(!loadFavOnly());
      paint();
      onChange();
    });
  }
  function emptyMessage(){
    return loadFavOnly() ? t("favEmpty") : t("noneShown");
  }

  function visibleOf(locations){
    var hidden = loadHidden();
    var favs = loadFavOnly() ? loadFavs() : null;
    return locations.filter(function(loc){
      return hidden.indexOf(loc.id) === -1 && (!favs || favs.indexOf(loc.id) !== -1);
    });
  }

  // Prefecture choices for the filter menus, north to south.
  function prefChoices(locations){
    var seen = {}, list = [];
    locations.slice().sort(function(a, b){ return b.lat - a.lat; }).forEach(function(l){
      var key = l.prefecture || "";
      if(!key || seen[key]) return;
      seen[key] = true;
      list.push({ value: key, label: LANG === "en" ? (l.prefectureEn || key) : key });
    });
    return list;
  }
  function fillPrefSelect(select, locations){
    var cur = select.value;
    select.innerHTML = '<option value="">' + esc(t("allPref")) + '</option>' +
      prefChoices(locations).map(function(p){ return '<option value="' + esc(p.value) + '">' + esc(p.label) + '</option>'; }).join("");
    select.value = cur;
  }
  function matchesQuery(loc, q){
    if(!q) return true;
    q = q.toLowerCase();
    return (loc.name + " " + (loc.nameEn || "") + " " + (loc.region || "") + " " + (loc.prefecture || "") + " " + (loc.prefectureEn || "")).toLowerCase().indexOf(q) !== -1;
  }

  // Wires a standard "add-panel" (search box) + per-card remove buttons.
  // opts: { addInput, searchBtn, cancelBtn, resultsEl, editToggle, addPanel, onChange }
  // onChange() is called after any location is added / removed / hidden.
  function initEditor(opts){
    function doSearch(){
      var q = opts.addInput.value.trim();
      if(!q) return;
      opts.resultsEl.innerHTML = '<p class="hint">' + t("searching") + '</p>';
      geocodeSearch(q).then(function(results){
        if(!results.length){
          opts.resultsEl.innerHTML = '<p class="hint">' + t("notFound") + '</p>';
          return;
        }
        opts.resultsEl.innerHTML = "";
        results.forEach(function(r){
          var row = document.createElement("div");
          row.className = "search-hit";
          var admin = [r.admin1, r.admin2].filter(Boolean).join(" ");
          row.innerHTML = '<span><span class="name">' + esc(r.name) + '</span> ' +
            '<span class="geo">' + esc(admin || r.country || "") + '</span></span>';
          var btn = document.createElement("button");
          btn.textContent = t("add");
          btn.addEventListener("click", function(){
            var id = "custom-" + Date.now();
            var newLoc = {id:id, name:r.name, region: admin || (r.country || ""), lat:r.latitude, lon:r.longitude, priority:0, tier:"main"};
            var custom = loadCustom();
            custom.push(newLoc);
            saveCustom(custom);
            opts.addInput.value = "";
            opts.resultsEl.innerHTML = "";
            opts.onChange();
          });
          row.appendChild(btn);
          opts.resultsEl.appendChild(row);
        });
      }).catch(function(){
        opts.resultsEl.innerHTML = '<p class="hint">' + t("searchFail") + '</p>';
      });
    }

    var editMode = false;
    function setEditMode(on){
      editMode = on;
      opts.editToggle.textContent = editMode ? t("editOff") : t("editOn");
      opts.addPanel.classList.toggle("open", editMode);
      opts.onChange();
    }

    opts.editToggle.addEventListener("click", function(){ setEditMode(!editMode); });
    if(opts.cancelBtn) opts.cancelBtn.addEventListener("click", function(){ setEditMode(false); });
    opts.searchBtn.addEventListener("click", doSearch);
    opts.addInput.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); doSearch(); } });

    return {
      isEditMode: function(){ return editMode; },
      removeOrHide: function(id){
        var custom = loadCustom();
        var wasCustom = custom.some(function(l){ return l.id === id; });
        if(wasCustom){
          custom = custom.filter(function(l){ return l.id !== id; });
          saveCustom(custom);
        }else{
          var hidden = loadHidden();
          if(hidden.indexOf(id) === -1){
            hidden.push(id);
            saveHidden(hidden);
          }
        }
      }
    };
  }

  // The language buttons in the page header remember the choice; a visitor who picked
  // a language is taken to the matching page when they open the other-language one.
  function initLangMemory(){
    try{
      var links = document.querySelectorAll("a[data-lang]");
      Array.prototype.forEach.call(links, function(a){
        a.addEventListener("click", function(){
          try{ localStorage.setItem(LANG_KEY, a.getAttribute("data-lang")); }catch(e){}
        });
      });
    }catch(e){}
  }

  return {
    LANG: LANG, ROOT: ROOT, t: t, nm: nm, rg: rg, esc: esc,
    WMO: WMO,
    loadJSON: loadJSON, saveJSON: saveJSON,
    loadCustom: loadCustom, saveCustom: saveCustom,
    loadHidden: loadHidden, saveHidden: saveHidden,
    classify: classify, fmtDate: fmtDate, fmtWeekday: fmtWeekday, fmtUpdated: fmtUpdated, dowOf: dowOf,
    todayISO: todayISO, addDaysISO: addDaysISO, nextDowISO: nextDowISO,
    dayCellHtml: dayCellHtml, dayScore: dayScore,
    fetchForecastBatch: fetchForecastBatch, fetchForecastOne: fetchForecastOne,
    loadWeatherCache: loadWeatherCache, getForecasts: getForecasts,
    geocodeSearch: geocodeSearch, loadCrags: loadCrags, visibleOf: visibleOf,
    fillPrefSelect: fillPrefSelect, matchesQuery: matchesQuery,
    isFav: isFav, loadFavs: loadFavs, loadFavOnly: loadFavOnly, starBtnHtml: starBtnHtml,
    bindFavClicks: bindFavClicks, initFavToggle: initFavToggle, emptyMessage: emptyMessage,
    initEditor: initEditor, initLangMemory: initLangMemory
  };
})();
