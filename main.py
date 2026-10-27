"""OBA interview application (OpenAI Responses + Conversations API)."""

import json
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request
from openai import OpenAI

load_dotenv()
logging.basicConfig(level=logging.INFO)

BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "contextvragen.csv"
PROMPT_PATH = BASE_DIR / "interview_instructions.txt"
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

app = Flask(__name__, static_folder="static", template_folder="templates")


def get_client():
    """Create on demand, so missing deployment configuration is logged clearly."""
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY ontbreekt in de omgevingsvariabelen")
    # Keep requests within the application's original ~25-second response window.
    return OpenAI(timeout=23.0, max_retries=0)


def get_instructions():
    """Load locally editable instructions and the questionnaire for every turn."""
    prompt = PROMPT_PATH.read_text(encoding="utf-8")
    csv_data = CSV_PATH.read_text(encoding="utf-8-sig")
    return f"{prompt}\n\nVRAGENLIJST (CSV, puntkomma-gescheiden):\n{csv_data}"


def parse_assistant_output(raw_text: str):
    """Preserve the response format expected by the existing front end."""
    start_tag, end_tag = "---JSON-START---", "---JSON-END---"
    raw_text = (raw_text or "").strip()
    if start_tag not in raw_text or end_tag not in raw_text:
        return raw_text, None

    before_json, rest = raw_text.split(start_tag, 1)
    json_section, _ = rest.split(end_tag, 1)
    try:
        question = json.loads(json_section.strip())
    except json.JSONDecodeError:
        app.logger.warning("Ongeldige JSON in interviewrespons")
        return raw_text, None

    if not isinstance(question, dict) or not isinstance(question.get("vraag"), str):
        app.logger.warning("Ongeldige vraagstructuur in interviewrespons")
        return raw_text, None

    return before_json.strip(), question


def make_reply(response, conversation_id=None):
    """Convert a Responses API result to the JSON the browser uses."""
    if response.status != "completed":
        raise RuntimeError(f"OpenAI response niet voltooid: {response.status}")
    text, question = parse_assistant_output(response.output_text)
    if not text and not question:
        raise RuntimeError("OpenAI gaf geen leesbaar antwoord terug")

    payload = {"assistant_text": text}
    if question is not None:
        payload["assistant_json"] = question
    if conversation_id is not None:
        # `thread_id` is a compatibility alias for older cached browsers.
        payload["conversation_id"] = conversation_id
        payload["thread_id"] = conversation_id
    return jsonify(payload)


def api_error(error):
    app.logger.exception("Interview-API-fout")
    # Avoid leaking credentials or internal exception details to survey participants.
    return jsonify({"reply": "Er is een fout opgetreden bij de interviewservice."}), 502


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/start", methods=["POST"])
def start():
    try:
        instructions = get_instructions()
        client = get_client()
        conversation = client.conversations.create()
        response = client.responses.create(
            model=OPENAI_MODEL,
            conversation=conversation.id,
            instructions=instructions,
            input="START. Begin het interview met de eerste vraag.",
            max_output_tokens=700,
        )
        return make_reply(response, conversation.id)
    except Exception as error:
        return api_error(error)


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"reply": "Ongeldig JSON-verzoek."}), 400

    conversation_id = data.get("conversation_id") or data.get("thread_id")
    message = data.get("message")
    if not isinstance(conversation_id, str) or not conversation_id.strip():
        return jsonify({"reply": "Geen actieve sessie. Probeer opnieuw."}), 400
    if not isinstance(message, str) or not message.strip():
        return jsonify({"reply": "Er is geen antwoord ingevuld."}), 400
    if len(message) > 4000:
        return jsonify({"reply": "Het antwoord is te lang."}), 400

    try:
        client = get_client()
        response = client.responses.create(
            model=OPENAI_MODEL,
            conversation=conversation_id,
            instructions=get_instructions(),
            input=message.strip(),
            max_output_tokens=700,
        )
        return make_reply(response)
    except Exception as error:
        return api_error(error)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    app.run(host="0.0.0.0", port=port, threaded=True)
