function listen(text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-AU';
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
}

async function loadPhonology(url, containerId) {
    try {
        const response = await fetch(url);
        const csvString = await response.text();
        
        Papa.parse(csvString, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const container = document.querySelector(containerId);
                if (!container) return;

                container.innerHTML = results.data.map(item => `
                    <div class="project-card" onclick="listen('${item.Examples.replace(/;/g, ' ')}')">
                        <div class="phoneme-header">
                            <span class="symbol">${item.Phoneme}</span>
                            <span class="ipa-tag">/${item.IPA}/</span>
                        </div>
                        <div class="example-text">${item.Examples}</div>
                        <div class="pronunciation-path">${item.Pronunciation}</div>
                        <div class="tap-hint">Listen to the words</div>
                    </div>
                `).join('');
            }
        });
    } catch (err) {
        console.error("Error loading " + url, err);
    }
}

loadPhonology('vowels.csv', '#vowel-grid');
loadPhonology('consonants.csv', '#consonant-grid');
