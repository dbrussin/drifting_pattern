// ─── UI-GROUPS ─────────────────────────────────────────────────────────────────
// Jump run group management: render cards, add/remove, persist state.
// Depends on: config (GROUP_TYPES), state, storage, calculate

// Group type → freefall fall rate (mph) and average glide ratio (movement only).
// FS, Student, Tandem all fall belly at ~120 mph; VFS is head-down at ~170 mph;
// Movement (tracking/angle) is ~140 mph average vertical with 0.8:1 horizontal glide.
const GROUP_TYPES = {
  FS:       { label: 'FS',       fallMph: 120, glide: 0,    isMovement: false },
  VFS:      { label: 'VFS',      fallMph: 170, glide: 0,    isMovement: false },
  Movement: { label: 'Movement', fallMph: 140, glide: 0.8,  isMovement: true  },
  Student:  { label: 'Student',  fallMph: 120, glide: 0,    isMovement: false },
  Tandem:   { label: 'Tandem',   fallMph: 120, glide: 0,    isMovement: false },
};

function renderGroups() {
  const container = document.getElementById('groups-container');
  if (!container) return;
  container.innerHTML = '';

  state.freefall.groups.forEach((g, idx) => {
    const card = document.createElement('div');
    card.className = 'group-card';
    const isMvmt = GROUP_TYPES[g.type]?.isMovement;
    const mvmtRow = isMvmt ? `
      <div class="group-row">
        <span class="group-field-label">Movement</span>
        <div class="group-mvmt-group">
          <button class="group-mvmt-btn${g.mvmt === 'L' ? ' active' : ''}" onclick="setGroupMvmt('${g.id}','L')">← L</button>
          <button class="group-mvmt-btn${g.mvmt === 'R' ? ' active' : ''}" onclick="setGroupMvmt('${g.id}','R')">R →</button>
        </div>
      </div>` : '';
    const typeOpts = Object.keys(GROUP_TYPES).map(k =>
      `<option value="${k}"${k === g.type ? ' selected' : ''}>${GROUP_TYPES[k].label}</option>`
    ).join('');
    card.innerHTML = `
      <div class="group-row">
        <span class="group-field-label">#${idx + 1}</span>
        <input class="group-name-input" type="text" value="${g.name}" placeholder="Group name"
          oninput="setGroupField('${g.id}','name',this.value)">
        <button class="leg-remove-btn" onclick="removeGroup('${g.id}')" title="Remove group">×</button>
      </div>
      <div class="group-row">
        <span class="group-field-label">Jumpers</span>
        <input class="group-num-input" type="number" min="1" max="20" step="1" value="${g.size}"
          oninput="setGroupField('${g.id}','size',this.value)">
        <span class="group-field-label">Type</span>
        <select class="group-type-select" onchange="setGroupField('${g.id}','type',this.value)">${typeOpts}</select>
      </div>
      ${mvmtRow}`;
    container.appendChild(card);
  });
}

function addGroup() {
  const idx = state.freefall.nextGroupIdx++;
  state.freefall.groups.push({
    id:   `g${idx}`,
    name: `Group ${idx}`,
    size: 4,
    type: 'FS',
    mvmt: 'R',
  });
  renderGroups();
  saveSettings();
  if (state.target) calculate();
}

function removeGroup(id) {
  const i = state.freefall.groups.findIndex(g => g.id === id);
  if (i === -1) return;
  state.freefall.groups.splice(i, 1);
  renderGroups();
  saveSettings();
  if (state.target) calculate();
}

function setGroupField(id, field, value) {
  const g = state.freefall.groups.find(x => x.id === id);
  if (!g) return;
  if (field === 'size') {
    const n = Math.max(1, Math.min(20, parseInt(value) || 1));
    g.size = n;
  } else if (field === 'type') {
    g.type = GROUP_TYPES[value] ? value : 'FS';
    renderGroups(); // movement row visibility may change
  } else if (field === 'name') {
    g.name = String(value).slice(0, 32);
  }
  saveSettings();
  if (state.target) calculate();
}

function setGroupMvmt(id, dir) {
  const g = state.freefall.groups.find(x => x.id === id);
  if (!g) return;
  g.mvmt = dir === 'L' ? 'L' : 'R';
  renderGroups();
  saveSettings();
  if (state.target) calculate();
}

renderGroups();
