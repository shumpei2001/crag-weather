(function(){
  "use strict";
  var S = window.CragShared;

  var countLabel = document.getElementById("count-label");
  var updatedLabel = document.getElementById("updated-label");
  var refreshBtn = document.getElementById("refresh-btn");
  var dateInput = document.getElementById("date-input");

  var DOT_COLOR = { good:"#2f7a4f", caution:"#b07a1e", poor:"#5f6f8a" };
  // Below this zoom level, name labels hide to cut clutter when zoomed out
  // over a wide area. Adjust freely.
  var LABEL_MIN_ZOOM = 8;

  var locations = [];
  var forecasts = {};
  var markersById = {};
  var map = null;
  var hasFitOnce = false;

  function popupHtml(loc, data, centerIdx){
    if(!data || data.error){
      return '<p class="mp-name">' + loc.name + '</p><p class="mp-region">' + loc.region + '</p>' +
        '<p style="font-size:12.5px;color:var(--poor-ink);">天気の取得に失敗しました</p>';
    }
    var d = data.daily;
    var from = Math.max(0, centerIdx - 1);
    var to = Math.min(d.time.length - 1, centerIdx + 1);
    var days = '<div class="mp-days">';
    for(var i=from;i<=to;i++){
      var w = S.WMO[d.weathercode[i]] || ["🌡️","-"];
      var pop = d.precipitation_probability_max ? d.precipitation_probability_max[i] : null;
      days += '<div class="mp-day' + (i === centerIdx ? " center" : "") + '"><span class="wd">' + S.fmtWeekday(d.time[i]) + ' ' + S.fmtDate(d.time[i]) + '</span>' +
        '<span class="icon">' + w[0] + '</span>' +
        '<span class="temps"><span class="hi">' + Math.round(d.temperature_2m_max[i]) + '°</span>/<span class="lo">' + Math.round(d.temperature_2m_min[i]) + '°</span></span>' +
        '<span class="pop ' + S.classify(pop) + '">' + (pop === null ? "–" : pop + "%") + '</span></div>';
    }
    days += '</div>';
    return '<p class="mp-name">' + loc.name + '</p><p class="mp-region">' + loc.region + '</p>' +
      days + '<a class="mp-link" href="index.html#card-' + loc.id + '">詳細を見る →</a>';
  }

  function updateLabelVisibility(){
    var show = map.getZoom() >= LABEL_MIN_ZOOM;
    map.getContainer().classList.toggle("hide-labels", !show);
  }

  function initMap(){
    map = L.map("map", { scrollWheelZoom:false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    map.setView([43.5, 142.8], 7);
    map.on("zoomend", updateLabelVisibility);
    updateLabelVisibility();
  }

  function indexForDate(data, dateStr){
    if(!data || !data.daily) return 0;
    var i = data.daily.time.indexOf(dateStr);
    return i === -1 ? 0 : i;
  }

  function applyDate(){
    var selected = dateInput.value || S.todayISO();
    Object.keys(markersById).forEach(function(id){
      var loc = locations.find(function(l){ return l.id === id; });
      var data = forecasts[id];
      var marker = markersById[id];
      if(!loc || !marker) return;
      var idx = indexForDate(data, selected);
      var pop = (data && data.daily && data.daily.precipitation_probability_max) ? data.daily.precipitation_probability_max[idx] : null;
      marker.setStyle({ fillColor: DOT_COLOR[S.classify(pop)] });
      marker.setPopupContent(popupHtml(loc, data, idx));
    });
  }

  function loadAll(){
    var visible = S.visibleOf(locations).slice().sort(function(a, b){
      return (a.priority || 0) - (b.priority || 0);
    });
    countLabel.textContent = locations.length;
    if(!map) initMap();

    var visibleIds = visible.map(function(l){ return l.id; });
    Object.keys(markersById).forEach(function(id){
      if(visibleIds.indexOf(id) === -1){
        map.removeLayer(markersById[id]);
        delete markersById[id];
      }
    });

    if(!visible.length){
      updatedLabel.textContent = "表示中の地点がありません";
      return;
    }
    updatedLabel.textContent = "取得中…";
    refreshBtn.disabled = true;
    S.fetchForecastBatch(visible, 16).then(function(results){
      forecasts = {};
      var bounds = [];
      visible.forEach(function(loc, i){
        forecasts[loc.id] = results[i];
        bounds.push([loc.lat, loc.lon]);
        if(!markersById[loc.id]){
          var marker = L.circleMarker([loc.lat, loc.lon], {
            radius: 10, color: "#fff8f0", weight: 2, fillOpacity: 0.9
          }).addTo(map);
          marker.bindPopup("", { closeButton:true, maxWidth:260 });
          marker.bindTooltip(loc.name, { permanent:true, direction:"top", offset:[0,-8], className:"mp-tooltip" });
          markersById[loc.id] = marker;
        }
      });
      var first = results.filter(function(r){ return r && r.daily; })[0];
      if(first){
        dateInput.min = first.daily.time[0];
        dateInput.max = first.daily.time[first.daily.time.length - 1];
        if(!dateInput.value) dateInput.value = first.daily.time[0];
      }
      applyDate();
      if(!hasFitOnce && bounds.length){
        map.fitBounds(bounds, { padding:[28,28], maxZoom:11 });
        hasFitOnce = true;
        updateLabelVisibility();
      }
      var now = new Date();
      updatedLabel.innerHTML = "最終更新 <b>" + String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0") + "</b>";
      refreshBtn.disabled = false;
    }).catch(function(){
      updatedLabel.textContent = "取得に失敗しました";
      refreshBtn.disabled = false;
    });
  }

  dateInput.addEventListener("change", applyDate);
  refreshBtn.addEventListener("click", loadAll);

  S.loadCrags().then(function(all){
    locations = all;
    loadAll();
  }).catch(function(){
    updatedLabel.textContent = "crags.json の読み込みに失敗しました";
  });
})();
