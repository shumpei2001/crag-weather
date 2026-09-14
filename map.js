(function(){
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

  var countLabel = document.getElementById("count-label");
  var updatedLabel = document.getElementById("updated-label");
  var refreshBtn = document.getElementById("refresh-btn");

  var locations = [];
  var markers = [];
  var map = null;

  function loadJSON(key){
    try{
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }

  function classify(pct){
    if(pct === null || pct === undefined) return "caution";
    if(pct <= 20) return "good";
    if(pct <= 50) return "caution";
    return "poor";
  }
  var DOT_COLOR = { good:"#2f7a4f", caution:"#b07a1e", poor:"#5f6f8a" };

  function fmtDate(iso){
    var d = new Date(iso + "T00:00:00");
    return (d.getMonth()+1) + "/" + d.getDate();
  }
  function fmtWeekday(iso){
    var d = new Date(iso + "T00:00:00");
    return ["日","月","火","水","木","金","土"][d.getDay()];
  }

  function visibleLocations(){
    var hidden = loadJSON(HIDE_KEY) || [];
    return locations.filter(function(loc){ return hidden.indexOf(loc.id) === -1; });
  }

  function popupHtml(loc, data){
    if(!data || data.error){
      return '<p class="mp-name">' + loc.name + '</p><p class="mp-region">' + loc.region + '</p>' +
        '<p style="font-size:12.5px;color:var(--poor-ink);">天気の取得に失敗しました</p>';
    }
    var d = data.daily;
    var days = '<div class="mp-days">';
    for(var i=0;i<3 && i<d.time.length;i++){
      var w = WMO[d.weathercode[i]] || ["🌡️","-"];
      var pop = d.precipitation_probability_max ? d.precipitation_probability_max[i] : null;
      days += '<div class="mp-day"><span class="wd">' + fmtWeekday(d.time[i]) + ' ' + fmtDate(d.time[i]) + '</span>' +
        '<span class="icon">' + w[0] + '</span>' +
        '<span class="temps"><span class="hi">' + Math.round(d.temperature_2m_max[i]) + '°</span>/<span class="lo">' + Math.round(d.temperature_2m_min[i]) + '°</span></span>' +
        '<span class="pop ' + classify(pop) + '">' + (pop === null ? "–" : pop + "%") + '</span></div>';
    }
    days += '</div>';
    return '<p class="mp-name">' + loc.name + '</p><p class="mp-region">' + loc.region + '</p>' +
      days + '<a class="mp-link" href="index.html#card-' + loc.id + '">10日間の詳細 →</a>';
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

  function initMap(){
    map = L.map("map", { scrollWheelZoom:false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    map.setView([43.5, 142.8], 7);
  }

  function loadAll(){
    var visible = visibleLocations().slice().sort(function(a, b){
      return (a.priority || 0) - (b.priority || 0);
    });
    countLabel.textContent = locations.length;
    if(!map) initMap();
    markers.forEach(function(m){ map.removeLayer(m); });
    markers = [];
    if(!visible.length){
      updatedLabel.textContent = "表示中の地点がありません";
      return;
    }
    updatedLabel.textContent = "取得中…";
    refreshBtn.disabled = true;
    fetchForecastBatch(visible).then(function(results){
      var bounds = [];
      visible.forEach(function(loc, i){
        var data = results[i];
        var pop = (data && data.daily && data.daily.precipitation_probability_max) ? data.daily.precipitation_probability_max[1] : null;
        var cls = classify(pop);
        var marker = L.circleMarker([loc.lat, loc.lon], {
          radius: 10,
          color: "#fff8f0",
          weight: 2,
          fillColor: DOT_COLOR[cls],
          fillOpacity: 0.9
        }).addTo(map);
        marker.bindPopup(popupHtml(loc, data), { closeButton:true, maxWidth:260 });
        marker.bindTooltip(loc.name, {
          permanent: true,
          direction: "top",
          offset: [0, -8],
          className: "mp-tooltip"
        });
        markers.push(marker);
        bounds.push([loc.lat, loc.lon]);
      });
      if(bounds.length) map.fitBounds(bounds, { padding:[28,28], maxZoom:11 });
      var now = new Date();
      updatedLabel.innerHTML = "最終更新 <b>" + String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0") + "</b>";
      refreshBtn.disabled = false;
    }).catch(function(){
      updatedLabel.textContent = "取得に失敗しました";
      refreshBtn.disabled = false;
    });
  }

  refreshBtn.addEventListener("click", loadAll);

  fetch("crags.json", { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(base){
    var custom = loadJSON(LOCAL_KEY) || [];
    locations = base.concat(custom);
    loadAll();
  }).catch(function(){
    updatedLabel.textContent = "crags.json の読み込みに失敗しました";
  });
})();
