/* OBA Impactmeter. State is kept client-side for Vercel's stateless runtime. */
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const languageSelect = document.getElementById('language-select');
const progress = document.getElementById('progress');
const results = document.getElementById('results');
const restartBtn = document.getElementById('restart-btn');
let conversationId = null;
let interviewId = null;
let language = 'nl';
let question = null;
let questionCounter = 0;
let answers = [];
let interviewJson = null;
let busy = false;

function message(role, text) {
    const element = document.createElement('div');
    element.className = `message ${role}`;
    element.textContent = text;
    chatBox.appendChild(element);
    chatBox.scrollTop = chatBox.scrollHeight;
    return element;
}

function setBusy(value) {
    busy = value;
    userInput.disabled = value || !question;
    sendBtn.disabled = value || !question;
    restartBtn.disabled = value;
}

function ask(questionData, position) {
    question = questionData;
    questionCounter++;
    const node = message('assistant', questionData.vraag);
    const options = Array.isArray(questionData.opties) ? questionData.opties : [];
    const labels = Array.isArray(questionData.option_labels) ? questionData.option_labels : [];
    progress.textContent = language === 'nl' ? `Vraag ${position.current} van ${position.total}` :
        `Question ${position.current} of ${position.total}`;
    userInput.value = '';
    userInput.placeholder = language === 'nl' ? 'Typ je antwoord...' : 'Type your answer...';
    const group = `q_${questionCounter}`;
    if (questionData.soort === '1KEUZE' || questionData.soort === 'MEERKEUZE') {
        const type = questionData.soort === '1KEUZE' ? 'radio' : 'checkbox';
        options.forEach((option, i) => {
            const row = document.createElement('label');
            row.className = 'choice';
            const control = document.createElement('input');
            control.type = type;
            control.name = group;
            control.value = option;
            row.append(control, document.createTextNode(' ' + (labels[i] || option)));
            node.appendChild(row);
        });
    } else if (questionData.soort === '5SCHAAL') {
        const range = document.createElement('input');
        range.type = 'range';
        range.min = 1; range.max = 5; range.step = 1; range.value = 3;
        range.id = `range_${questionCounter}`;
        range.setAttribute('aria-label', 'Score 1 to 5');
        const score = document.createElement('span');
        score.textContent = ' 3';
        range.addEventListener('input', () => { score.textContent = ' ' + range.value; });
        node.append(range, score);
    }
    setBusy(false);
    userInput.focus();
}

async function parseJsonResponse(response) {
    const data = await response.json();
    if (!response.ok) throw new Error(data.reply || 'Service unavailable');
    return data;
}

async function startInterview() {
    setBusy(true);
    question = null;
    language = languageSelect.value;
    languageSelect.disabled = true;
    progress.textContent = language === 'nl' ? 'Interview wordt gestart...' : 'Starting interview...';
    try {
        const response = await fetch('/start', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({language}),
        });
        const data = await parseJsonResponse(response);
        conversationId = data.conversation_id;
        interviewId = data.interview_id;
        if (!conversationId || !interviewId) throw new Error('Incomplete session');
        message('assistant', data.assistant_text);
        ask(data.question, data.progress);
    } catch (err) {
        message('assistant', 'Start mislukt: ' + err.message);
        progress.textContent = '';
        question = null;
    } finally {
        languageSelect.disabled = false;
        setBusy(false);
    }
}

function readAnswer() {
    const typed = userInput.value.trim();
    if (typed) return typed; // Permits 'skip', open explanations or other free text.
    const group = `q_${questionCounter}`;
    if (question.soort === '1KEUZE') {
        const selected = document.querySelector(`input[name="${group}"]:checked`);
        return selected ? selected.value : '';
    }
    if (question.soort === 'MEERKEUZE') {
        return [...document.querySelectorAll(`input[name="${group}"]:checked`)]
            .map(element => element.value).join(', ');
    }
    if (question.soort === '5SCHAAL') {
        const slider = document.getElementById(`range_${questionCounter}`);
        return slider ? slider.value : '';
    }
    return '';
}

async function sendAnswer() {
    if (busy || !question || !conversationId) return;
    const answer = readAnswer();
    if (!answer) {
        message('assistant', language === 'nl' ? 'Vul iets in of kies een antwoord.' : 'Enter or select an answer.');
        return;
    }
    setBusy(true);
    try {
        const result = await parseJsonResponse(await fetch('/chat', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({conversation_id: conversationId, interview_id: interviewId,
                language, message: answer, answers}),
        }));
        message('user', answer);
        if (result.assistant_text) message('assistant', result.assistant_text);
        if (!result.valid) {
            userInput.value = '';
            return;
        }
        answers.push(result.answer);
        document.querySelectorAll(`input[name="q_${questionCounter}"], #range_${questionCounter}`)
            .forEach(el => { el.disabled = true; });
        userInput.value = '';
        if (result.complete) {
            interviewJson = result.interview_json;
            question = null;
            progress.textContent = language === 'nl' ? 'Interview afgerond' : 'Interview complete';
            showResultActions();
        } else {
            ask(result.question, result.progress);
        }
    } catch (err) {
        message('assistant', (language === 'nl' ? 'Fout, probeer je antwoord opnieuw: ' : 'Error, retry your answer: ') + err.message);
    } finally {
        setBusy(false);
    }
}

function actionButton(title, callback) {
    const button = document.createElement('button');
    button.textContent = title;
    button.addEventListener('click', callback);
    results.appendChild(button);
    return button;
}

async function createOutput(mode) {
    if (busy || !interviewJson) return;
    setBusy(true);
    results.querySelectorAll('button').forEach(btn => { btn.disabled = true; });
    message('assistant', language === 'nl' ? 'Je persoonlijke resultaat wordt gemaakt...' : 'Creating your personal result...');
    try {
        const result = await parseJsonResponse(await fetch('/output', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({language, answers, mode}),
        }));
        if (result.mode === 'wens') {
            message('assistant', result.text);
        } else {
            const container = message('assistant', language === 'nl' ? 'Je persoonlijke afbeelding:' : 'Your personal image:');
            const image = document.createElement('img');
            const url = `data:${result.mime_type};base64,${result.image_base64}`;
            image.src = url;
            image.alt = 'Gegenereerde persoonlijke OBA-afbeelding';
            image.className = 'result-image';
            container.append(image);
            const save = document.createElement('a');
            save.href = url; save.download = `oba-impact-${interviewId}.jpg`;
            save.textContent = language === 'nl' ? 'Download afbeelding' : 'Download image';
            container.append(save);
        }
    } catch (err) {
        message('assistant', (language === 'nl' ? 'Resultaat mislukt: ' : 'Result failed: ') + err.message);
    } finally {
        results.querySelectorAll('button').forEach(btn => { btn.disabled = false; });
        setBusy(false);
    }
}

async function exportCsv() {
    try {
        const response = await fetch('/export', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({answers, interview_id: interviewId}),
        });
        if (!response.ok) throw new Error((await response.json()).reply || 'Export failed');
        downloadBlob(await response.blob(), `oba-impact-${interviewId}.csv`);
    } catch (err) { message('assistant', 'CSV: ' + err.message); }
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportJson() {
    downloadBlob(new Blob([JSON.stringify(interviewJson, null, 2)], {type: 'application/json'}),
        `oba-impact-${interviewId}.json`);
}

function showResultActions() {
    results.hidden = false;
    const label = document.createElement('p');
    label.textContent = language === 'nl' ? 'Wat wil je ontvangen?' : 'What would you like to receive?';
    results.append(label);
    actionButton(language === 'nl' ? 'Persoonlijke wens' : 'Personal wish', () => createOutput('wens'));
    actionButton(language === 'nl' ? 'Afbeelding' : 'Image', () => createOutput('afbeelding'));
    actionButton('CSV', exportCsv);
    actionButton('JSON', exportJson);
}

sendBtn.addEventListener('click', sendAnswer);
userInput.addEventListener('keydown', event => { if (event.key === 'Enter') sendAnswer(); });
restartBtn.addEventListener('click', () => location.reload());
languageSelect.addEventListener('change', () => {
    // Switching language starts a fresh interview with the selected language.
    if (busy) return;
    chatBox.replaceChildren();
    results.replaceChildren();
    results.hidden = true;
    answers = [];
    interviewJson = null;
    question = null;
    questionCounter = 0;
    conversationId = null;
    interviewId = null;
    startInterview();
});
window.addEventListener('load', startInterview);
