from flask import Flask, request, jsonify, render_template
import openai
import os
import json
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')

openai.api_key = os.getenv("OPENAI_API_KEY")
ASSISTANT_ID = os.getenv("ASSISTANT_ID")

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

        run = openai.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=ASSISTANT_ID
        )

        while True:
            run_status = openai.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)
            if run_status.status == "completed":
                messages = openai.beta.threads.messages.list(thread_id=thread_id)
                first_real_message = messages.data[0].content[0].text.value.strip()

                try:
                    response_data = json.loads(first_real_message)

                    if isinstance(response_data, dict) and "vraag" in response_data:
                        return jsonify({
                            'user_message': response_data["vraag"],
                            'system_message': response_data,
                            'thread_id': thread_id
                        })

                except json.JSONDecodeError:
                    return jsonify({'user_message': first_real_message, 'thread_id': thread_id})

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
                last_message = messages.data[0].content[0].text.value.strip()

                try:
                    response_data = json.loads(last_message)

                    if isinstance(response_data, dict) and "vraag" in response_data:
                        return jsonify({
                            'user_message': response_data["vraag"],
                            'system_message': response_data
                        })

                except json.JSONDecodeError:
                    return jsonify({'user_message': last_message})

    except Exception as e:
        return jsonify({'reply': 'Er is een fout opgetreden.', 'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
