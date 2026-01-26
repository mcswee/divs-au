// Centralized TTS function
function listen(text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-AU'; // Stick to the local accent
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
}

async function loadPhonology(url, containerId) {
    const response = await fetch(url);
    const rawData = await response.text();
    
    // Assuming you have a simple CSV to JSON helper already
    const data = parseCSV(rawData); 
    const container = document.querySelector(containerId);

    container.innerHTML = data.map(item => `
        <div class="phoneme-card" onclick="listen('${item.Examples.replace(/;/g, ' ')}')">
            <div class="phoneme-header">
                <span class="symbol">${item.Phoneme}</span>
                <span class="ipa-tag">/${item.IPA}/</span>
            </div>
            <div class="example-text">${item.Examples}</div>
            <div class="pronunciation-path">${item.Pronunciation}</div>
            <div class="tap-hint">Click to hear sound</div>
        </div>
    `).join('');
}

// Fire them both off
loadPhonology('vowels.csv', '#vowel-grid');
loadPhonology('consonants.csv', '#consonant-grid');
