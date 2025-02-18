const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const restartBtn = document.createElement("button");

let threadId = null;

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

async function startInterview() {
    appendMessage('assistant', "Hoi! We willen je wat vragen stellen om de OBA beter voor je te maken. Het duurt ongeveer twee minuten en je krijgt een plaatje of een wens, bedankt alvast! De vragen worden nu geladen.");

    try {
        const response = await fetch('/start', { method: 'POST' });
        const data = await response.json();
        
        if (data.thread_id) {
            threadId = data.thread_id;
            if (data.system_message) handleQuestion(data.system_message);
        } else {
            throw new Error("Geen thread_id ontvangen");
        }
    } catch (error) {
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

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thread_id: threadId, message: text })
        });

        const data = await response.json();
        if (data.system_message) handleQuestion(data.system_message);
    } catch (error) {
        appendMessage('assistant', 'Er is een fout opgetreden.');
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
    }
}

function handleQuestion(questionData) {
    try {
        if (!questionData || !questionData.vraag) return;

        appendMessage('assistant', questionData.vraag);

        let inputElement = document.createElement("div");
        inputElement.classList.add("question-input");

        if (questionData.soort === "1KEUZE") {
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
            let slider = document.createElement("input");
            slider.type = "range";
            slider.min = 1;
            slider.max = 5;
            slider.value = 3;
            inputElement.appendChild(slider);
        } else if (questionData.soort === "JA/NEE") {
            let yesButton = document.createElement("button");
            yesButton.textContent = "Ja";
            yesButton.onclick = () => sendAnswer("Ja");
            inputElement.appendChild(yesButton);

            let noButton = document.createElement("button");
            noButton.textContent = "Nee";
            noButton.onclick = () => sendAnswer("Nee");
            inputElement.appendChild(noButton);
        } else {
            let textInput = document.createElement("input");
            textInput.type = "text";
            textInput.placeholder = "Typ je antwoord...";
            inputElement.appendChild(textInput);
        }

        document.getElementById("chat-box").appendChild(inputElement);
    } catch (e) {
        appendMessage('assistant', 'Er is een fout opgetreden bij het verwerken van de vraag.');
    }
}

function sendAnswer(answer) {
    appendMessage('user', answer);
    userInput.value = answer;
    sendMessage();
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendMessage();
});

window.onload = startInterview;
