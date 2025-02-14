const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const restartBtn = document.createElement("button");

let threadId = null;

// Voeg een herstart-knop toe
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

// Fix: showTypingIndicator hersteld
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
        
        if (data.thread_id) {
            threadId = data.thread_id;  // Zorg dat threadId correct wordt opgeslagen
            typingIndicator.remove();
            handleQuestion(data.reply);
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

    const text = userInput.value.trim();
    if (text === '') return;
    
    appendMessage('user', text);
    userInput.value = '';
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
        handleQuestion(data.reply);
    } catch (error) {
        typingIndicator.remove();
        appendMessage('assistant', 'Er is een fout opgetreden.');
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
    }
}

function handleQuestion(data) {
    try {
        let questionData;

        // Controleer of de response een JSON-object of een string is
        if (typeof data === "string") {
            try {
                questionData = JSON.parse(data);
            } catch (e) {
                questionData = null;
            }
        } else {
            questionData = data;
        }

        // Als het GEEN JSON is of geen geldige vraag bevat, toon het als platte tekst
        if (!questionData || !questionData.vraag) {
            appendMessage('assistant', data);
            return;
        }

        // Toon alleen de vraagtekst in de chat
        appendMessage('assistant', questionData.vraag);

        let inputElement;
        if (questionData.soort === "MEERKEUZE") {
            inputElement = document.createElement("div");
            questionData.opties.forEach(option => {
                let checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.value = option;
                checkbox.id = option;

                let label = document.createElement("label");
                label.htmlFor = option;
                label.textContent = option;

                inputElement.appendChild(checkbox);
                inputElement.appendChild(label);
                inputElement.appendChild(document.createElement("br"));
            });
        } else if (["1KEUZE", "JA/NEE"].includes(questionData.soort)) {
            inputElement = document.createElement("div");
            questionData.opties.forEach(option => {
                let radio = document.createElement("input");
                radio.type = "radio";
                radio.name = "choice";
                radio.value = option;
                radio.id = option;

                let label = document.createElement("label");
                label.htmlFor = option;
                label.textContent = option;

                inputElement.appendChild(radio);
                inputElement.appendChild(label);
                inputElement.appendChild(document.createElement("br"));
            });
        } else if (questionData.soort === "5SCHAAL") {
            inputElement = document.createElement("input");
            inputElement.type = "range";
            inputElement.min = 1;
            inputElement.max = 5;
            inputElement.value = 3;
        } else {
            inputElement = document.createElement("input");
            inputElement.type = "text";
        }

        document.getElementById("input-area").appendChild(inputElement);
    } catch (e) {
        appendMessage('assistant', 'Er is een fout opgetreden bij het verwerken van de vraag.');
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendMessage();
});

window.onload = startInterview;
