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

async function startInterview() {
    appendMessage('assistant', "Hoi! We willen je wat vragen stellen om de OBA beter voor je te maken. Het duurt ongeveer twee minuten en je krijgt een plaatje of een wens, bedankt alvast! De vragen worden nu geladen.");

    const typingIndicator = showTypingIndicator();

    try {
        const response = await fetch('/start', { method: 'POST' });
        const data = await response.json();
        
        threadId = data.thread_id;
        typingIndicator.remove();
        appendMessage('assistant', data.reply);
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
        appendMessage('assistant', data.reply);
    } catch (error) {
        typingIndicator.remove();
        appendMessage('assistant', 'Er is een fout opgetreden.');
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendMessage();
});

window.onload = startInterview;
