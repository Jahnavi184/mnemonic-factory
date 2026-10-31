// ─── Backend API ─────────────────────────────────────────────────────────────
// All Gemini calls go through our Python backend.
// The API key never touches the browser.

async function callBackend(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data;
}

async function generateMnemonics(topic) {
  return callBackend('/api/generate', { topic });
}

async function regenerateOne(topic, items, type) {
  return callBackend('/api/regenerate', { topic, items, type });
}
