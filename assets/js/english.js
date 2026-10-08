/* ============================================================
   Australian English phonology (projects/english.html)
   Data: /assets/data/sounds.json
         sym, ipa, seg ("vowel" | "consonant"), ex, examples[], sentence, transcript
   ============================================================ */

(function () {
  'use strict';

  const hasSpeech = 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';

  const page = document.querySelector('.english-page');
  const lists = {
    vowel: document.getElementById('vowel-list'),
    consonant: document.getElementById('consonant-list')
  };

  let sounds = [];
  let playingIndex = null;

  const ICON_PLAY = '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" focusable="false"><path d="M2.5 2l8 4-8 4V2z"/></svg>';
  const ICON_STOP = '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" focusable="false"><rect x="2" y="2" width="3.5" height="8" rx="0.5"/><rect x="6.5" y="2" width="3.5" height="8" rx="0.5"/></svg>';

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---- loading ----

  fetch('/assets/data/sounds.json')
    .then(res => {
      if (!res.ok) throw new Error('sounds.json ' + res.status);
      return res.json();
    })
    .then(data => {
      sounds = data;
      render();
      if (hasSpeech) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.addEventListener('voiceschanged', () => window.speechSynthesis.getVoices());
      } else {
        page.classList.add('no-speech');
        document.getElementById('speech-note').hidden = false;
      }
    })
    .catch(err => {
      console.error('Could not load the sounds:', err);
      document.getElementById('sound-error').hidden = false;
    });

  // ---- rendering ----

  function cardHtml(p, i) {
    const word = p.ex.toLowerCase();
    return '<li class="sound-card" data-index="' + i + '">' +
      '<div class="sound-card-header">' +
        '<h3 class="sound-title" aria-label="Symbol ' + escHtml(p.sym) + ', IPA ' + escHtml(p.ipa) + ', as in ' + escHtml(word) + '">' +
          '<span class="sound-symbol" aria-hidden="true">' + escHtml(p.sym) + '</span>' +
          '<span class="sound-ipa" aria-hidden="true">/' + escHtml(p.ipa) + '/</span>' +
        '</h3>' +
        '<p class="sound-examples"><span class="sr-only">Example words: </span>' +
          p.examples.map(e => '<span class="example-word">' + escHtml(e.toLowerCase()) + '</span>').join('') +
        '</p>' +
      '</div>' +
      '<p class="sound-sentence">' + escHtml(p.sentence) + '</p>' +
      '<p class="sound-transcript" aria-hidden="true">' + escHtml(p.transcript) + '</p>' +
      '<button type="button" class="play-btn" aria-pressed="false" aria-label="Play the sentence for ' + escHtml(p.sym) + ', as in ' + escHtml(word) + '">' +
        ICON_PLAY + '<span class="play-label">play</span>' +
      '</button>' +
    '</li>';
  }

  function render() {
    const html = { vowel: '', consonant: '' };
    const counts = { vowel: 0, consonant: 0 };
    sounds.forEach((p, i) => {
      if (!html.hasOwnProperty(p.seg)) return;
      html[p.seg] += cardHtml(p, i);
      counts[p.seg]++;
    });
    Object.keys(lists).forEach(seg => {
      lists[seg].innerHTML = html[seg];
      document.getElementById(seg + '-count').textContent = '(' + counts[seg] + ')';
      document.getElementById(seg + '-jump').textContent = '(' + counts[seg] + ')';
    });
  }

  // ---- speech ----

  function setPlaying(index, on) {
    const card = page.querySelector('.sound-card[data-index="' + index + '"]');
    if (!card) return;
    const btn = card.querySelector('.play-btn');
    card.classList.toggle('playing', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.innerHTML = (on ? ICON_STOP : ICON_PLAY) + '<span class="play-label">' + (on ? 'playing\u2026' : 'play') + '</span>';
  }

  function stopCurrent() {
    if (!hasSpeech) return;
    window.speechSynthesis.cancel();
    if (playingIndex !== null) setPlaying(playingIndex, false);
    playingIndex = null;
  }

  function playCard(index) {
    if (!hasSpeech) return;
    if (playingIndex === index) { stopCurrent(); return; }
    stopCurrent();

    const utt = new SpeechSynthesisUtterance(sounds[index].sentence);
    utt.lang = 'en-AU';
    utt.rate = 0.88;
    const voice = window.speechSynthesis.getVoices().find(v => v.lang === 'en-AU');
    if (voice) utt.voice = voice;

    playingIndex = index;
    setPlaying(index, true);

    utt.onend = utt.onerror = () => {
      if (playingIndex === index) {
        playingIndex = null;
        setPlaying(index, false);
      }
    };

    window.speechSynthesis.speak(utt);
  }

  // one click handler for every card: the card or its play button both play
  page.addEventListener('click', e => {
    const card = e.target.closest('.sound-card');
    if (card) playCard(Number(card.dataset.index));
  });
})();
