import logging
from flask import Flask, request, jsonify, render_template
import openai
import os
import json
import time
from dotenv import load_dotenv

# Logging configuratie
logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(message)s")

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
        logging.info("Ontvangen POST-verzoek voor /start")

        # 1️⃣ Maak een nieuwe thread aan
        thread = openai.beta.threads.create()
        thread_id = thread.id
        logging.info(f"Nieuwe thread aangemaakt: {thread_id}")

        # 2️⃣ Stuur "START" naar de assistent
        openai.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content="START"
        )
        logging.info("Bericht 'START' verzonden naar de assistant")

        # 3️⃣ Controleer of CSV-bestand bestaat
        if os.path.exists(CSV_PATH):
            with open(CSV_PATH, "r", encoding="utf-8") as file:
                csv_data = file.read()
                logging.info(f"CSV-bestand geladen: {len(csv_data)} tekens")

            openai.beta.threads.messages.create(
                thread_id=thread_id,
                role="user",
                content=f"Hier is de dataset in CSV-formaat: \n\n{csv_data}"
            )
            logging.info("CSV-bestand succesvol verzonden naar de assistant")
        else:
            logging.error("Fout: CSV-bestand niet gevonden")
            return jsonify({'reply': 'Fout: CSV-bestand niet gevonden'}), 500

        # 4️⃣ Start een nieuwe OpenAI-run
        run = openai.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=ASSISTANT_ID
        )
        logging.info(f"Run gestart met ID: {run.id}")

        # 5️⃣ Poll de OpenAI API voor het resultaat
        start_time = time.time()
        while True:
            run_status = openai.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)
            logging.info(f"Run status: {run_status.status}")

            if run_status.status == "completed":
                messages = openai.beta.threads.messages.list(thread_id=thread_id)
                first_real_message = messages.data[0].content[0].text.value.strip()
                logging.info(f"Eerste bericht ontvangen: {first_real_message[:100]}")

                try:
                    response_data = json.loads(first_real_message)

                    return jsonify({
                        'user_message': response_data.get("vraag", ""),
                        'system_message': response_data,
                        'thread_id': thread_id
                    })

                except json.JSONDecodeError:
                    logging.warning("Kon de JSON-output niet parsen.")
                    return jsonify({'user_message': first_real_message, 'thread_id': thread_id})

            if time.time() - start_time > 25:
                logging.error("Timeout bij ophalen van API-resultaten!")
                return jsonify({'reply': 'API-response duurde te lang'}), 504

            time.sleep(2)

    except Exception as e:
        logging.exception("Er is een fout opgetreden in /start")
        return jsonify({'reply': 'Er is een fout opgetreden.', 'error': str(e)}), 500

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        thread_id = data.get('thread_id')
        user_message = data.get('message')

        logging.info(f"Nieuwe chat-aanroep: thread_id={thread_id}, message={user_message}")

        if not thread_id:
            logging.error("Geen thread_id ontvangen")
            return jsonify({'reply': 'Geen actieve sessie. Probeer opnieuw.'}), 400

        openai.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=user_message
        )
        logging.info("Bericht verzonden naar OpenAI")

        run = openai.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=ASSISTANT_ID
        )
        logging.info(f"Run gestart met ID: {run.id}")

        start_time = time.time()
        while True:
            run_status = openai.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)
            logging.info(f"Run status: {run_status.status}")

            if run_status.status == "completed":
                messages = openai.beta.threads.messages.list(thread_id=thread_id)
                last_message = messages.data[0].content[0].text.value.strip()
                logging.info(f"Laatste bericht ontvangen: {last_message[:100]}")

                try:
                    response_data = json.loads(last_message)

                    return jsonify({
                        'user_message': response_data.get("vraag", ""),
                        'system_message': response_data
                    })

                except json.JSONDecodeError:
                    logging.warning("Kon de JSON-output niet parsen.")
                    return jsonify({'user_message': last_message})

            if time.time() - start_time > 25:
                logging.error("Timeout bij ophalen van API-resultaten!")
                return jsonify({'reply': 'API-response duurde te lang'}), 504

            time.sleep(2)

    except Exception as e:
        logging.exception("Er is een fout opgetreden in /chat")
        return jsonify({'reply': 'Er is een fout opgetreden.', 'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, threaded=True)
