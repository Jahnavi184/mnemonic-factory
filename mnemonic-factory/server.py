import os
import re
import sys
import json
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_ENDPOINT = (
    'https://generativelanguage.googleapis.com/v1beta'
    '/models/gemini-3.8-flash:generateContent'
)


# ─── Shared helpers ──────────────────────────────────────────────────────────

def call_gemini(prompt):
    """Call Gemini and return the raw text response, or raise on error."""
    print(f'Calling Gemini. API key prefix: {GEMINI_API_KEY[:8]}...', flush=True)
    resp = requests.post(
        f'{GEMINI_ENDPOINT}?key={GEMINI_API_KEY}',
        json={
            'contents': [{'parts': [{'text': prompt}]}],
            'generationConfig': {'temperature': 0.9, 'maxOutputTokens': 1024}
        },
        timeout=60
    )
    print(f'Gemini status: {resp.status_code}', flush=True)
    print(f'Gemini response: {resp.text[:800]}', flush=True)

    if not resp.ok:
        err_data = resp.json().get('error', {})
        err_msg  = err_data.get('message', f'HTTP {resp.status_code}')
        status   = resp.status_code
        raise GeminiError(err_msg, status)

    text = (resp.json()
            .get('candidates', [{}])[0]
            .get('content', {})
            .get('parts', [{}])[0]
            .get('text', ''))
    return text


def parse_json(text):
    """Strip markdown fences and parse JSON from Gemini text."""
    cleaned = text.replace('```json', '').replace('```', '').strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r'\{[\s\S]*\}', cleaned)
        if match:
            return json.loads(match.group())
        raise ValueError('Could not parse AI response. Please try again.')


class GeminiError(Exception):
    def __init__(self, message, status_code=502):
        super().__init__(message)
        self.status_code = status_code


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return app.send_static_file('index.html')


@app.route('/api/generate', methods=['POST'])
def generate():
    try:
        if not GEMINI_API_KEY:
            return jsonify({'error': 'GEMINI_API_KEY not set in .env'}), 500

        data  = request.get_json()
        topic = (data or {}).get('topic', '').strip()
        if not topic:
            return jsonify({'error': 'No topic provided'}), 400

        prompt = f"""You are a creative memory coach. The user wants to remember: "{topic}".

First, extract the ordered list of items from the topic (e.g. "seven layers of OSI" -> Physical, Data Link, Network, Transport, Session, Presentation, Application).

Then produce exactly three mnemonics. Return ONLY raw JSON, no markdown:
{{
  "items": ["item1", "item2", ...],
  "story": "A vivid story weaving ALL items in order. Exactly 3-4 sentences.",
  "acronym": "One single line: the acronym letters followed by what each stands for.",
  "rhyme": "A catchy rhyme encoding all items in order. Exactly 2-4 lines."
}}"""

        text   = call_gemini(prompt)
        result = parse_json(text)
        return jsonify(result)

    except GeminiError as e:
        return jsonify({'error': str(e)}), e.status_code
    except Exception as e:
        import traceback
        print('EXCEPTION /generate:', traceback.format_exc(), flush=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/regenerate', methods=['POST'])
def regenerate():
    """Regenerate a single mnemonic type for an existing topic+items list."""
    try:
        if not GEMINI_API_KEY:
            return jsonify({'error': 'GEMINI_API_KEY not set in .env'}), 500

        data      = request.get_json() or {}
        topic     = data.get('topic', '').strip()
        items     = data.get('items', [])
        mnem_type = data.get('type', '').strip()   # story | acronym | rhyme

        if not topic or not items or mnem_type not in ('story', 'acronym', 'rhyme'):
            return jsonify({'error': 'topic, items, and a valid type are required'}), 400

        items_str = ', '.join(items)

        if mnem_type == 'story':
            instruction = 'A vivid story weaving ALL items in order. Exactly 3-4 sentences. Make it different from the previous one.'
        elif mnem_type == 'acronym':
            instruction = 'One single line: the acronym letters followed by what each stands for. Make it different from the previous one.'
        else:
            instruction = 'A catchy rhyme encoding all items in order. Exactly 2-4 lines. Make it different from the previous one.'

        prompt = f"""You are a creative memory coach.
Topic: "{topic}"
Items in order: {items_str}

Generate a NEW {mnem_type} mnemonic for these items.
{instruction}

Return ONLY raw JSON, no markdown:
{{"{mnem_type}": "your mnemonic here"}}"""

        text   = call_gemini(prompt)
        result = parse_json(text)

        if mnem_type not in result:
            return jsonify({'error': 'Unexpected response format. Please try again.'}), 500

        return jsonify({mnem_type: result[mnem_type]})

    except GeminiError as e:
        return jsonify({'error': str(e)}), e.status_code
    except Exception as e:
        import traceback
        print('EXCEPTION /regenerate:', traceback.format_exc(), flush=True)
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    debug = os.environ.get('RENDER') is None  # debug off on Render
    print(f'\n🏭  Mnemonic Factory server running at http://localhost:{port}\n')
    app.run(host='0.0.0.0', port=port, debug=debug, use_reloader=False)
