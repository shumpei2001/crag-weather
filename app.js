// List page: every crag as one row, the next 16 days as columns, so the whole
// country can be compared at a glance. Click a date to sort by that day.
(function(){
  "use strict";
  var S = window.CragShared;
  var t = S.t;

  var matrixEl = document.getElementById("matrix");
  var shownLabel = document.getElementById("shown-label");
  var updatedLabel = document.getElementById("updated-label");
  var editToggle = document.getElementById("edit-toggle");
  var refreshBtn = document.getElementById("refresh-btn");
  var addPanel = document.getElementById("add-panel");
  var addInput = document.getElementById("add-input");
  var searchBtn = document.getElementById("search-btn");
  var cancelAdd = document.getElementById("cancel-add");
  var searchResults = document.getElementById("search-results");
  var hiddenNote = document.getElementById("hidden-note");
  var prefSelect = document.getElementById("pref-select");
  var queryInput = document.getElementById("query-input");
  var moreToggle = document.getElementById("more-toggle");

  var locations = [];
  var forecasts = {};
  var editor = null;
  var sortDate = null;   // ISO date to sort by; null = north to south
  var MORE_KEY = "crag-weather-more-v1";

  function renderHiddenNote(){
    var hidden = S.loadHidden();
    if(hidden.length === 0){ hiddenNote.style.display = "none"; return; }
    hiddenNote.style.display = "inline";
    hiddenNote.innerHTML = t("hiddenN", hidden.length);
    var btn = document.createElement("button");
    btn.className = "ghost";
    btn.textContent = t("showAll");
    btn.addEventListener("click", function(){
      S.saveHidden([]);
      render();
    });
    hiddenNote.appendChild(btn);
  }

  function shownLocations(){
    var list = S.visibleOf(locations);
    var pref = prefSelect.value;
    var q = queryInput.value.trim();
    var more = moreToggle.checked;
    list = list.filter(function(l){
      if(!more && l.tier === "more" && !S.isFav(l.id)) return false;
      if(pref && l.prefecture !== pref) return false;
      return S.matchesQuery(l, q);
    });
    var dayIdx = function(loc){
      var d = forecasts[loc.id];
      return d && d.daily ? d.daily.time.indexOf(sortDate) : -1;
    };
    if(sortDate){
      list.sort(function(a, b){
        return S.dayScore(forecasts[a.id], dayIdx(a)) - S.dayScore(forecasts[b.id], dayIdx(b));
      });
    }else{
      list.sort(function(a, b){ return b.lat - a.lat; });
    }
    return list;
  }

  function dateColumns(){
    var any = null;
    for(var id in forecasts){ if(forecasts[id] && forecasts[id].daily){ any = forecasts[id]; break; } }
    return any ? any.daily.time : [];
  }

  function cellHtml(data, i, iso){
    if(!data || !data.daily) return '<td class="mx-cell empty">–</td>';
    var d = data.daily;
    var w = S.WMO[d.weathercode[i]] || ["🌡️","-"];
    var pop = d.precipitation_probability_max ? d.precipitation_probability_max[i] : null;
    var title = S.fmtDate(iso) + " " + S.fmtWeekday(iso) + "  " + w[1] + "  " +
      Math.round(d.temperature_2m_max[i]) + "° / " + Math.round(d.temperature_2m_min[i]) + "°  " +
      t("popTitle") + " " + (pop === null || pop === undefined ? "–" : pop + "%");
    return '<td class="mx-cell" title="' + S.esc(title) + '">' +
      '<span class="icon">' + w[0] + '</span>' +
      '<span class="pop ' + S.classify(pop) + '">' + (pop === null || pop === undefined ? "–" : pop + "%") + '</span>' +
      '<span class="hi">' + Math.round(d.temperature_2m_max[i]) + '°</span></td>';
  }

  function render(){
    renderHiddenNote();
    S.fillPrefSelect(prefSelect, locations);
    var list = shownLocations();
    shownLabel.textContent = t("shown", list.length);
    if(!list.length){
      matrixEl.innerHTML = '<p class="hint" style="padding:16px;">' + S.esc(S.emptyMessage()) + '</p>';
      return;
    }
    var dates = dateColumns();
    var html = '<table class="matrix"><thead><tr><th class="crag-col"></th>';
    dates.forEach(function(iso){
      var dow = S.dowOf(iso);
      html += '<th class="date-col' + (dow === 0 || dow === 6 ? " weekend" : "") + (iso === sortDate ? " sorted" : "") +
        '" data-sort="' + iso + '" title="' + S.esc(t("sortRain")) + '"><span class="wd">' + S.fmtWeekday(iso) + '</span><span class="dt">' + S.fmtDate(iso) + '</span></th>';
    });
    html += '</tr></thead><tbody>';
    list.forEach(function(loc){
      var removeBtn = editor && editor.isEditMode() ? '<button class="icon-btn" data-remove="' + loc.id + '">' + t("remove") + '</button>' : "";
      var data = forecasts[loc.id];
      html += '<tr id="card-' + loc.id + '"><th class="crag-col"><div class="crag-name">' + S.starBtnHtml(loc.id) +
        '<span class="nm">' + S.esc(S.nm(loc)) + '</span></div><div class="rg">' + S.esc(S.rg(loc)) + '</div>' + removeBtn + '</th>';
      dates.forEach(function(iso, k){
        var idx = data && data.daily ? data.daily.time.indexOf(iso) : -1;
        html += idx === -1 ? '<td class="mx-cell empty">–</td>' : cellHtml(data, idx, iso);
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    matrixEl.innerHTML = html;
  }

  function loadAll(){
    var visible = S.visibleOf(locations);
    if(!visible.length){
      render();
      updatedLabel.textContent = S.emptyMessage();
      return;
    }
    updatedLabel.textContent = t("fetching");
    refreshBtn.disabled = true;
    S.getForecasts(visible, 16).then(function(result){
      forecasts = result.map;
      render();
      updatedLabel.innerHTML = t("updated") + " <b>" + S.fmtUpdated(result.generatedAt) + "</b>";
      refreshBtn.disabled = false;
    }).catch(function(){
      forecasts = {};
      render();
      updatedLabel.textContent = t("fail");
      refreshBtn.disabled = false;
    });
  }

  matrixEl.addEventListener("click", function(e){
    var th = e.target.closest("th[data-sort]");
    if(th){
      var iso = th.getAttribute("data-sort");
      sortDate = (sortDate === iso) ? null : iso;
      render();
      return;
    }
    var removeId = e.target.getAttribute("data-remove");
    if(removeId){
      editor.removeOrHide(removeId);
      S.loadCrags().then(function(all){ locations = all; loadAll(); });
    }
  });

  refreshBtn.addEventListener("click", loadAll);
  prefSelect.addEventListener("change", render);
  queryInput.addEventListener("input", render);
  moreToggle.checked = S.loadJSON(MORE_KEY) !== false;
  moreToggle.addEventListener("change", function(){ S.saveJSON(MORE_KEY, moreToggle.checked); render(); });

  S.bindFavClicks(matrixEl, function(id, on){
    if(!on && S.loadFavOnly()) loadAll();
  });
  S.initFavToggle(document.getElementById("fav-toggle"), loadAll);

  editor = S.initEditor({
    addInput: addInput, searchBtn: searchBtn, cancelBtn: cancelAdd,
    resultsEl: searchResults, editToggle: editToggle, addPanel: addPanel,
    onChange: loadAll
  });
  S.initLangMemory();

  S.loadCrags().then(function(all){
    locations = all;
    loadAll();
  }).catch(function(){
    updatedLabel.textContent = t("cragsFail");
  });
})();
