from flask import Flask, request, jsonify, render_template
import openai
import os
import json
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')

openai.api_key = os.getenv("OPENAI_API_KEY")
ASSISTANT_ID = os.getenv("ASSISTANT_ID")
CSV_PATH = "contextvragen.csv"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/start', methods=['POST'])
def start():
    try:
        thread = openai.beta.threads.create()
        thread_id = thread.id

        openai.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content="START"
        )

        if os.path.exists(CSV_PATH):
            with open(CSV_PATH, "r", encoding="utf-8") as file:
                csv_data = file.read()

            openai.beta.threads.messages.create(
                thread_id=thread_id,
                role="user",
                content=f"""Hier is de dataset in CSV-formaat. Gebruik deze om het interview te structureren. 
                {csv_data}"""
            )
        else:
            return jsonify({'reply': 'Fout: CSV-bestand niet gevonden'}), 500

        run = openai.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=ASSISTANT_ID
        )

        while True:
            run_status = openai.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)
            if run_status.status == "completed":
                messages = openai.beta.threads.messages.list(thread_id=thread_id)
                response_text = messages.data[0].content[0].text.value.strip()

                try:
                    response_data = json.loads(response_text)
                    return jsonify({
                        'user_message': response_data["vraag"],
                        'system_message': response_data,
                        'thread_id': thread_id
                    })
                except json.JSONDecodeError:
                    return jsonify({'error': 'Fout: OpenAI heeft geen geldige JSON teruggegeven', 'raw_response': response_text})

    except Exception as e:
        return jsonify({'reply': 'Er is een fout opgetreden.', 'error': str(e)}), 500

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        thread_id = data.get('thread_id')
        user_message = data.get('message')

        openai.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=user_message
        )

        run = openai.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=ASSISTANT_ID
        )

        while True:
            run_status = openai.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)
            if run_status.status == "completed":
                messages = openai.beta.threads.messages.list(thread_id=thread_id)
                response_text = messages.data[0].content[0].text.value.strip()

                try:
                    response_data = json.loads(response_text)
                    return jsonify({
                        'user_message': response_data["vraag"],
                        'system_message': response_data
                    })
                except json.JSONDecodeError:
                    return jsonify({'error': 'Fout: OpenAI heeft geen geldige JSON teruggegeven', 'raw_response': response_text})

    except Exception as e:
        return jsonify({'reply': 'Er is een fout opgetreden.', 'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
