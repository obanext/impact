# OBA interview — updated OpenAI API

The Assistants API (`/v1/threads`, `beta.threads.*`) was shut down on 26 August 2026.
This project now uses the **Conversations API** to keep interview history and the
**Responses API** to generate the next question.

## Deploy on Vercel

1. Upload/deploy the project files as before.
2. In the Vercel project's **Environment Variables**, configure `OPENAI_API_KEY`.
3. Optionally configure `OPENAI_MODEL` (defaults to `gpt-4.1-mini`).
4. You may remove the old `ASSISTANT_ID`: it is no longer read.
5. Redeploy and open the homepage. `/start` creates a `conv_...` session;
   `/chat` continues it via `conversation_id`.

The original Assistant's custom instructions are **not stored in this ZIP**.
They cannot be recovered using the retired Assistants API. Review and edit
`interview_instructions.txt` to reproduce the original interview's wording,
question selection, and flow. The questionnaire remains `contextvragen.csv`.

## Local run

```sh
pip install -r requirements.txt
cp .env.example .env
# Edit .env to add your real OPENAI_API_KEY.
python main.py
```

Open http://localhost:8080.

## Notes

- The `/start` response provides both `conversation_id` and a deprecated
  `thread_id` alias, so older versions of the frontend can still connect.
- User answers and history are stored in an OpenAI conversation. Consult the
  current OpenAI data retention documentation if collecting personal data.
- API calls require a valid API key, account credits and model access.
- Do not commit `.env` or expose your API key to the browser.
