(function(){
  "use strict";

  var LOCAL_KEY = "crag-weather-custom-v1";
  var HIDE_KEY = "crag-weather-hidden-v1";
  var DAYCOUNT_KEY = "crag-weather-daycount-v1";
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

  var locationsEl = document.getElementById("locations");
  var jumpRow = document.getElementById("jump-row");
  var updatedLabel = document.getElementById("updated-label");
  var refreshBtn = document.getElementById("refresh-btn");
  var daycountSeg = document.getElementById("daycount-seg");

  var locations = [];
  var forecasts = {};
  var dayCount = 3;

  function loadJSON(key){
    try{
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }

  function loadDayCount(){
    var v = null;
    try{ v = localStorage.getItem(DAYCOUNT_KEY); }catch(e){}
    var n = parseInt(v, 10);
    return [3,5,7,10].indexOf(n) > -1 ? n : 3;
  }
  function saveDayCount(n){
    try{ localStorage.setItem(DAYCOUNT_KEY, String(n)); }catch(e){}
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

  function dayCellHtml(iso, code, hi, lo, pop){
    var w = WMO[code] || ["🌡️","-"];
    var cls = popClass(pop);
    var swClass = inSW(iso) ? " sw" : "";
    var swTag = inSW(iso) ? '<span class="sw-tag">SW</span>' : "";
    return (
      '<div class="day' + swClass + '">' + swTag +
      '<span class="wd">' + fmtWeekday(iso) + '</span>' +
      '<span class="dt">' + fmtDate(iso) + '</span>' +
      '<span class="icon" title="' + w[1] + '">' + w[0] + '</span>' +
      '<span class="temps"><span class="hi">' + Math.round(hi) + '°</span>/<span class="lo">' + Math.round(lo) + '°</span></span>' +
      '<span class="pop ' + cls + '">' + (pop === null || pop === undefined ? "–" : pop + "%") + '</span>' +
      '</div>'
    );
  }

  function renderJumpRow(){
    var visible = visibleLocations();
    jumpRow.innerHTML = "";
    visible.forEach(function(loc){
      var a = document.createElement("a");
      a.className = "jump-chip";
      a.href = "#card-" + loc.id;
      a.textContent = loc.name;
      a.addEventListener("click", function(e){
        e.preventDefault();
        var el = document.getElementById("card-" + loc.id);
        if(el) el.scrollIntoView({behavior:"smooth", block:"start"});
      });
      jumpRow.appendChild(a);
    });
  }

  function renderCards(){
    var visible = visibleLocations();
    locationsEl.innerHTML = "";
    var useFit = dayCount <= 5;
    visible.forEach(function(loc){
      var card = document.createElement("div");
      card.className = "card";
      card.id = "card-" + loc.id;
      var head = '<div class="card-head"><div class="card-title"><h2>' + loc.name + '</h2>' +
        '<span class="region">' + loc.region + '</span></div></div>';
      var data = forecasts[loc.id];
      var body;
      if(!data){
        body = '<div class="strip">' + '<div class="day"></div>'.repeat(dayCount) + '</div>';
        card.classList.add("skeleton");
      }else if(data.error){
        body = '<div class="row-error"><span>天気の取得に失敗しました</span>' +
          '<button data-retry="' + loc.id + '">再試行</button></div>';
      }else{
        var d = data.daily;
        var stripClass = "strip" + (useFit ? " fit" : "");
        var stripStyle = useFit ? ' style="--cols:' + dayCount + '"' : "";
        var html = '<div class="' + stripClass + '"' + stripStyle + '>';
        for(var i=0;i<dayCount && i<d.time.length;i++){
          html += dayCellHtml(
            d.time[i], d.weathercode[i], d.temperature_2m_max[i], d.temperature_2m_min[i],
            d.precipitation_probability_max ? d.precipitation_probability_max[i] : null
          );
        }
        html += '</div>';
        body = html;
      }
      card.innerHTML = head + body;
      locationsEl.appendChild(card);
    });
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
    renderJumpRow();
    renderCards();
    if(!visible.length){
      updatedLabel.textContent = "表示中の地点がありません";
      return;
    }
    updatedLabel.textContent = "取得中…";
    refreshBtn.disabled = true;
    fetchForecastBatch(visible).then(function(results){
      forecasts = {};
      visible.forEach(function(loc, i){ forecasts[loc.id] = results[i]; });
      renderCards();
      var now = new Date();
      updatedLabel.innerHTML = "最終更新 <b>" + String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0") + "</b>";
      refreshBtn.disabled = false;
    }).catch(function(){
      forecasts = {};
      visible.forEach(function(loc){ forecasts[loc.id] = {error:true}; });
      renderCards();
      updatedLabel.textContent = "取得に失敗しました";
      refreshBtn.disabled = false;
    });
  }

  function updateSegUI(){
    Array.prototype.forEach.call(daycountSeg.querySelectorAll("button"), function(btn){
      btn.classList.toggle("active", parseInt(btn.getAttribute("data-days"),10) === dayCount);
    });
  }

  daycountSeg.addEventListener("click", function(e){
    var btn = e.target.closest("button[data-days]");
    if(!btn) return;
    dayCount = parseInt(btn.getAttribute("data-days"), 10);
    saveDayCount(dayCount);
    updateSegUI();
    renderCards();
  });

  locationsEl.addEventListener("click", function(e){
    var retryId = e.target.getAttribute("data-retry");
    if(!retryId) return;
    var loc = locations.find(function(l){ return l.id === retryId; });
    if(!loc) return;
    fetch("https://api.open-meteo.com/v1/forecast?latitude=" + loc.lat + "&longitude=" + loc.lon +
      "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,windspeed_10m_max&timezone=Asia%2FTokyo&forecast_days=10")
      .then(function(r){ return r.json(); })
      .then(function(data){ forecasts[loc.id] = data; renderCards(); })
      .catch(function(){ forecasts[loc.id] = {error:true}; renderCards(); });
  });

  refreshBtn.addEventListener("click", loadAll);

  dayCount = loadDayCount();
  updateSegUI();

  fetch("crags.json", { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(base){
    var custom = loadJSON(LOCAL_KEY) || [];
    locations = base.concat(custom);
    loadAll();
  }).catch(function(){
    updatedLabel.textContent = "crags.json の読み込みに失敗しました";
  });
})();
