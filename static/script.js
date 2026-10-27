const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const restartBtn = document.createElement('button');
let conversationId = null;
let currentQuestion = null;
let questionCounter = 0;

restartBtn.id = 'restart-btn';
restartBtn.textContent = 'Herstart';
restartBtn.onclick = () => location.reload();
document.getElementById('input-area').appendChild(restartBtn);

function appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', role);
    msgDiv.textContent = text;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return msgDiv;
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.classList.add('typing-indicator');
    for (let i = 0; i < 3; i++) indicator.appendChild(document.createElement('span'));
    chatBox.appendChild(indicator);
    chatBox.scrollTop = chatBox.scrollHeight;
    return indicator;
}

async function parseApiResponse(response) {
    const data = await response.json();
    if (!response.ok) throw new Error(data.reply || 'De interviewservice is niet beschikbaar.');
    return data;
}

function handleReply(data) {
    if (data.assistant_text) appendMessage('assistant', data.assistant_text);
    if (data.assistant_json) {
        handleQuestion(data.assistant_json);
    } else {
        currentQuestion = null;
        // An assistant reply without a question marks the end of the interview.
        userInput.disabled = true;
        sendBtn.disabled = true;
    }
}

async function startInterview() {
    userInput.disabled = true;
    sendBtn.disabled = true;
    appendMessage('assistant', 'Hoi! We willen je wat vragen stellen om de OBA beter voor je te maken. Het duurt ongeveer twee minuten en je krijgt een plaatje of een wens, bedankt alvast! De vragen worden nu geladen.');
    const typingIndicator = showTypingIndicator();
    try {
        const data = await parseApiResponse(await fetch('/start', { method: 'POST' }));
        conversationId = data.conversation_id || data.thread_id;
        if (!conversationId) throw new Error('Geen sessie-ID ontvangen.');
        handleReply(data);
        if (currentQuestion) {
            userInput.disabled = false;
            sendBtn.disabled = false;
        }
    } catch (error) {
        appendMessage('assistant', 'Fout bij starten van interview: ' + error.message);
    } finally {
        typingIndicator.remove();
    }
}

async function sendMessage() {
    if (!conversationId || sendBtn.disabled) return;
    let text = userInput.value.trim();

    if (currentQuestion) {
        const qSoort = currentQuestion.soort;
        const qName = 'choice_q' + questionCounter;
        if (qSoort === '1KEUZE') {
            const chosen = document.querySelector(`input[name="${qName}"]:checked`);
            if (chosen) text = chosen.value;
        } else if (qSoort === 'MEERKEUZE') {
            const chosen = document.querySelectorAll(`input[name="${qName}"]:checked`);
            if (chosen.length) text = Array.from(chosen).map(ch => ch.value).join(', ');
        } else if (qSoort === '5SCHAAL') {
            const slider = document.getElementById(`rangeInput_${questionCounter}`);
            if (slider) text = slider.value;
        }
    }
    if (!text) {
        appendMessage('assistant', 'Je hebt nog geen antwoord ingevuld of geselecteerd.');
        return;
    }
    userInput.value = '';
    appendMessage('user', text);
    userInput.disabled = true;
    sendBtn.disabled = true;
    const typingIndicator = showTypingIndicator();
    try {
        const data = await parseApiResponse(await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversation_id: conversationId, message: text }),
        }));
        handleReply(data);
    } catch (error) {
        // Preserve a failed answer so the participant can retry it.
        userInput.value = text;
        appendMessage('assistant', 'Er is een fout opgetreden: ' + error.message);
    } finally {
        typingIndicator.remove();
        if (currentQuestion) {
            userInput.disabled = false;
            sendBtn.disabled = false;
        }
    }
}

function handleQuestion(questionData) {
    if (!questionData || typeof questionData.vraag !== 'string') return;
    currentQuestion = questionData;
    questionCounter++;
    const qName = 'choice_q' + questionCounter;
    const container = appendMessage('assistant', questionData.vraag);
    const options = Array.isArray(questionData.opties) ? questionData.opties : [];

    if (questionData.soort === '1KEUZE' || questionData.soort === 'MEERKEUZE') {
        for (const option of options) {
            const label = document.createElement('label');
            label.style.display = 'block';
            label.style.marginTop = '8px';
            const choice = document.createElement('input');
            choice.type = questionData.soort === '1KEUZE' ? 'radio' : 'checkbox';
            choice.name = qName;
            choice.value = String(option);
            label.appendChild(choice);
            label.appendChild(document.createTextNode(' ' + String(option)));
            container.appendChild(label);
        }
    } else if (questionData.soort === '5SCHAAL') {
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '1';
        slider.max = '5';
        slider.step = '1';
        slider.value = '3';
        slider.id = 'rangeInput_' + questionCounter;
        slider.setAttribute('aria-label', 'Score van 1 tot en met 5');
        const value = document.createElement('span');
        value.textContent = ' ' + slider.value;
        slider.addEventListener('input', () => { value.textContent = ' ' + slider.value; });
        container.appendChild(document.createElement('div'));
        container.appendChild(slider);
        container.appendChild(value);
    }
    chatBox.scrollTop = chatBox.scrollHeight;
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') sendMessage();
});
window.addEventListener('load', startInterview);
