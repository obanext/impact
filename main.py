from flask import Flask, request, jsonify, render_template
import openai
import os
import json
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

openai.api_key = os.getenv("OPENAI_API_KEY")
ASSISTANT_ID = os.getenv("ASSISTANT_ID")

def load_context_questions():
    """Leest de JSON uit contextvragen.txt"""
    with open("contextvragen.txt", "r", encoding="utf-8") as file:
        return json.load(file)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/start', methods=['POST'])
def start():
    try:
        # Maak een nieuwe thread aan
        thread = openai.beta.threads.create()
        thread_id = thread.id

        # Stuur de eerste user message ("START")
        openai.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content="START"
        )

        # Start een nieuwe run met de assistant
        run = openai.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=ASSISTANT_ID
        )

        # Wacht tot de assistant antwoordt
        while True:
            run_status = openai.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)
            if run_status.status == "completed":
                messages = openai.beta.threads.messages.list(thread_id=thread_id)
                
                # De eerste reactie is "QUESTIONDB", dit moeten we negeren
                if messages.data[0].content[0].text.value.strip() == "QUESTIONDB":
                    
                    # Laad de context en vragen uit de txt file
                    context_questions = load_context_questions()
                    
                    # Stuur de JSON als system message naar de assistant
                    openai.beta.threads.messages.create(
                        thread_id=thread_id,
                        role="user",
                        content=json.dumps(context_questions)
                    )

                    # Start een nieuwe run zodat de assistant de vragen begint te stellen
                    run = openai.beta.threads.runs.create(
                        thread_id=thread_id,
                        assistant_id=ASSISTANT_ID
                    )

                    # Wacht opnieuw tot de assistant antwoordt
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

        # Stuur bericht van gebruiker naar de bestaande thread
        openai.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=user_message
        )

        # Start een nieuwe run met de assistant
        run = openai.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=ASSISTANT_ID
        )

        # Wacht tot de assistant antwoordt
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
    import os
    port = int(os.environ.get("PORT", 8080))  # Gebruik poort 8080 voor Vercel
    app.run(host="0.0.0.0", port=port)
