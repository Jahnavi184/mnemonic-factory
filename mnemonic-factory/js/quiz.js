// ─── Quiz Mode ───────────────────────────────────────────────────────────────

let quizState = null;

function startQuiz(mnemonicId) {
  const entry = getMnemonicById(mnemonicId);
  if (!entry || !entry.items || entry.items.length === 0) {
    showToast('No items found for this mnemonic.');
    return;
  }

  quizState = {
    entry,
    items: entry.items,
    current: 0,
    answers: [],   // { given, correct, ok }
  };

  showPage('quiz');
  renderQuizStep();
}

function renderQuizStep() {
  const page = document.getElementById('page-quiz');
  const { items, current, entry } = quizState;
  const total = items.length;
  const progress = Math.round((current / total) * 100);

  page.innerHTML = `
    <div class="quiz-container">
      <div class="quiz-header">
        <button class="quiz-back-btn" onclick="showPage('saved')">← Back to Saved</button>
        <h2 class="quiz-title">Quiz Mode</h2>
        <p class="quiz-topic-label">Topic: <strong>${escHtml(entry.topic)}</strong></p>
      </div>

      <div class="quiz-progress-bar-track">
        <div class="quiz-progress-bar-fill" style="width: ${progress}%"></div>
      </div>

      <p class="quiz-step-label">Item ${current + 1} of ${total}</p>
      <p class="quiz-question">What is item #${current + 1}?</p>

      <div class="quiz-input-row">
        <input
          type="text"
          id="quiz-input"
          class="quiz-answer-input"
          placeholder="Type your answer…"
          autocomplete="off"
        />
        <button class="quiz-submit-btn" id="quiz-submit-btn">Check</button>
      </div>
      <p class="quiz-feedback" id="quiz-feedback"></p>
    </div>
  `;

  const input = document.getElementById('quiz-input');
  const submitBtn = document.getElementById('quiz-submit-btn');

  input.focus();

  function check() {
    const given = input.value.trim();
    if (!given) return;

    const correct = items[current];
    const ok = normalize(given) === normalize(correct);

    input.classList.add(ok ? 'correct' : 'wrong');
    input.disabled = true;
    submitBtn.disabled = true;

    const feedback = document.getElementById('quiz-feedback');
    feedback.className = 'quiz-feedback ' + (ok ? 'correct' : 'wrong');
    feedback.textContent = ok
      ? '✓ Correct!'
      : `✗ The answer was: "${correct}"`;

    quizState.answers.push({ given, correct, ok });

    setTimeout(() => {
      quizState.current++;
      if (quizState.current >= total) {
        renderQuizResults();
      } else {
        renderQuizStep();
      }
    }, 1200);
  }

  submitBtn.addEventListener('click', check);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
}

function renderQuizResults() {
  const page = document.getElementById('page-quiz');
  const { answers, entry } = quizState;
  const total = answers.length;
  const correct = answers.filter(a => a.ok).length;
  const pct = Math.round((correct / total) * 100);

  const rows = answers.map((a, i) => `
    <div class="result-row">
      <span class="result-dot ${a.ok ? 'correct' : 'wrong'}"></span>
      <span>#${i + 1} ${escHtml(a.correct)}</span>
      ${!a.ok ? `<span class="result-answer-correct">← you said: "${escHtml(a.given)}"</span>` : ''}
    </div>
  `).join('');

  page.innerHTML = `
    <div class="quiz-container">
      <div class="quiz-header">
        <button class="quiz-back-btn" onclick="showPage('saved')">← Back to Saved</button>
        <h2 class="quiz-title">Results</h2>
        <p class="quiz-topic-label">Topic: <strong>${escHtml(entry.topic)}</strong></p>
      </div>

      <div class="quiz-results">
        <div class="results-score">${pct}%</div>
        <p class="results-label">${correct} of ${total} correct</p>

        <div class="results-breakdown">
          <h4>Breakdown</h4>
          ${rows}
        </div>

        <button class="quiz-retry-btn" onclick="startQuiz('${entry.id}')">Try Again</button>
      </div>
    </div>
  `;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
