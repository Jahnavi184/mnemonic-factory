// ─── localStorage helpers ────────────────────────────────────────────────────

const STORAGE_KEY = 'mnemo_saved';

function getSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveMnemonic({ topic, type, content, items }) {
  const saved = getSaved();
  const entry = {
    id: Date.now().toString(),
    topic,
    type,       // 'story' | 'acronym' | 'rhyme'
    content,
    items,
    savedAt: new Date().toISOString()
  };
  saved.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  return entry;
}

function deleteMnemonic(id) {
  const saved = getSaved().filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function getMnemonicById(id) {
  return getSaved().find(e => e.id === id) || null;
}
