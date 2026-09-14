(function(){
  "use strict";

  var LOCAL_KEY = "crag-weather-custom-v1";
  var HIDE_KEY = "crag-weather-hidden-v1";
  var SELECTED_KEY = "crag-weather-selected-v1";
  var SW_START = "2026-09-19";
  var SW_END = "2026-09-23";

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

  var chipRow = document.getElementById("chip-row");
  var mCard = document.getElementById("m-card");
  var mName = document.getElementById("m-name");
  var mRegion = document.getElementById("m-region");
  var dayList = document.getElementById("day-list");
  var updatedLabel = document.getElementById("updated-label");
  var refreshBtn = document.getElementById("refresh-btn");

  var locations = [];
  var forecasts = {};
  var selectedId = null;

  function loadJSON(key){
    try{
      var raw = localStorage.getItem(key);
      var parsed = raw ? JSON.parse(raw) : null;
      return parsed;
    }catch(e){ return null; }
  }

  function popClass(pct){
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
  function inSW(iso){ return iso >= SW_START && iso <= SW_END; }

  function visibleLocations(){
    var hidden = loadJSON(HIDE_KEY) || [];
    return locations.filter(function(loc){ return hidden.indexOf(loc.id) === -1; });
  }

  function renderChips(){
    var visible = visibleLocations();
    chipRow.innerHTML = "";
    visible.forEach(function(loc){
      var chip = document.createElement("button");
      chip.className = "chip" + (loc.id === selectedId ? " active" : "");
      chip.textContent = loc.name;
      chip.addEventListener("click", function(){
        selectedId = loc.id;
        try{ localStorage.setItem(SELECTED_KEY, selectedId); }catch(e){}
        renderChips();
        renderSelected();
      });
      chipRow.appendChild(chip);
    });
  }

  function dayRowHtml(iso, code, hi, lo, pop){
    var w = WMO[code] || ["🌡️","-"];
    var cls = popClass(pop);
    var swClass = inSW(iso) ? " sw" : "";
    var swTag = inSW(iso) ? '<span class="sw-tag">SW</span>' : "";
    return (
      '<div class="day-row' + swClass + '">' +
      '<div class="dow"><span class="wd">' + fmtWeekday(iso) + '</span>' +
      '<span class="dt">' + fmtDate(iso) + '</span>' + swTag + '</div>' +
      '<div class="cond"><span class="icon">' + w[0] + '</span><span class="label">' + w[1] + '</span></div>' +
      '<div class="figs">' +
      '<span class="temps"><span class="hi">' + Math.round(hi) + '°</span> / <span class="lo">' + Math.round(lo) + '°</span></span>' +
      '<span class="pop ' + cls + '">' + (pop === null || pop === undefined ? "–" : pop + "%") + '</span>' +
      '</div></div>'
    );
  }

  function renderSelected(){
    var loc = locations.find(function(l){ return l.id === selectedId; });
    if(!loc){
      mName.textContent = "地点がありません";
      mRegion.textContent = "";
      dayList.innerHTML = '<p class="m-empty">「一覧表示」から岩場を追加してください。</p>';
      return;
    }
    mName.textContent = loc.name;
    mRegion.textContent = loc.region;
    var data = forecasts[loc.id];
    if(!data){
      dayList.innerHTML = '<p class="m-empty">読み込み中…</p>';
      return;
    }
    if(data.error){
      dayList.innerHTML = '<p class="m-empty">天気の取得に失敗しました。「更新」を押して再試行してください。</p>';
      return;
    }
    var d = data.daily;
    var html = "";
    for(var i=0;i<d.time.length;i++){
      html += dayRowHtml(
        d.time[i],
        d.weathercode[i],
        d.temperature_2m_max[i],
        d.temperature_2m_min[i],
        d.precipitation_probability_max ? d.precipitation_probability_max[i] : null
      );
    }
    dayList.innerHTML = html;
  }

  function fetchForecastBatch(locs){
    if(!locs.length) return Promise.resolve([]);
    var lats = locs.map(function(l){ return l.lat; }).join(",");
    var lons = locs.map(function(l){ return l.lon; }).join(",");
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + lats +
      "&longitude=" + lons +
      "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,windspeed_10m_max" +
      "&timezone=Asia%2FTokyo&forecast_days=10";
    return fetch(url).then(function(res){
      if(!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function(json){
      return Array.isArray(json) ? json : [json];
    });
  }

  function loadAll(){
    var visible = visibleLocations();
    if(!visible.length){
      renderChips();
      renderSelected();
      updatedLabel.textContent = "表示中の地点がありません";
      return;
    }
    mCard.classList.add("skeleton");
    updatedLabel.textContent = "取得中…";
    refreshBtn.disabled = true;
    fetchForecastBatch(visible).then(function(results){
      forecasts = {};
      visible.forEach(function(loc, i){ forecasts[loc.id] = results[i]; });
      mCard.classList.remove("skeleton");
      var now = new Date();
      updatedLabel.innerHTML = "最終更新 <b>" + String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0") + "</b>";
      refreshBtn.disabled = false;
      renderSelected();
    }).catch(function(){
      forecasts = {};
      visible.forEach(function(loc){ forecasts[loc.id] = {error:true}; });
      mCard.classList.remove("skeleton");
      updatedLabel.textContent = "取得に失敗しました";
      refreshBtn.disabled = false;
      renderSelected();
    });
  }

  refreshBtn.addEventListener("click", loadAll);

  fetch("crags.json").then(function(r){ return r.json(); }).then(function(base){
    var custom = loadJSON(LOCAL_KEY) || [];
    locations = base.concat(custom);
    var visible = visibleLocations();
    var saved = null;
    try{ saved = localStorage.getItem(SELECTED_KEY); }catch(e){}
    selectedId = (saved && visible.some(function(l){ return l.id === saved; })) ? saved : (visible[0] ? visible[0].id : null);
    renderChips();
    renderSelected();
    loadAll();
  }).catch(function(){
    updatedLabel.textContent = "crags.json の読み込みに失敗しました";
  });
})();
