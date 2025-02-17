window.onload = startInterview;
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const restartBtn = document.createElement("button");

let threadId = null;

// Voeg een herstart-knop toe, maar alleen als deze nog niet bestaat
if (!document.getElementById('restart-btn')) {
    restartBtn.id = "restart-btn";
    restartBtn.textContent = "Herstart";
    restartBtn.onclick = () => location.reload();
    document.getElementById('input-area').appendChild(restartBtn);
}

function appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', role);
    msgDiv.textContent = text;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function startInterview() {
    appendMessage('assistant', "Hoi! We willen je wat vragen stellen om de OBA beter voor je te maken. Het duurt ongeveer twee minuten en je krijgt een plaatje of een wens, bedankt alvast! De vragen worden nu geladen.");

    const typingIndicator = showTypingIndicator();

    try {
        const response = await fetch('/start', { method: 'POST' });
        const data = await response.json();
        
        if (data.thread_id) {
            threadId = data.thread_id;
            typingIndicator.remove();

            if (data.user_message) appendMessage('assistant', data.user_message);
            if (data.system_message) handleQuestion(data.system_message);
        } else {
            throw new Error("Geen thread_id ontvangen");
        }
    } catch (error) {
        typingIndicator.remove();
        appendMessage('assistant', 'Fout bij starten van interview.');
    }
}

function handleQuestion(questionData) {
    try {
        if (!questionData || !questionData.vraag) return;

        document.getElementById("input-area").innerHTML = "";

        let inputElement;
        if (questionData.soort === "1KEUZE" || questionData.soort === "JA/NEE") {
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
        } else if (questionData.soort === "MEERKEUZE") {
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
