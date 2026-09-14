(function(){
  "use strict";
  var S = window.CragShared;

  var locationsEl = document.getElementById("locations");
  var jumpRow = document.getElementById("jump-row");
  var updatedLabel = document.getElementById("updated-label");
  var refreshBtn = document.getElementById("refresh-btn");
  var dateInput = document.getElementById("date-input");
  var hiddenNote = document.getElementById("hidden-note");
  var editToggle = document.getElementById("edit-toggle");
  var addPanel = document.getElementById("add-panel");
  var addInput = document.getElementById("add-input");
  var searchBtn = document.getElementById("search-btn");
  var cancelAdd = document.getElementById("cancel-add");
  var searchResults = document.getElementById("search-results");
  var toDesktop = document.getElementById("to-desktop");

  var locations = [];
  var forecasts = {};
  var editor = null;

  // Coming back to the desktop list on purpose shouldn't immediately bounce
  // back here via its narrow-screen auto-redirect.
  toDesktop.addEventListener("click", function(){
    try{ sessionStorage.setItem("crag-weather-prefer-desktop", "1"); }catch(e){}
  });

  function renderHiddenNote(){
    var hidden = S.loadHidden();
    if(hidden.length === 0){ hiddenNote.style.display = "none"; return; }
    hiddenNote.style.display = "inline";
    hiddenNote.innerHTML = "非表示 " + hidden.length + "件";
    var btn = document.createElement("button");
    btn.className = "ghost";
    btn.textContent = "すべて表示";
    btn.addEventListener("click", function(){
      S.saveHidden([]);
      render();
    });
    hiddenNote.appendChild(btn);
  }

  function renderJumpRow(){
    var visible = S.visibleOf(locations);
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

  function windowRange(){
    var d = dateInput.value || S.todayISO();
    return { start: S.addDaysISO(d, -2), end: S.addDaysISO(d, 2) };
  }

  function renderCards(){
    var visible = S.visibleOf(locations);
    var range = windowRange();
    locationsEl.innerHTML = "";
    visible.forEach(function(loc){
      var card = document.createElement("div");
      card.className = "card";
      card.id = "card-" + loc.id;
      var removeBtn = editor && editor.isEditMode() ? '<button class="icon-btn" data-remove="' + loc.id + '">✕ 削除</button>' : "";
      var head = '<div class="card-head"><div class="card-title"><h2>' + loc.name + '</h2>' +
        '<span class="region">' + loc.region + '</span></div>' + removeBtn + '</div>';
      var data = forecasts[loc.id];
      var body;
      if(!data){
        body = '<div class="strip">' + '<div class="day"></div>'.repeat(5) + '</div>';
        card.classList.add("skeleton");
      }else if(data.error){
        body = '<div class="row-error"><span>天気の取得に失敗しました</span>' +
          '<button data-retry="' + loc.id + '">再試行</button></div>';
      }else{
        var d = data.daily;
        var idxs = [];
        for(var i=0;i<d.time.length;i++){
          if(d.time[i] >= range.start && d.time[i] <= range.end) idxs.push(i);
        }
        var cols = Math.max(idxs.length, 1);
        var html = '<div class="strip fit" style="--cols:' + cols + '">';
        idxs.forEach(function(i){
          html += S.dayCellHtml(
            d.time[i], d.weathercode[i], d.temperature_2m_max[i], d.temperature_2m_min[i],
            d.precipitation_probability_max ? d.precipitation_probability_max[i] : null
          );
        });
        html += '</div>';
        body = html;
      }
      card.innerHTML = head + body;
      locationsEl.appendChild(card);
    });
  }

  function loadAll(){
    renderJumpRow();
    renderHiddenNote();
    var visible = S.visibleOf(locations);
    renderCards();
    if(!visible.length){
      updatedLabel.textContent = "表示中の地点がありません";
      return;
    }
    updatedLabel.textContent = "取得中…";
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
      renderCards();
      updatedLabel.innerHTML = "最終更新 <b>" + S.fmtUpdated(result.generatedAt) + "</b>";
      refreshBtn.disabled = false;
    }).catch(function(){
      forecasts = {};
      visible.forEach(function(loc){ forecasts[loc.id] = {error:true}; });
      renderCards();
      updatedLabel.textContent = "取得に失敗しました";
      refreshBtn.disabled = false;
    });
  }

  function render(){ loadAll(); }

  dateInput.addEventListener("change", renderCards);

  locationsEl.addEventListener("click", function(e){
    var retryId = e.target.getAttribute("data-retry");
    if(retryId){
      var loc = locations.find(function(l){ return l.id === retryId; });
      if(loc){
        S.fetchForecastOne(loc, 16).then(function(data){ forecasts[loc.id] = data; renderCards(); })
          .catch(function(){ forecasts[loc.id] = {error:true}; renderCards(); });
      }
      return;
    }
    var removeId = e.target.getAttribute("data-remove");
    if(removeId){
      editor.removeOrHide(removeId);
      S.loadCrags().then(function(all){ locations = all; render(); });
    }
  });

  refreshBtn.addEventListener("click", loadAll);

  editor = S.initEditor({
    addInput: addInput, searchBtn: searchBtn, cancelBtn: cancelAdd,
    resultsEl: searchResults, editToggle: editToggle, addPanel: addPanel,
    onChange: render
  });

  S.loadCrags().then(function(all){
    locations = all;
    render();
  }).catch(function(){
    updatedLabel.textContent = "crags.json の読み込みに失敗しました";
  });
})();
