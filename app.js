(function(){
  "use strict";
  var S = window.CragShared;

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

  var locations = [];
  var editor = null;

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

  function renderSkeleton(){
    locationsEl.innerHTML = "";
    var visible = S.visibleOf(locations);
    visible.forEach(function(loc){
      var card = document.createElement("div");
      card.className = "card skeleton";
      card.id = "card-" + loc.id;
      var removeBtn = editor && editor.isEditMode() ? '<button class="icon-btn" data-remove="' + loc.id + '">✕ 削除</button>' : '';
      card.innerHTML =
        '<div class="card-head"><div class="card-title"><h2>' + loc.name + '</h2>' +
        '<span class="region">' + loc.region + '</span></div>' + removeBtn + '</div>' +
        '<div class="strip">' + '<div class="day"></div>'.repeat(7) + '</div>';
      locationsEl.appendChild(card);
    });
    countLabel.textContent = locations.length;
    renderHiddenNote();
  }

  function renderCard(loc, data, error){
    var card = document.getElementById("card-" + loc.id);
    if(!card) return;
    card.classList.remove("skeleton");
    var removeBtn = editor && editor.isEditMode() ? '<button class="icon-btn" data-remove="' + loc.id + '">✕ 削除</button>' : "";
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
      html += S.dayCellHtml(
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

  function loadAll(){
    renderSkeleton();
    var visible = S.visibleOf(locations);
    if(!visible.length){
      updatedLabel.textContent = "表示中の地点がありません";
      return;
    }
    updatedLabel.textContent = "取得中…";
    refreshBtn.disabled = true;
    S.fetchForecastBatch(visible, 16).then(function(results){
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
    loadAll();
  }

  // Scrolling one crag's day-strip scrolls every other crag's strip to match,
  // so you can compare the same dates across all cards. Delegated + capturing
  // because "scroll" doesn't bubble, and cards are re-created on every render.
  var syncing = false;
  locationsEl.addEventListener("scroll", function(e){
    var t = e.target;
    if(!t.classList || !t.classList.contains("strip")) return;
    if(syncing) return;
    syncing = true;
    var val = t.scrollLeft;
    Array.prototype.forEach.call(locationsEl.querySelectorAll(".strip"), function(s){
      if(s !== t) s.scrollLeft = val;
    });
    syncing = false;
  }, true);

  locationsEl.addEventListener("click", function(e){
    var retryId = e.target.getAttribute("data-retry");
    if(retryId){
      var loc = locations.find(function(l){ return l.id === retryId; });
      if(loc){
        var card = document.getElementById("card-" + loc.id);
        card.classList.add("skeleton");
        S.fetchForecastOne(loc, 16).then(function(data){ renderCard(loc, data, null); })
          .catch(function(){ renderCard(loc, null, true); });
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
