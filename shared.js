window.CragShared = (function(){
  "use strict";

  var LOCAL_KEY = "crag-weather-custom-v1";
  var HIDE_KEY = "crag-weather-hidden-v1";

  var WMO = {
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
    return ["日","月","火","水","木","金","土"][d.getDay()];
  }
  function todayISO(){
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }
  function addDaysISO(iso, n){
    var d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + n);
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
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

  function fetchForecastBatch(locs, days){
    days = days || 16;
    if(!locs.length) return Promise.resolve([]);
    var lats = locs.map(function(l){ return l.lat; }).join(",");
    var lons = locs.map(function(l){ return l.lon; }).join(",");
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
  }

  // weather-cache.json is written on a schedule by .github/workflows/update-weather.yml
  // (a batched Open-Meteo call for everything in crags.json). Pages read it instead of
  // calling Open-Meteo themselves; a location not in it (added locally via the editor,
  // or the cache file missing/stale) still gets fetched live, per-page.
  function loadWeatherCache(){
    return fetch("weather-cache.json", { cache: "no-store" })
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
    return fetch("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(query) + "&count=6&language=ja&format=json")
      .then(function(r){ return r.json(); })
      .then(function(data){ return data.results || []; });
  }

  function loadCrags(){
    return fetch("crags.json", { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(base){
      return base.concat(loadCustom());
    });
  }

  function visibleOf(locations){
    var hidden = loadHidden();
    return locations.filter(function(loc){ return hidden.indexOf(loc.id) === -1; });
  }

  // Wires a standard "add-panel" (search box) + per-card remove buttons.
  // opts: { addInput, searchBtn, cancelBtn, resultsEl, editToggle, addPanel, onChange }
  // onChange() is called after any location is added / removed / hidden.
  function initEditor(opts){
    function doSearch(){
      var q = opts.addInput.value.trim();
      if(!q) return;
      opts.resultsEl.innerHTML = '<p class="hint">検索中…</p>';
      geocodeSearch(q).then(function(results){
        if(!results.length){
          opts.resultsEl.innerHTML = '<p class="hint">見つかりませんでした。別の表記で試してください。</p>';
          return;
        }
        opts.resultsEl.innerHTML = "";
        results.forEach(function(r){
          var row = document.createElement("div");
          row.className = "search-hit";
          var admin = [r.admin1, r.admin2].filter(Boolean).join(" ");
          row.innerHTML = '<span><span class="name">' + r.name + '</span> ' +
            '<span class="geo">' + (admin || r.country || "") + '</span></span>';
          var btn = document.createElement("button");
          btn.textContent = "追加";
          btn.addEventListener("click", function(){
            var id = "custom-" + Date.now();
            var newLoc = {id:id, name:r.name, region: admin || (r.country || ""), lat:r.latitude, lon:r.longitude, priority:0};
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
        opts.resultsEl.innerHTML = '<p class="hint">検索に失敗しました。しばらくして再試行してください。</p>';
      });
    }

    var editMode = false;
    function setEditMode(on){
      editMode = on;
      opts.editToggle.textContent = editMode ? "編集を終了" : "＋ 場所を編集";
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

  return {
    WMO: WMO,
    loadJSON: loadJSON, saveJSON: saveJSON,
    loadCustom: loadCustom, saveCustom: saveCustom,
    loadHidden: loadHidden, saveHidden: saveHidden,
    classify: classify, fmtDate: fmtDate, fmtWeekday: fmtWeekday, fmtUpdated: fmtUpdated,
    todayISO: todayISO, addDaysISO: addDaysISO,
    dayCellHtml: dayCellHtml,
    fetchForecastBatch: fetchForecastBatch, fetchForecastOne: fetchForecastOne,
    loadWeatherCache: loadWeatherCache, getForecasts: getForecasts,
    geocodeSearch: geocodeSearch, loadCrags: loadCrags, visibleOf: visibleOf,
    initEditor: initEditor
  };
})();
