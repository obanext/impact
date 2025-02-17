from flask import Flask, request, jsonify, render_template
import openai
import os
import json
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')

openai.api_key = os.getenv("OPENAI_API_KEY")
ASSISTANT_ID = os.getenv("ASSISTANT_ID")

# Dictionary om bij te houden of een thread de vragenlijst al heeft
active_threads = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/start', methods=['POST'])
def start():
    try:
        # Stap 1: Maak een nieuwe thread aan
        thread = openai.beta.threads.create()
        thread_id = thread.id

        # Stap 2: Markeer dat de vragenlijst nog niet is geladen
        active_threads[thread_id] = {"has_questions": False}

        # Stap 3: Laad de vragenlijst direct uit CSV
        csv_path = "contextvragen.csv"
        with open(csv_path, "r", encoding="utf-8") as file:
            csv_data = file.read()

        # Stap 4: Stuur de vragenlijst direct naar de assistant
        openai.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=csv_data
        )

        # Stap 5: Start de assistant direct met verwerken
        run = openai.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=ASSISTANT_ID
        )

        while True:
            run_status = openai.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)
            if run_status.status == "completed":
                messages = openai.beta.threads.messages.list(thread_id=thread_id)
                first_real_message = messages.data[0].content[0].text.value.strip()

                active_threads[thread_id]["has_questions"] = True  # Markeer als geladen

                try:
                    response_data = json.loads(first_real_message)

                    if isinstance(response_data, dict) and "vraag" in response_data:
                        vraag_tekst = response_data["vraag"]  # Alleen de vraagtekst voor de gebruiker

                        return jsonify({
                            'user_message': vraag_tekst,  # Alleen tekst naar de gebruiker
                            'system_message': response_data,  # JSON-object voor frontend
                            'thread_id': thread_id
                        })

                except json.JSONDecodeError:
                    return jsonify({
                        'user_message': first_real_message,  # Fallback: Stuur de ruwe tekst als er geen JSON is
                        'thread_id': thread_id
                    })

    except Exception as e:
        return jsonify({'reply': 'Er is een fout opgetreden.', 'error': str(e)}), 500

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        thread_id = data.get('thread_id')
        user_message = data.get('message')

        # Zorg dat vragen zijn geladen
        if thread_id not in active_threads or not active_threads[thread_id]["has_questions"]:
            return jsonify({'reply': 'Er is een fout opgetreden: vragenlijst niet geladen.'}), 400

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
                last_message = messages.data[0].content[0].text.value.strip()

                try:
                    response_data = json.loads(last_message)

                    if isinstance(response_data, dict) and "vraag" in response_data:
                        vraag_tekst = response_data["vraag"]

                        return jsonify({
                            'user_message': vraag_tekst,
                            'system_message': response_data
                        })

                except json.JSONDecodeError:
                    return jsonify({'user_message': last_message})

    except Exception as e:
        return jsonify({'reply': 'Er is een fout opgetreden.', 'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
