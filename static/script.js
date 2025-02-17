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
            threadId = data.thread_id;
            typingIndicator.remove();

            if (data.user_message) appendMessage('assistant', data.user_message);
            if (data.system_message) displayQuestionOptions(data.system_message);
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

        if (data.user_message) appendMessage('assistant', data.user_message);
        if (data.system_message) displayQuestionOptions(data.system_message);
    } catch (error) {
        typingIndicator.remove();
        appendMessage('assistant', 'Er is een fout opgetreden.');
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
    }
}

function displayQuestionOptions(questionData) {
    try {
        if (!questionData || !questionData.vraag) return;

        const optionsContainer = document.createElement("div");
        optionsContainer.classList.add("options-container");

        if (questionData.soort === "1KEUZE") {
            questionData.opties.forEach(option => {
                const button = document.createElement("button");
                button.textContent = option;
                button.onclick = () => sendMessage(option);
                optionsContainer.appendChild(button);
            });
        } else if (questionData.soort === "5SCHAAL") {
            const slider = document.createElement("input");
            slider.type = "range";
            slider.min = 1;
            slider.max = 5;
            slider.value = 3;
            optionsContainer.appendChild(slider);
            
            const submitButton = document.createElement("button");
            submitButton.textContent = "Verstuur";
            submitButton.onclick = () => sendMessage(slider.value);
            optionsContainer.appendChild(submitButton);
        } else {
            const textInput = document.createElement("input");
            textInput.type = "text";
            optionsContainer.appendChild(textInput);

            const submitButton = document.createElement("button");
            submitButton.textContent = "Verstuur";
            submitButton.onclick = () => sendMessage(textInput.value);
            optionsContainer.appendChild(submitButton);
        }

        chatBox.appendChild(optionsContainer);
    } catch (e) {
        appendMessage('assistant', 'Er is een fout opgetreden bij het verwerken van de vraag.');
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendMessage();
});

window.onload = startInterview;
