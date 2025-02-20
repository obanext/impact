const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const restartBtn = document.createElement("button");
let threadId = null;
let currentQuestion = null;

restartBtn.id = "restart-btn";
restartBtn.textContent = "Herstart";
restartBtn.onclick = () => location.reload();
document.getElementById('input-area').appendChild(restartBtn);

function appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', role);
    msgDiv.textContent = text;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function appendHtmlMessage(role, html) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', role);
    msgDiv.innerHTML = html;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function showTypingIndicator() {
    const typingIndicator = document.createElement('div');
    typingIndicator.classList.add('typing-indicator');
    typingIndicator.innerHTML = "<span></span><span></span><span></span>";
    chatBox.appendChild(typingIndicator);
    chatBox.scrollTop = chatBox.scrollHeight;
    return typingIndicator;
}

async function startInterview() {
    appendMessage('assistant', "Hoi! We willen je wat vragen stellen om de OBA beter voor je te maken. Het duurt ongeveer twee minuten en je krijgt een plaatje of een wens, bedankt alvast! De vragen worden nu geladen.");
    const typingIndicator = showTypingIndicator();
    try {
        const response = await fetch('/start', { method: 'POST' });
        const data = await response.json();
        typingIndicator.remove();
        if (data.thread_id) {
            threadId = data.thread_id;
            if (data.assistant_text) appendMessage('assistant', data.assistant_text);
            if (data.assistant_json) handleQuestion(data.assistant_json);
        } else {
            throw new Error("Geen thread_id ontvangen");
        }
    } catch (error) {
        typingIndicator.remove();
        appendMessage('assistant', 'Fout bij starten van interview.');
    }
}

async function sendMessage() {
    if (!threadId) {
        appendMessage('assistant', 'Fout: Geen actieve sessie. Vernieuw de pagina.');
        return;
    }

    let text = userInput.value.trim();
    userInput.value = '';

    if (currentQuestion) {
        if (currentQuestion.soort === "1KEUZE") {
            const chosen = document.querySelector('input[name="choice"]:checked');
            if (chosen) {
                text = chosen.value;
            }
        } else if (currentQuestion.soort === "MEERKEUZE") {
            const chosen = document.querySelectorAll('input[name="choice"]:checked');
            if (chosen.length > 0) {
                const values = Array.from(chosen).map(ch => ch.value);
                text = values.join(", ");
            }
        } else if (currentQuestion.soort === "5SCHAAL") {
            const range = document.getElementById("rangeInput");
            if (range) {
                text = range.value;
            }
        } else if (currentQuestion.soort === "OPEN") {
            const textInput = document.getElementById("openInput");
            if (textInput) {
                text = textInput.value.trim();
            }
        }
    }

    if (text === '') {
        appendMessage('assistant', 'Je hebt nog geen invoer gegeven.');
        return;
    }

    appendMessage('user', text);
    userInput.disabled = true;
    sendBtn.disabled = true;
    const typingIndicator = showTypingIndicator();

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thread_id: threadId, message: text })
        });
        const data = await response.json();
        typingIndicator.remove();

        if (data.assistant_text) appendMessage('assistant', data.assistant_text);
        if (data.assistant_json) handleQuestion(data.assistant_json);
    } catch (error) {
        typingIndicator.remove();
        appendMessage('assistant', 'Er is een fout opgetreden.');
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        currentQuestion = null;
    }
}

function handleQuestion(questionData) {
    currentQuestion = questionData;
    if (!questionData || !questionData.vraag) return;

    if (questionData.opties && questionData.opties.length > 0) {
        let html = "<strong>" + questionData.vraag + "</strong><br><br>";
        if (questionData.soort === "1KEUZE") {
            questionData.opties.forEach(option => {
                html += `
                <label style="display:block;margin-bottom:5px;">
                    <input type="radio" name="choice" value="${option}" />
                    ${option}
                </label>
                `;
            });
            appendHtmlMessage('assistant', html);
        } else if (questionData.soort === "MEERKEUZE") {
            questionData.opties.forEach(option => {
                html += `
                <label style="display:block;margin-bottom:5px;">
                    <input type="checkbox" name="choice" value="${option}" />
                    ${option}
                </label>
                `;
            });
            appendHtmlMessage('assistant', html);
        } else if (questionData.soort === "5SCHAAL") {
            html += `
            <input id="rangeInput" type="range" min="1" max="5" value="3" />
            `;
            appendHtmlMessage('assistant', html);
        } else {
            html += `<input id="openInput" type="text" style="display:block;margin-top:5px;"/>`;
            appendHtmlMessage('assistant', html);
        }
    } else {
        appendMessage('assistant', questionData.vraag);
        if (questionData.soort === "OPEN") {
            const inputHtml = `<br><input id="openInput" type="text" style="display:block;margin-top:5px;"/>`;
            appendHtmlMessage('assistant', inputHtml);
        }
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendMessage();
});
window.onload = startInterview;
