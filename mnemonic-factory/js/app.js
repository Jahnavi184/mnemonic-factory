// ─── App Controller ──────────────────────────────────────────────────────────

let currentResult = null; // last generated mnemonics
let isLoading     = false; // global request lock

// ─── Theme toggle ─────────────────────────────────────────────────────────────

const themeToggle = document.getElementById('theme-toggle');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('mnemo_theme', theme);
}

applyTheme(localStorage.getItem('mnemo_theme') || 'dark');

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ─── Page routing ─────────────────────────────────────────────────────────────

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');

  const btn = document.querySelector(`.nav-btn[data-page="${name}"]`);
  if (btn) btn.classList.add('active');

  if (name === 'saved') renderSavedPage();
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => showPage(btn.dataset.page));
});

// ─── Loading lock ─────────────────────────────────────────────────────────────

function setLoading(on) {
  isLoading = on;
  generateBtn.disabled = on;
  document.querySelectorAll('.try-another-btn').forEach(b => b.disabled = on);
}

// ─── Generate flow ────────────────────────────────────────────────────────────

const generateBtn = document.getElementById('generate-btn');
const btnText     = document.getElementById('btn-text');
const btnSpinner  = document.getElementById('btn-spinner');
const topicInput  = document.getElementById('topic-input');
const cardsArea   = document.getElementById('cards-area');

generateBtn.addEventListener('click', handleGenerate);
topicInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleGenerate();
});

async function handleGenerate() {
  if (isLoading) return;

  const topic = topicInput.value.trim();
  if (!topic) { showToast('Please enter a topic first.'); return; }

  // ── Feature 4: 15-item cap on raw input ──────────────────────────────────
  // Split on common separators and count non-empty tokens
  const rawItems = topic.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  if (rawItems.length > 15) {
    showToast(`That's ${rawItems.length} items — please shorten your list to 15 or fewer.`);
    return;
  }

  setLoading(true);
  btnText.classList.add('hidden');
  btnSpinner.classList.remove('hidden');
  cardsArea.classList.add('hidden');
  clearWarnings();
  document.querySelectorAll('.one-sticks-btn').forEach(b => {
    b.classList.remove('saved');
    b.textContent = '★ One Sticks';
  });

  try {
    const result = await generateMnemonics(topic);
    currentResult = { topic, ...result };
    renderCards(result);
    checkCoverage();
    cardsArea.classList.remove('hidden');
  } catch (err) {
    showToast(friendlyError(err.message));
  } finally {
    setLoading(false);
    btnText.classList.remove('hidden');
    btnSpinner.classList.add('hidden');
  }
}

function renderCards(result) {
  document.getElementById('story-text').textContent   = result.story   || '';
  document.getElementById('acronym-text').textContent = result.acronym || '';
  document.getElementById('rhyme-text').textContent   = result.rhyme   || '';
}

// ─── Try another ─────────────────────────────────────────────────────────────

document.querySelectorAll('.try-another-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (isLoading || !currentResult) return;

    const type = btn.dataset.type;

    setLoading(true);
    const originalText = btn.textContent;
    btn.textContent = '…';

    // clear the saved state on the matching One Sticks button
    const sticksBtn = btn.closest('.card-actions').querySelector('.one-sticks-btn');
    sticksBtn.classList.remove('saved');
    sticksBtn.textContent = '★ One Sticks';

    try {
      const result = await regenerateOne(currentResult.topic, currentResult.items, type);
      currentResult[type] = result[type];
      document.getElementById(`${type}-text`).textContent = result[type] || '';
      // re-run coverage check for story and rhyme
      if (type === 'story' || type === 'rhyme') checkCoverageFor(type);
    } catch (err) {
      showToast(friendlyError(err.message));
    } finally {
      setLoading(false);
      btn.textContent = originalText;
    }
  });
});

// ─── Coverage check ───────────────────────────────────────────────────────────
// Checks story and rhyme only. Compares against currentResult.items.

function normalizeStr(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function checkCoverage() {
  ['story', 'rhyme'].forEach(type => checkCoverageFor(type));
}

function checkCoverageFor(type) {
  const warningEl = document.getElementById(`${type}-warning`);
  if (!warningEl || !currentResult) return;

  const items   = currentResult.items || [];
  const text    = normalizeStr(currentResult[type] || '');
  const missing = items.filter(item => !text.includes(normalizeStr(item)));

  if (missing.length > 0) {
    warningEl.textContent = `⚠ Might be missing: ${missing.join(', ')}`;
    warningEl.classList.remove('hidden');
  } else {
    warningEl.textContent = '';
    warningEl.classList.add('hidden');
  }
}

function clearWarnings() {
  document.querySelectorAll('.coverage-warning').forEach(el => {
    el.textContent = '';
    el.classList.add('hidden');
  });
}

// ─── One Sticks ──────────────────────────────────────────────────────────────

document.querySelectorAll('.one-sticks-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!currentResult) return;

    const type    = btn.dataset.type;
    const content = currentResult[type];
    if (!content) return;

    if (btn.classList.contains('saved')) {
      showToast('Already saved!');
      return;
    }

    saveMnemonic({
      topic:   currentResult.topic,
      type,
      content,
      items:   currentResult.items || []
    });

    btn.classList.add('saved');
    btn.textContent = '★ Saved!';
    showToast(`${capitalize(type)} saved to your collection ✓`);
  });
});

// ─── Saved page ───────────────────────────────────────────────────────────────

function renderSavedPage() {
  const list  = document.getElementById('saved-list');
  const saved = getSaved();

  if (saved.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🗂️</div>
        <p>No saved mnemonics yet.<br>Generate some and hit <strong>One Sticks</strong>!</p>
      </div>`;
    return;
  }

  list.innerHTML = saved.map(entry => `
    <div class="saved-card" id="sc-${entry.id}">
      <div class="saved-meta">
        <span class="saved-topic">${escHtml(entry.topic)}</span>
        <span class="saved-badge badge--${entry.type}">${entry.type}</span>
      </div>
      <p class="saved-preview">${escHtml(entry.content)}</p>
      <div class="saved-actions">
        <button class="quiz-launch-btn" onclick="startQuiz('${entry.id}')">🧠 Quiz Me</button>
        <button class="delete-btn" onclick="handleDelete('${entry.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function handleDelete(id) {
  deleteMnemonic(id);
  const el = document.getElementById(`sc-${id}`);
  if (el) el.remove();
  if (getSaved().length === 0) renderSavedPage();
  showToast('Deleted.');
}

// ─── Toast ────────────────────────────────────────────────────────────────────

const toast = document.createElement('div');
toast.className = 'toast';
document.body.appendChild(toast);

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─── Friendly error messages ──────────────────────────────────────────────────

function friendlyError(msg) {
  if (!msg) return 'Something went wrong. Please try again.';
  const m = msg.toLowerCase();
  if (
    m.includes('429') || m.includes('quota') || m.includes('rate') ||
    m.includes('resource_exhausted') || m.includes('503') ||
    m.includes('unavailable') || m.includes('high demand')
  ) {
    return 'Gemini is busy right now — please try again in a minute.';
  }
  return 'Something went wrong. Please try again.';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
