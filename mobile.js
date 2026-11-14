// Phone page: pick a day, get the crags ranked for that day, best first.
// Tap a crag to see the days around it.
(function(){
  "use strict";
  var S = window.CragShared;
  var t = S.t;

  var locationsEl = document.getElementById("locations");
  var updatedLabel = document.getElementById("updated-label");
  var refreshBtn = document.getElementById("refresh-btn");
  var dateInput = document.getElementById("date-input");
  var quickEl = document.getElementById("quick-dates");
  var hiddenNote = document.getElementById("hidden-note");
  var editToggle = document.getElementById("edit-toggle");
  var addPanel = document.getElementById("add-panel");
  var addInput = document.getElementById("add-input");
  var searchBtn = document.getElementById("search-btn");
  var cancelAdd = document.getElementById("cancel-add");
  var searchResults = document.getElementById("search-results");
  var toDesktop = document.getElementById("to-desktop");
  var prefSelect = document.getElementById("pref-select");
  var moreBtn = document.getElementById("more-btn");

  var PAGE = 30;
  var locations = [];
  var forecasts = {};
  var editor = null;
  var limit = PAGE;
  var openId = null;

  // Coming back to the desktop list on purpose shouldn't immediately bounce
  // back here via its narrow-screen auto-redirect.
  if(toDesktop){
    toDesktop.addEventListener("click", function(){
      try{ sessionStorage.setItem("crag-weather-prefer-desktop", "1"); }catch(e){}
    });
  }

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

  function chosenDate(){ return dateInput.value || S.todayISO(); }

  function renderQuick(){
    var d = chosenDate();
    var items = [
      { label: t("today"), iso: S.todayISO() },
      { label: t("tomorrow"), iso: S.addDaysISO(S.todayISO(), 1) },
      { label: t("sat") + " " + S.fmtDate(S.nextDowISO(6)), iso: S.nextDowISO(6) },
      { label: t("sun") + " " + S.fmtDate(S.nextDowISO(0)), iso: S.nextDowISO(0) }
    ];
    // Leave out a shortcut whose date is already shown by an earlier one (on a weekend, Sat/Sun can be today).
    var seen = {};
    items = items.filter(function(it){ if(seen[it.iso]) return false; seen[it.iso] = true; return true; });
    quickEl.innerHTML = items.map(function(it){
      return '<button class="chip' + (it.iso === d ? " on" : "") + '" data-date="' + it.iso + '">' + S.esc(it.label) + '</button>';
    }).join("");
  }

  function stripHtml(data, iso){
    var d = data.daily;
    var center = d.time.indexOf(iso);
    if(center === -1) center = 0;
    var from = Math.max(0, center - 2), to = Math.min(d.time.length - 1, center + 2);
    var html = '<div class="strip fit" style="--cols:' + (to - from + 1) + '">';
    for(var i = from; i <= to; i++){
      html += S.dayCellHtml(d.time[i], d.weathercode[i], d.temperature_2m_max[i], d.temperature_2m_min[i],
        d.precipitation_probability_max ? d.precipitation_probability_max[i] : null);
    }
    return html + '</div>';
  }

  function render(){
    renderHiddenNote();
    renderQuick();
    S.fillPrefSelect(prefSelect, locations);
    var iso = chosenDate();
    var pref = prefSelect.value;
    var list = S.visibleOf(locations).filter(function(l){ return !pref || l.prefecture === pref; });
    var idxOf = function(loc){
      var d = forecasts[loc.id];
      return d && d.daily ? d.daily.time.indexOf(iso) : -1;
    };
    var scored = list.map(function(loc){
      return { loc: loc, score: S.dayScore(forecasts[loc.id], idxOf(loc)) };
    }).sort(function(a, b){ return a.score - b.score; });

    var shown = scored.slice(0, limit);
    locationsEl.innerHTML = "";
    shown.forEach(function(item, n){
      var loc = item.loc;
      var data = forecasts[loc.id];
      var i = idxOf(loc);
      var card = document.createElement("div");
      card.className = "card rank-card" + (openId === loc.id ? " open" : "");
      card.id = "card-" + loc.id;
      var removeBtn = editor && editor.isEditMode() ? '<button class="icon-btn" data-remove="' + loc.id + '">' + t("remove") + '</button>' : "";
      var summary;
      if(!data){
        summary = '<span class="rk-load">' + t("loading") + '</span>';
        card.classList.add("skeleton");
      }else if(!data.daily || i === -1){
        summary = '<span class="rk-load">' + t("failWeather") + '</span>';
      }else{
        var d = data.daily;
        var w = S.WMO[d.weathercode[i]] || ["🌡️","-"];
        var pop = d.precipitation_probability_max ? d.precipitation_probability_max[i] : null;
        summary = '<span class="rk-icon" title="' + S.esc(w[1]) + '">' + w[0] + '</span>' +
          '<span class="rk-temps"><b>' + Math.round(d.temperature_2m_max[i]) + '°</b>/' + Math.round(d.temperature_2m_min[i]) + '°</span>' +
          '<span class="pop ' + S.classify(pop) + '">' + (pop === null || pop === undefined ? "–" : pop + "%") + '</span>';
      }
      card.innerHTML =
        '<div class="rk-row" data-open="' + loc.id + '">' +
          '<span class="rk-n">' + (n + 1) + '</span>' +
          '<span class="rk-name">' + S.starBtnHtml(loc.id) + '<span class="nm">' + S.esc(S.nm(loc)) + '</span>' +
            '<span class="region">' + S.esc(S.rg(loc)) + '</span></span>' +
          '<span class="rk-sum">' + summary + '</span>' + removeBtn +
        '</div>' +
        (openId === loc.id && data && data.daily ? stripHtml(data, iso) : "");
      locationsEl.appendChild(card);
    });
    var rest = scored.length - shown.length;
    moreBtn.style.display = rest > 0 ? "block" : "none";
    moreBtn.textContent = t("moreN", rest);
    if(!scored.length) locationsEl.innerHTML = '<p class="hint">' + S.esc(S.emptyMessage()) + '</p>';
  }

  function loadAll(){
    var visible = S.visibleOf(locations);
    render();
    if(!visible.length){
      updatedLabel.textContent = S.emptyMessage();
      return;
    }
    updatedLabel.textContent = t("fetching");
    refreshBtn.disabled = true;
    S.getForecasts(visible, 16).then(function(result){
      forecasts = result.map;
      visible.forEach(function(loc){
        if(!forecasts[loc.id]) forecasts[loc.id] = { error: true };
      });
      var first = visible.map(function(loc){ return forecasts[loc.id]; }).filter(function(d){ return d && d.daily; })[0];
      if(first){
        dateInput.min = first.daily.time[0];
        dateInput.max = first.daily.time[first.daily.time.length - 1];
        if(!dateInput.value) dateInput.value = first.daily.time[0];
      }
      render();
      updatedLabel.innerHTML = t("updated") + " <b>" + S.fmtUpdated(result.generatedAt) + "</b>";
      refreshBtn.disabled = false;
    }).catch(function(){
      forecasts = {};
      visible.forEach(function(loc){ forecasts[loc.id] = {error:true}; });
      render();
      updatedLabel.textContent = t("fail");
      refreshBtn.disabled = false;
    });
  }

  dateInput.addEventListener("change", function(){ limit = PAGE; render(); });
  prefSelect.addEventListener("change", function(){ limit = PAGE; render(); });
  moreBtn.addEventListener("click", function(){ limit += PAGE; render(); });
  quickEl.addEventListener("click", function(e){
    var b = e.target.closest("[data-date]");
    if(!b) return;
    dateInput.value = b.getAttribute("data-date");
    limit = PAGE;
    render();
  });

  locationsEl.addEventListener("click", function(e){
    if(e.target.closest("[data-fav]")) return;
    var removeId = e.target.getAttribute("data-remove");
    if(removeId){
      editor.removeOrHide(removeId);
      S.loadCrags().then(function(all){ locations = all; loadAll(); });
      return;
    }
    var row = e.target.closest("[data-open]");
    if(row){
      var id = row.getAttribute("data-open");
      openId = (openId === id) ? null : id;
      render();
    }
  });

  refreshBtn.addEventListener("click", loadAll);

  S.bindFavClicks(locationsEl, function(id, on){
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
