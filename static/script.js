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
    appendMessage('assistant', "Hoi! We laden de vragen, een moment...");

    try {
        const response = await fetch('/start', { method: 'POST' });
        const data = await response.json();

        if (data.error) {
            console.error("FOUT:", data.error); // Alleen in browserconsole tonen
            appendMessage('assistant', "Er is een fout opgetreden bij het verwerken van de vraag.");
            return;
        }

        if (data.thread_id) {
            threadId = data.thread_id;
            appendMessage('assistant', data.user_message);
            handleQuestion(data.system_message);
        } else {
            throw new Error("Geen thread_id ontvangen");
        }
    } catch (error) {
        console.error("FOUT: Netwerk- of serverprobleem", error);
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

        if (data.error) {
            console.error("FOUT:", data.error); // Alleen in browserconsole tonen
            appendMessage('assistant', "Er is een fout opgetreden bij het verwerken van je antwoord.");
            return;
        }

        if (data.user_message) appendMessage('assistant', data.user_message);
        if (data.system_message) handleQuestion(data.system_message);
    } catch (error) {
        console.error("FOUT: Netwerk- of serverprobleem", error);
        appendMessage('assistant', 'Er is een fout opgetreden.');
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
    }
}

function handleQuestion(questionData) {
    try {
        if (!questionData || typeof questionData !== "object" || !questionData.vraag) {
            console.error("FOUT IN JSON DATA:", questionData);
            appendMessage('assistant', "Er is een fout opgetreden bij het verwerken van de vraag.");
            return;
        }

        let inputArea = document.getElementById("input-area");
        inputArea.innerHTML = "";

        let inputElement = document.createElement("input");
        inputElement.type = "text";
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
