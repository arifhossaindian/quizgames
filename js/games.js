'use strict';
/* ============ Game Loader ============
 * এটা শুধু js/games/ folder-এর সব game file load করে।
 * নতুন game যোগ করতে: js/games/ folder-এ ফাইল বানাও (gameName.js) → ব্যস!
 * মুছতে: ফাইলটা delete করো → ব্যস!
 * index.html-এ script tag যোগ করতে হবে না।
 */
window.GAMES = [];
window.GameRegistry = {
  register(game) {
    if (!game || !game.id) return;
    window.GAMES.push(game);
  }
};

/* dynamic loader — js/games/ folder-এর সব .js file খুঁজে বের করে */
(function() {
  const GAME_FILES = ['spin', 'image', 'word', 'wordbuilder', 'wordgap', 'wrong', 'opposite', 'trivia', 'mood'];
  const loaded = GAME_FILES.map(name => new Promise(res => {
    const s = document.createElement('script');
    s.src = 'js/games/' + name + '.js';
    s.onload = () => res(true);
    s.onerror = () => res(false);
    document.head.appendChild(s);
  }));
  Promise.all(loaded).then(() => {
    /* sort by id so order is stable */
    window.GAMES.sort((a, b) => a.id.localeCompare(b.id));
    /* mood game always last */
    const moodIdx = window.GAMES.findIndex(g => g.id === 'mood');
    if (moodIdx >= 0) {
      const [m] = window.GAMES.splice(moodIdx, 1);
      window.GAMES.push(m);
    }
    window.dispatchEvent(new Event('games-ready'));
  });
})();
