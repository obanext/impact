const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const restartBtn = document.createElement("button");
let threadId = null;
let currentQuestion = null;
let questionCounter = 0;

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
        const qSoort = currentQuestion.soort;
        const qName = "choice_q" + questionCounter;

        if (qSoort === "1KEUZE") {
            const chosen = document.querySelector(`input[name="${qName}"]:checked`);
            if (chosen) {
                text = chosen.value;
            } else if (!text) {
                appendMessage('assistant', 'Je hebt nog geen keuze gemaakt.');
                return;
            }
        } else if (qSoort === "MEERKEUZE") {
            const chosen = document.querySelectorAll(`input[name="${qName}"]:checked`);
            if (chosen.length > 0) {
                const values = Array.from(chosen).map(ch => ch.value);
                text = values.join(", ");
            } else if (!text) {
                appendMessage('assistant', 'Je hebt nog geen keuze(s) geselecteerd.');
                return;
            }
        } else if (qSoort === "5SCHAAL") {
            const slider = document.getElementById(`rangeInput_${questionCounter}`);
            if (slider) {
                text = slider.value;
            }
            if (!text) {
                appendMessage('assistant', 'Schuif de balk naar een waarde tussen 1 en 5.');
                return;
            }
        } else if (qSoort === "OPEN") {
            if (!text) {
                appendMessage('assistant', 'Je hebt geen antwoord ingevuld.');
                return;
            }
        }
    }

    if (!text) {
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

        if (data.assistant_text) {
            appendMessage('assistant', data.assistant_text);
        }
        if (data.assistant_json) {
            handleQuestion(data.assistant_json);
        } else {
            currentQuestion = null;
        }
    } catch (error) {
        typingIndicator.remove();
        appendMessage('assistant', 'Er is een fout opgetreden.');
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
    }
}

function handleQuestion(questionData) {
    currentQuestion = questionData;
    questionCounter++;

    if (!questionData || !questionData.vraag) return;
    let html = questionData.vraag + "<br><br>";
    const qName = "choice_q" + questionCounter;

    if (questionData.opties && questionData.opties.length > 0) {
        if (questionData.soort === "1KEUZE") {
            questionData.opties.forEach(option => {
                html += `
                  <label style="display:block;margin-bottom:5px;">
                      <input type="radio" name="${qName}" value="${option}" />
                      ${option}
                  </label>
                `;
            });
            appendHtmlMessage('assistant', html);
        } else if (questionData.soort === "MEERKEUZE") {
            questionData.opties.forEach(option => {
                html += `
                  <label style="display:block;margin-bottom:5px;">
                      <input type="checkbox" name="${qName}" value="${option}" />
                      ${option}
                  </label>
                `;
            });
            appendHtmlMessage('assistant', html);
        } else if (questionData.soort === "5SCHAAL") {
            html += `
              <input id="rangeInput_${questionCounter}" type="range" min="1" max="5" step="1" value="3" list="tickmarks_${questionCounter}" />
              <datalist id="tickmarks_${questionCounter}">
                <option value="1" label="1"></option>
                <option value="2"></option>
                <option value="3" label="3"></option>
                <option value="4"></option>
                <option value="5" label="5"></option>
              </datalist>
            `;
            appendHtmlMessage('assistant', html);
        } else {
            // Tekstveld in de chat is niet gewenst bij OPEN, dus user typt in #user-input
            appendHtmlMessage('assistant', html);
        }
    } else {
        // OPEN vraag zonder opties: user typt in #user-input
        appendMessage('assistant', questionData.vraag);
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendMessage();
});
window.onload = startInterview;
