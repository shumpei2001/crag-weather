// Map page: the map fills the screen. Main crags are always drawn; the extra crags
// are thinned out so that pins never pile up, and more of them appear as you zoom in.
(function(){
  "use strict";
  var S = window.CragShared;
  var t = S.t;
  var EN = S.LANG === "en";

  var countLabel = document.getElementById("count-label");
  var updatedLabel = document.getElementById("updated-label");
  var refreshBtn = document.getElementById("refresh-btn");
  var dateInput = document.getElementById("date-input");
  var moreToggle = document.getElementById("more-toggle");

  var DOT_COLOR = { good:"#16a34a", caution:"#e08e00", poor:"#dc2626" };
  // Name labels hide when zoomed out over a wide area; labels of the extra crags need a closer zoom.
  var LABEL_MIN_ZOOM = 8;
  var LABEL_MORE_MIN_ZOOM = 10;
  // An extra crag is hidden when its pin would sit closer than this (in pixels) to another visible pin.
  var MIN_GAP = 22;
  var MORE_KEY = "crag-weather-more-v1";

  var locations = [];
  var forecasts = {};
  var entries = {};        // id -> { loc, marker, shown }
  var map = null;
  var layer = null;
  var hasFitOnce = false;

  var LEGEND = EN
    ? ["Rain chance 20% or less on the chosen day", "20–50%", "Over 50%"]
    : ["選んだ日の降水確率20%以下", "20〜50%", "50%超"];

  function popupHtml(loc, data, centerIdx){
    var head = '<p class="mp-name">' + S.esc(S.nm(loc)) + S.starBtnHtml(loc.id) + '</p><p class="mp-region">' + S.esc(S.rg(loc)) + '</p>';
    if(!data || data.error || !data.daily){
      return head + '<p style="font-size:12.5px;color:var(--poor-ink);">' + t("failWeather") + '</p>';
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
        '<span class="pop ' + S.classify(pop) + '">' + (pop === null || pop === undefined ? "–" : pop + "%") + '</span></div>';
    }
    days += '</div>';
    return head + days + '<a class="mp-link" href="index.html#card-' + loc.id + '">' + t("detail") + '</a>';
  }

  function updateLabelVisibility(){
    var z = map.getZoom();
    var c = map.getContainer();
    c.classList.toggle("hide-labels", z < LABEL_MIN_ZOOM);
    c.classList.toggle("hide-more-labels", z < LABEL_MORE_MIN_ZOOM);
  }

  // Decide which pins are drawn at this zoom: favorites and main crags always,
  // extra crags only where they do not crowd a pin that is already shown.
  function declutter(){
    if(!map || !layer) return;
    var withMore = moreToggle.checked;
    var order = Object.keys(entries).map(function(id){ return entries[id]; }).sort(function(a, b){
      var fa = S.isFav(a.loc.id) ? 1 : 0, fb = S.isFav(b.loc.id) ? 1 : 0;
      if(fa !== fb) return fb - fa;
      var ta = a.loc.tier === "more" ? 1 : 0, tb = b.loc.tier === "more" ? 1 : 0;
      if(ta !== tb) return ta - tb;
      return (b.loc.priority || 0) - (a.loc.priority || 0);
    });
    var bounds = map.getBounds().pad(0.1);
    var taken = [];
    order.forEach(function(e){
      var always = e.loc.tier !== "more" || S.isFav(e.loc.id);
      var show;
      if(!withMore && !always){
        show = false;
      }else if(!bounds.contains(e.marker.getLatLng())){
        show = always;                       // off screen: keep the always-on pins, skip the rest
        if(show) taken.push(map.latLngToLayerPoint(e.marker.getLatLng()));
      }else{
        var p = map.latLngToLayerPoint(e.marker.getLatLng());
        show = always || !taken.some(function(q){ return Math.abs(q.x - p.x) < MIN_GAP && Math.abs(q.y - p.y) < MIN_GAP; });
        if(show) taken.push(p);
      }
      if(show && !e.shown){ layer.addLayer(e.marker); e.shown = true; }
      if(!show && e.shown){ layer.removeLayer(e.marker); e.shown = false; }
    });
  }

  function initMap(){
    map = L.map("map", { scrollWheelZoom:true, zoomControl:true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    layer = L.layerGroup().addTo(map);
    map.setView([37.5, 138.5], 6);
    map.on("zoomend", function(){ updateLabelVisibility(); declutter(); });
    map.on("moveend", declutter);

    var legend = L.control({ position: "bottomleft" });
    legend.onAdd = function(){
      var div = L.DomUtil.create("div", "map-legend");
      div.innerHTML = ["good", "caution", "poor"].map(function(k, i){
        return '<span class="item"><span class="dot ' + k + '"></span>' + LEGEND[i] + '</span>';
      }).join("");
      return div;
    };
    legend.addTo(map);
    updateLabelVisibility();
    window.cwMap = map;   // handy for debugging in the browser console
    window.addEventListener("resize", function(){ map.invalidateSize(); });
  }

  function indexForDate(data, dateStr){
    if(!data || !data.daily) return 0;
    var i = data.daily.time.indexOf(dateStr);
    return i === -1 ? 0 : i;
  }

  function applyDate(){
    var selected = dateInput.value || S.todayISO();
    Object.keys(entries).forEach(function(id){
      var e = entries[id];
      var data = forecasts[id];
      var idx = indexForDate(data, selected);
      var pop = (data && data.daily && data.daily.precipitation_probability_max) ? data.daily.precipitation_probability_max[idx] : null;
      e.marker.setStyle({ fillColor: DOT_COLOR[S.classify(pop)] });
      e.marker.setPopupContent(popupHtml(e.loc, data, idx));
    });
  }

  function loadAll(){
    var visible = S.visibleOf(locations);
    countLabel.textContent = visible.length;
    if(!map) initMap();

    var visibleIds = visible.map(function(l){ return l.id; });
    Object.keys(entries).forEach(function(id){
      if(visibleIds.indexOf(id) === -1){
        if(entries[id].shown) layer.removeLayer(entries[id].marker);
        delete entries[id];
      }
    });

    if(!visible.length){
      updatedLabel.textContent = S.emptyMessage();
      return;
    }
    updatedLabel.textContent = t("fetching");
    refreshBtn.disabled = true;
    S.getForecasts(visible, 16).then(function(result){
      forecasts = result.map;
      var mainBounds = [];
      visible.forEach(function(loc){
        if(loc.tier !== "more") mainBounds.push([loc.lat, loc.lon]);
        if(!entries[loc.id]){
          var isMore = loc.tier === "more";
          var marker = L.circleMarker([loc.lat, loc.lon], {
            radius: isMore ? 7 : 10, color: "#fff8f0", weight: 2, fillOpacity: 0.9
          });
          marker.bindPopup("", { closeButton:true, maxWidth:260 });
          marker.bindTooltip(S.esc(S.nm(loc)), { permanent:true, direction:"top", offset:[0, isMore ? -5 : -8], className:"mp-tooltip" + (isMore ? " more" : "") });
          entries[loc.id] = { loc: loc, marker: marker, shown: false };
        }
      });
      var first = visible.map(function(loc){ return forecasts[loc.id]; }).filter(function(d){ return d && d.daily; })[0];
      if(first){
        dateInput.min = first.daily.time[0];
        dateInput.max = first.daily.time[first.daily.time.length - 1];
        if(!dateInput.value) dateInput.value = first.daily.time[0];
      }
      applyDate();
      if(!hasFitOnce && mainBounds.length){
        map.invalidateSize();
        map.fitBounds(mainBounds, { padding:[28,28], maxZoom:11 });
        hasFitOnce = true;
      }
      updateLabelVisibility();
      declutter();
      updatedLabel.innerHTML = t("updated") + " <b>" + S.fmtUpdated(result.generatedAt) + "</b>";
      refreshBtn.disabled = false;
    }).catch(function(){
      updatedLabel.textContent = t("fail");
      refreshBtn.disabled = false;
    });
  }

  dateInput.addEventListener("change", applyDate);
  moreToggle.checked = S.loadJSON(MORE_KEY) !== false;
  moreToggle.addEventListener("change", function(){ S.saveJSON(MORE_KEY, moreToggle.checked); declutter(); });
  S.bindFavClicks(document.getElementById("map"), function(id, on){
    if(!on && S.loadFavOnly()) loadAll(); else declutter();
  });
  S.initFavToggle(document.getElementById("fav-toggle"), loadAll);
  refreshBtn.addEventListener("click", loadAll);
  S.initLangMemory();

  S.loadCrags().then(function(all){
    locations = all;
    loadAll();
  }).catch(function(){
    updatedLabel.textContent = t("cragsFail");
  });
})();
