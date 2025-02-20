import logging
from flask import Flask, request, jsonify, render_template
import openai
import os
import json
import time
from dotenv import load_dotenv

logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")
load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')
openai.api_key = os.getenv("OPENAI_API_KEY")
ASSISTANT_ID = os.getenv("ASSISTANT_ID")
CSV_PATH = "contextvragen.csv"

def parse_assistant_output(raw_text: str):
    start_tag = "---JSON-START---"
    end_tag = "---JSON-END---"
    text_part = raw_text
    json_part = None
    if start_tag in raw_text and end_tag in raw_text:
        before_json, after_start = raw_text.split(start_tag, 1)
        json_section, after_end = after_start.split(end_tag, 1)
        text_part = before_json.strip()
        try:
            json_part = json.loads(json_section.strip())
        except json.JSONDecodeError:
            pass
    return text_part, json_part

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/start', methods=['POST'])
def start():
    try:
        logging.info("Ontvangen POST-verzoek voor /start")
        thread = openai.beta.threads.create()
        thread_id = thread.id
        openai.beta.threads.messages.create(thread_id=thread_id, role="user", content="START")
        if os.path.exists(CSV_PATH):
            with open(CSV_PATH, "r", encoding="utf-8") as file:
                csv_data = file.read()
            openai.beta.threads.messages.create(
                thread_id=thread_id,
                role="user",
                content=f"Hier is de dataset in CSV-formaat: \n\n{csv_data}"
            )
        else:
            return jsonify({'reply': 'Fout: CSV-bestand niet gevonden'}), 500
        run = openai.beta.threads.runs.create(thread_id=thread_id, assistant_id=ASSISTANT_ID)
        start_time = time.time()
        while True:
            run_status = openai.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)
            if run_status.status == "completed":
                messages = openai.beta.threads.messages.list(thread_id=thread_id)
                first_real_message = messages.data[0].content[0].text.value.strip()
                text_part, json_part = parse_assistant_output(first_real_message)
                if json_part:
                    return jsonify({
                        'assistant_text': text_part,
                        'assistant_json': json_part,
                        'thread_id': thread_id
                    })
                else:
                    return jsonify({
                        'assistant_text': text_part,
                        'thread_id': thread_id
                    })
            if time.time() - start_time > 25:
                return jsonify({'reply': 'API-response duurde te lang'}), 504
            time.sleep(2)
    except Exception as e:
        return jsonify({'reply': 'Er is een fout opgetreden.', 'error': str(e)}), 500

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        thread_id = data.get('thread_id')
        user_message = data.get('message')
        if not thread_id:
            return jsonify({'reply': 'Geen actieve sessie. Probeer opnieuw.'}), 400
        openai.beta.threads.messages.create(thread_id=thread_id, role="user", content=user_message)
        run = openai.beta.threads.runs.create(thread_id=thread_id, assistant_id=ASSISTANT_ID)
        start_time = time.time()
        while True:
            run_status = openai.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)
            if run_status.status == "completed":
                messages = openai.beta.threads.messages.list(thread_id=thread_id)
                last_message = messages.data[0].content[0].text.value.strip()
                text_part, json_part = parse_assistant_output(last_message)
                if json_part:
                    return jsonify({
                        'assistant_text': text_part,
                        'assistant_json': json_part
                    })
                else:
                    return jsonify({'assistant_text': text_part})
            if time.time() - start_time > 25:
                return jsonify({'reply': 'API-response duurde te lang'}), 504
            time.sleep(2)
    except Exception as e:
        return jsonify({'reply': 'Er is een fout opgetreden.', 'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, threaded=True)
