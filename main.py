from flask import Flask, request, jsonify, render_template
import openai
import os
import json
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')

openai.api_key = os.getenv("OPENAI_API_KEY")
ASSISTANT_ID = os.getenv("ASSISTANT_ID")

# Laad de volledige CSV zonder filtering
def load_questions():
    csv_path = "contextvragen.csv"
    df = pd.read_csv(csv_path, delimiter=";")  # Laad volledige CSV zonder filtering

    questions = []
    for _, row in df.iterrows():
        question_data = {
            "onderdeel": row["onderdeel"],
            "vraag": row["body"],
            "soort": row["soort"],
            "opties": row["opties"].split(";") if pd.notna(row["opties"]) else None,
            "validatie": row["validatie"] == "ja"
        }
        questions.append(question_data)

    return questions

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/start', methods=['POST'])
def start():
    try:
        # Start een nieuwe OpenAI thread
        thread = openai.beta.threads.create()
        thread_id = thread.id

        openai.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content="START"
        )

        run = openai.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=ASSISTANT_ID
        )

        while True:
            run_status = openai.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)
            if run_status.status == "completed":
                messages = openai.beta.threads.messages.list(thread_id=thread_id)

                if messages.data[0].content[0].text.value.strip() == "QUESTIONDB":
                    questions = load_questions()  # Laad ALLE vragen zonder filtering

                    openai.beta.threads.messages.create(
                        thread_id=thread_id,
                        role="user",
                        content=json.dumps(questions)
                    )

                    run = openai.beta.threads.runs.create(
                        thread_id=thread_id,
                        assistant_id=ASSISTANT_ID
                    )

                    while True:
                        run_status = openai.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)
                        if run_status.status == "completed":
                            messages = openai.beta.threads.messages.list(thread_id=thread_id)
                            first_real_message = messages.data[0].content[0].text.value
                            return jsonify({'reply': first_real_message, 'thread_id': thread_id})

                return jsonify({'reply': messages.data[0].content[0].text.value, 'thread_id': thread_id})

    except Exception as e:
        print(f"Error in /start: {e}")
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
                last_message = messages.data[0].content[0].text.value
                return jsonify({'reply': last_message})
    
    except Exception as e:
        print(f"Error in /chat: {e}")
        return jsonify({'reply': 'Er is een fout opgetreden.', 'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))  # Zorg dat Vercel de juiste poort gebruikt
    app.run(host="0.0.0.0", port=port)
