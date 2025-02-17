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

            if (data.user_message) appendMessage('assistant', data.user_message); 
            if (data.system_message) handleQuestion(data.system_message); // UI genereren, niet tonen in chat
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
        
        if (data.user_message) appendMessage('assistant', data.user_message);
        if (data.system_message) handleQuestion(data.system_message); // UI genereren, niet tonen in chat
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

        let inputArea = document.getElementById("input-area");
        inputArea.innerHTML = ""; // Oude invoervelden verwijderen

        let inputElement;
        if (questionData.soort === "1KEUZE") {
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
            inputElement = document.createElement("div");
            let slider = document.createElement("input");
            slider.type = "range";
            slider.min = 1;
            slider.max = 5;
            slider.value = 3;
            slider.id = "scale-slider";

            let valueDisplay = document.createElement("span");
            valueDisplay.id = "scale-value";
            valueDisplay.textContent = "3"; // Default value

            slider.addEventListener("input", function() {
                valueDisplay.textContent = slider.value;
            });

            inputElement.appendChild(slider);
            inputElement.appendChild(valueDisplay);
        } else {
            inputElement = document.createElement("input");
            inputElement.type = "text";
        }

        inputArea.appendChild(inputElement);

    } catch (e) {
        appendMessage('assistant', 'Er is een fout opgetreden bij het verwerken van de vraag.');
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendMessage();
});

window.onload = startInterview;
