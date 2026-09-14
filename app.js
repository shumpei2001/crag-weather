(function(){
  "use strict";

  var LOCAL_KEY = "crag-weather-custom-v1";
  var HIDE_KEY = "crag-weather-hidden-v1";
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
  var countLabel = document.getElementById("count-label");
  var updatedLabel = document.getElementById("updated-label");
  var editToggle = document.getElementById("edit-toggle");
  var refreshBtn = document.getElementById("refresh-btn");
  var addPanel = document.getElementById("add-panel");
  var addInput = document.getElementById("add-input");
  var searchBtn = document.getElementById("search-btn");
  var cancelAdd = document.getElementById("cancel-add");
  var searchResults = document.getElementById("search-results");
  var hiddenNote = document.getElementById("hidden-note");

  var editMode = false;
  var locations = [];

  function loadCustom(){
    try{
      var raw = localStorage.getItem(LOCAL_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    }catch(e){ return []; }
  }
  function saveCustom(list){
    try{ localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); }catch(e){}
  }
  function loadHidden(){
    try{
      var raw = localStorage.getItem(HIDE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    }catch(e){ return []; }
  }
  function saveHidden(list){
    try{ localStorage.setItem(HIDE_KEY, JSON.stringify(list)); }catch(e){}
  }
  var hidden = loadHidden();

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

  function renderHiddenNote(){
    if(hidden.length === 0){ hiddenNote.style.display = "none"; return; }
    hiddenNote.style.display = "inline";
    hiddenNote.innerHTML = "非表示 " + hidden.length + "件";
    var btn = document.createElement("button");
    btn.className = "ghost";
    btn.textContent = "すべて表示";
    btn.addEventListener("click", function(){
      hidden = [];
      saveHidden(hidden);
      render();
    });
    hiddenNote.appendChild(btn);
  }

  function renderSkeleton(){
    locationsEl.innerHTML = "";
    locations.forEach(function(loc){
      if(hidden.indexOf(loc.id) > -1) return;
      var card = document.createElement("div");
      card.className = "card skeleton";
      card.id = "card-" + loc.id;
      var removeBtn = editMode ? '<button class="icon-btn" data-remove="' + loc.id + '">✕ 削除</button>' : '';
      card.innerHTML =
        '<div class="card-head"><div class="card-title"><h2>' + loc.name + '</h2>' +
        '<span class="region">' + loc.region + '</span></div>' + removeBtn + '</div>' +
        '<div class="strip">' + '<div class="day"></div>'.repeat(7) + '</div>';
      locationsEl.appendChild(card);
    });
    countLabel.textContent = locations.length;
    renderHiddenNote();
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

  function renderCard(loc, data, error){
    var card = document.getElementById("card-" + loc.id);
    if(!card) return;
    card.classList.remove("skeleton");
    var removeBtn = editMode ? '<button class="icon-btn" data-remove="' + loc.id + '">✕ 削除</button>' : "";
    var head = '<div class="card-head"><div class="card-title"><h2>' + loc.name + '</h2>' +
      '<span class="region">' + loc.region + '</span></div>' + removeBtn + '</div>';

    if(error){
      card.innerHTML = head + '<div class="row-error"><span>天気の取得に失敗しました</span>' +
        '<button data-retry="' + loc.id + '">再試行</button></div>';
      return;
    }

    var days = data.daily.time;
    var html = head + '<div class="strip">';
    for(var i=0;i<days.length;i++){
      html += dayCellHtml(
        days[i],
        data.daily.weathercode[i],
        data.daily.temperature_2m_max[i],
        data.daily.temperature_2m_min[i],
        data.daily.precipitation_probability_max ? data.daily.precipitation_probability_max[i] : null
      );
    }
    html += '</div>';
    card.innerHTML = html;
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

  function fetchForecastOne(loc){
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + loc.lat +
      "&longitude=" + loc.lon +
      "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,windspeed_10m_max" +
      "&timezone=Asia%2FTokyo&forecast_days=10";
    return fetch(url).then(function(res){
      if(!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  function visibleLocations(){
    return locations.filter(function(loc){ return hidden.indexOf(loc.id) === -1; });
  }

  function loadAll(){
    renderSkeleton();
    var visible = visibleLocations();
    if(!visible.length){
      updatedLabel.textContent = "表示中の地点がありません";
      return;
    }
    updatedLabel.textContent = "取得中…";
    refreshBtn.disabled = true;
    fetchForecastBatch(visible).then(function(results){
      visible.forEach(function(loc, i){
        renderCard(loc, results[i], null);
      });
      var now = new Date();
      updatedLabel.innerHTML = "最終更新 <b>" + String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0") + "</b>";
      refreshBtn.disabled = false;
    }).catch(function(){
      visible.forEach(function(loc){ renderCard(loc, null, true); });
      updatedLabel.textContent = "取得に失敗しました";
      refreshBtn.disabled = false;
    });
  }

  function render(){
    editToggle.textContent = editMode ? "編集を終了" : "＋ 場所を編集";
    addPanel.classList.toggle("open", editMode);
    loadAll();
  }

  locationsEl.addEventListener("click", function(e){
    var retryId = e.target.getAttribute("data-retry");
    if(retryId){
      var loc = locations.find(function(l){ return l.id === retryId; });
      if(loc){
        var card = document.getElementById("card-" + loc.id);
        card.classList.add("skeleton");
        fetchForecastOne(loc).then(function(data){ renderCard(loc, data, null); })
          .catch(function(){ renderCard(loc, null, true); });
      }
      return;
    }
    var removeId = e.target.getAttribute("data-remove");
    if(removeId){
      var custom = loadCustom();
      var wasCustom = custom.some(function(l){ return l.id === removeId; });
      if(wasCustom){
        custom = custom.filter(function(l){ return l.id !== removeId; });
        saveCustom(custom);
        locations = locations.filter(function(l){ return l.id !== removeId; });
      }else{
        if(hidden.indexOf(removeId) === -1) hidden.push(removeId);
        saveHidden(hidden);
      }
      render();
    }
  });

  editToggle.addEventListener("click", function(){
    editMode = !editMode;
    render();
  });
  cancelAdd.addEventListener("click", function(){
    editMode = false;
    render();
  });
  refreshBtn.addEventListener("click", loadAll);

  function doSearch(){
    var q = addInput.value.trim();
    if(!q) return;
    searchResults.innerHTML = '<p class="hint">検索中…</p>';
    fetch("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(q) + "&count=6&language=ja&format=json")
      .then(function(r){ return r.json(); })
      .then(function(data){
        var results = data.results || [];
        if(!results.length){
          searchResults.innerHTML = '<p class="hint">見つかりませんでした。別の表記で試してください。</p>';
          return;
        }
        searchResults.innerHTML = "";
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
            var newLoc = {id:id, name:r.name, region: admin || (r.country || ""), lat:r.latitude, lon:r.longitude};
            var custom = loadCustom();
            custom.push(newLoc);
            saveCustom(custom);
            locations.push(newLoc);
            addInput.value = "";
            searchResults.innerHTML = "";
            render();
          });
          row.appendChild(btn);
          searchResults.appendChild(row);
        });
      })
      .catch(function(){
        searchResults.innerHTML = '<p class="hint">検索に失敗しました。しばらくして再試行してください。</p>';
      });
  }
  searchBtn.addEventListener("click", doSearch);
  addInput.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); doSearch(); } });

  fetch("crags.json", { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(base){
    locations = base.concat(loadCustom());
    render();
  }).catch(function(){
    locations = loadCustom();
    updatedLabel.textContent = "crags.json の読み込みに失敗しました";
    render();
  });
})();
