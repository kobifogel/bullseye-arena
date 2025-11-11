import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from '@google/genai';

const { useState, useMemo, useCallback, useEffect, useRef } = React;

// from constants.ts
const MAX_GUESSES = 10;
const CODE_LENGTH = 4;
const THEMES = {
  numbers: {
    name: 'מספרים',
    items: ['1', '2', '3', '4', '5', '6', '7', '8'],
  },
  colors: {
    name: 'צבעים',
    items: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'],
  },
  animals: {
    name: 'חיות',
    items: ['🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨'],
     colors: {
        '🐶': '#a16207',
        '🐱': '#c2410c',
        '🐭': '#6b7280',
        '🐰': '#db2777',
        '🦊': '#f59e0b',
        '🐻': '#78350f',
        '🐼': '#e5e7eb',
        '🐨': '#9ca3af',
    },
  },
};
const SOUNDS = {
  click: 'https://kobifogel.github.io/bullseye-arena/sounds/click.wav',
  bull: 'https://kobifogel.github.io/bullseye-arena/sounds/bull.wav',
  hit: 'https://kobifogel.github.io/bullseye-arena/sounds/hit.wav',
  win: 'https://cdn.jsdelivr.net/gh/K-T-Studio/K-T-Studio.github.io/sound/kenney_digitalaudio/Audio/jingles_NES16.ogg',
  select_peg: 'https://kobifogel.github.io/bullseye-arena/sounds/select.wav',
  miss: 'https://kobifogel.github.io/bullseye-arena/sounds/miss.flac',
  select_theme: 'https://cdn.jsdelivr.net/gh/K-T-Studio/K-T-Studio.github.io/sound/kenney_interfacesounds/Audio/rollover2.ogg',
  clear: 'https://cdn.jsdelivr.net/gh/K-T-Studio/K-T-Studio.github.io/sound/kenney_interfacesounds/Audio/minimize_006.ogg'
};


// from utils/stats.ts
const STATS_STORAGE_KEY = 'bullseye_arena_stats';
const getDefaultStats = () => ({
  gamesPlayed: 0,
  gamesWon: 0,
  totalGuessesInWins: 0,
  bestGameGuesses: null,
});
const getAllStats = () => {
  try {
    const statsJson = localStorage.getItem(STATS_STORAGE_KEY);
    return statsJson ? JSON.parse(statsJson) : {};
  } catch (error) {
    console.error("Failed to parse stats from localStorage", error);
    return {};
  }
};
const saveAllStats = (allStats) => {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(allStats));
  } catch (error) {
    console.error("Failed to save stats to localStorage", error);
  }
};
const getStats = (userId) => {
  const allStats = getAllStats();
  return allStats[userId] || getDefaultStats();
};
const updateStats = (userId, gameResult) => {
  const allStats = getAllStats();
  const userStats = allStats[userId] || getDefaultStats();

  userStats.gamesPlayed += 1;
  if (gameResult.won) {
    userStats.gamesWon += 1;
    userStats.totalGuessesInWins += gameResult.guesses;
    if (userStats.bestGameGuesses === null || gameResult.guesses < userStats.bestGameGuesses) {
      userStats.bestGameGuesses = gameResult.guesses;
    }
  }

  allStats[userId] = userStats;
  saveAllStats(allStats);
  return userStats;
};


// from utils/sounds.ts
class SoundManager {
    audioContext = null;
    soundBuffers = new Map();
    unlockPromise = null;

    constructor() {
        if (typeof window !== 'undefined') {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
              this.audioContext = new AudioContext();
            }
        }
    }

    unlockAudio = () => {
        if (!this.audioContext) {
            return Promise.reject(new Error("AudioContext is not supported in this browser."));
        }
        if (this.audioContext.state === 'running') {
            return Promise.resolve();
        }
        if (this.unlockPromise) {
            return this.unlockPromise;
        }
        this.unlockPromise = this.audioContext.resume();
        this.unlockPromise
            .then(() => {
                console.log("AudioContext resumed successfully.");
            })
            .catch((err) => {
                console.error("Failed to resume AudioContext:", err);
            })
            .finally(() => {
                this.unlockPromise = null;
            });
        return this.unlockPromise;
    }

    async load(name, url) {
        if (!this.audioContext) return;
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.soundBuffers.set(name, audioBuffer);
        } catch (error) {
            console.error(`Error loading sound: ${name}`, error);
        }
    }

    loadAll() {
        Object.keys(SOUNDS).forEach(key => {
            this.load(key, SOUNDS[key]);
        });
    }

    play(name) {
        if (!this.audioContext || this.audioContext.state !== 'running') {
            console.warn(`AudioContext not running. Could not play sound: ${name}`);
            return;
        }
        const buffer = this.soundBuffers.get(name);
        if (buffer) {
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);
            source.start(0);
        } else {
            console.warn(`Sound not found or not loaded yet: ${name}`);
        }
    }
}


// from components/BackButton.tsx
const BackButton = ({ onBack }) => {
    return (
        <button
            onClick={onBack}
            className="absolute top-4 left-4 z-20 w-12 h-12 bg-slate-700/80 rounded-full flex items-center justify-center border-2 border-slate-500/80 shadow-lg transform hover:scale-110 active:scale-100 transition-transform animate-fade-in"
            aria-label="חזור לתפריט הראשי"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
        </button>
    );
};


// from components/Peg.tsx
const Peg = ({ value, theme }) => {
  const isColorTheme = theme.name === 'צבעים';

  const pegColor = () => {
    if (isColorTheme) return value;
    if (theme.colors && theme.colors[value]) {
        return theme.colors[value];
    }
    return '#475569';
  };

  return (
    <div 
      className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-3xl md:text-4xl shadow-[inset_0_3px_5px_rgba(0,0,0,0.5)] border-2 border-black/30 font-clash"
      style={{ backgroundColor: pegColor() }}
    >
      {theme.name === 'מספרים' && <span className="drop-shadow-lg text-white">{value}</span>}
      {theme.name === 'חיות' && <span className="drop-shadow-lg">{value}</span>}
    </div>
  );
};


// from components/CodeSelector.tsx
const CodeSelector = ({ theme, onSelectionChange, onSubmit, isSubmitting, submitText = "נחש", playSound }) => {
  const [selection, setSelection] = useState([]);
  
  useEffect(() => {
    onSelectionChange(selection);
  }, [selection, onSelectionChange]);

  const handlePegClick = (peg) => {
    if (selection.length < CODE_LENGTH && !selection.includes(peg)) {
      playSound('select_peg');
      setSelection([...selection, peg]);
    }
  };

  const handleUndo = () => {
    if (selection.length > 0) {
      playSound('clear');
    }
    setSelection(selection.slice(0, -1));
  };

  const handleClear = () => {
    if (selection.length > 0) {
      playSound('clear');
    }
    setSelection([]);
  };

  const pegColor = (item) => {
    if (theme.name === 'צבעים') return item;
    if (theme.colors && theme.colors[item]) {
      return theme.colors[item];
    }
    return '#475569';
  };

  const isSelectionComplete = selection.length === CODE_LENGTH;

  return (
    <div className="p-4 bg-blue-900/50 rounded-2xl border-2 border-blue-700 shadow-inner">
      <div className="grid grid-cols-4 gap-3 mb-4">
        {theme.items.map((item) => (
          <button
            key={item}
            onClick={() => handlePegClick(item)}
            disabled={selection.includes(item) || selection.length >= CODE_LENGTH}
            className="w-full aspect-square rounded-full flex items-center justify-center text-3xl shadow-[inset_0_3px_5px_rgba(0,0,0,0.5)] border-2 border-black/30 font-clash transform hover:scale-110 transition-transform duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            style={{ backgroundColor: pegColor(item) }}
          >
             {theme.name === 'מספרים' && <span className="drop-shadow-lg text-white">{item}</span>}
             {theme.name === 'חיות' && <span className="drop-shadow-lg">{item}</span>}
          </button>
        ))}
      </div>
      <div className="flex justify-center items-center space-x-2 rtl:space-x-reverse mb-4">
          <button onClick={handleClear} className="bg-slate-600 hover:bg-slate-700 p-3 rounded-lg border-b-4 border-slate-800 active:border-b-2 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
           <button onClick={handleUndo} className="bg-slate-600 hover:bg-slate-700 p-3 rounded-lg border-b-4 border-slate-800 active:border-b-2 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.707 17.293a1 1 0 010-1.414L8.414 11H18a1 1 0 100-2H8.414l4.293-4.293a1 1 0 10-1.414-1.414l-6 6a1 1 0 000 1.414l6 6a1 1 0 011.414 0z" /></svg>
          </button>
      </div>
      <button
        onClick={onSubmit}
        disabled={!isSelectionComplete || isSubmitting}
        className={`w-full py-3 px-4 btn-clash font-clash text-lg ${
          !isSelectionComplete || isSubmitting
            ? 'btn-clash-disabled'
            : 'btn-clash-yellow'
        }`}
      >
        {isSubmitting ? '...' : submitText}
      </button>
    </div>
  );
};


// from components/CodeSetter.tsx
const CodeSetter = ({ theme, onCodeSet, gameMode, playSound }) => {
  const [currentCode, setCurrentCode] = useState([]);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleSet = () => {
    if (currentCode.length === CODE_LENGTH) {
      setIsConfirming(true);
    }
  };

  const handleConfirm = () => {
    onCodeSet(currentCode);
  }

  if (isConfirming) {
    const title = gameMode === 'pvp_online' ? 'הקוד נקבע!' : 'הסתר את המסך והעבר לחבר';
    const text = gameMode === 'pvp_online' ? 'המתן לניחוש הראשון של היריב.' : 'הקוד הסודי מוכן. תור החבר לנחש!';
    const buttonText = 'התחל משחק';

    return (
      <div className="p-6 panel-clash text-center">
        <h2 className="text-xl font-clash text-yellow-300 mb-4">{title}</h2>
        
        <div className="mb-6 p-3 bg-black/20 rounded-lg">
          <p className="text-slate-300">הקוד הסודי שקבעת:</p>
          <div className="flex justify-center space-x-2 rtl:space-x-reverse mt-2">
            {currentCode.map((peg, i) => <Peg key={i} value={peg} theme={theme} />)}
          </div>
        </div>

        <p className="text-slate-200 mb-6">{text}</p>
        <button 
          onClick={handleConfirm}
          className="w-full py-3 px-4 btn-clash btn-clash-green font-clash text-lg"
        >
          {buttonText}
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 panel-clash">
      <h2 className="text-2xl font-clash text-yellow-300 text-center mb-4">הגדר קוד סודי</h2>
      <p className="text-slate-200 text-center mb-4">בחר {CODE_LENGTH} פריטים שונים. השחקן השני יצטרך לנחש את הקוד.</p>
      
      <div className="flex justify-center items-center space-x-2 rtl:space-x-reverse mb-4 h-20 p-3 bg-black/20 rounded-lg border border-slate-700/50 shadow-inner">
        {Array.from({ length: CODE_LENGTH }).map((_, i) =>
          currentCode[i] ? (
            <div key={i} className="animate-fade-in">
              <Peg value={currentCode[i]} theme={theme} />
            </div>
          ) : (
            <div
              key={i}
              className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-slate-800/50 border-2 border-slate-700"
            ></div>
          )
        )}
      </div>

      <CodeSelector
        theme={theme}
        onSelectionChange={setCurrentCode}
        onSubmit={handleSet}
        isSubmitting={false}
        submitText="הגדר קוד"
        playSound={playSound}
      />
    </div>
  );
};


// from components/Modal.tsx
const Modal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="panel-clash p-6 w-full max-w-sm mx-auto animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};


// from components/GameBoard.tsx
let ai = null;
try {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
} catch(e) {
  console.error("Failed to initialize GoogleGenAI. AI opponent will be disabled.", e);
}
const getAIGuess = async (turns, theme) => {
    if (!ai) {
      throw new Error("Gemini AI not initialized");
    }
    const history = turns.map(turn => 
      `- Guess: [${turn.guess.join(', ')}], Feedback: {bulls: ${turn.feedback.bulls}, hits: ${turn.feedback.hits}}`
    ).join('\n');
    const prompt = `You are an expert player of a code-breaking game like Mastermind, called Bullseye Arena.
Your goal is to guess a secret code of ${CODE_LENGTH} unique items.
After each guess, you get feedback:
- "bulls": The number of correct items in the correct position.
- "hits": The number of correct items in the wrong position.

The available items for the code are:
[${theme.items.join(', ')}]

Here is the history of your previous guesses and the feedback you received:
${history || 'This is your first guess.'}

Based on this history, what is your next logical guess? Your guess must be an array of ${CODE_LENGTH} unique items from the available items list.
Provide your answer in a JSON object with a single key "guess", which is an array of strings. For example: {"guess": ["item1", "item2", "item3", "item4"]}.
Do not provide any other text or explanation.`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
                guess: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            },
            required: ['guess']
        }
      }
    });
    const jsonText = response.text.trim();
    try {
        const result = JSON.parse(jsonText);
        const guess = result.guess;
        if (
            Array.isArray(guess) &&
            guess.length === CODE_LENGTH &&
            guess.every((item) => typeof item === 'string')
        ) {
            const uniqueItems = [...new Set(guess)];
            const areItemsValid = uniqueItems.every(item => theme.items.includes(item));
            if (uniqueItems.length === CODE_LENGTH && areItemsValid) {
                return uniqueItems;
            }
        }
        console.error("Invalid or non-compliant response from AI, falling back to random guess.", result);
    } catch (error) {
        console.error("Failed to parse AI response, falling back to random guess.", { jsonText, error });
    }
    return theme.items.sort(() => 0.5 - Math.random()).slice(0, CODE_LENGTH);
}
const FeedbackPegs = ({ feedback }) => {
  const pegs = [];
  for (let i = 0; i < feedback.bulls; i++) pegs.push(<div key={`bull-${i}`} className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-yellow-600 shadow-md"></div>);
  for (let i = 0; i < feedback.hits; i++) pegs.push(<div key={`hit-${i}`} className="w-4 h-4 rounded-full bg-slate-300 border-2 border-slate-500 shadow-md"></div>);
  while (pegs.length < CODE_LENGTH) pegs.push(<div key={`empty-${pegs.length}`} className="w-4 h-4 rounded-full bg-slate-700 border-2 border-slate-800 shadow-inner"></div>);
  return <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/20 rounded-md">{pegs}</div>;
};
const RobotIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-cyan-300" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12,2A2,2 0 0,1 14,4V6A2,2 0 0,1 12,8A2,2 0 0,1 10,6V4A2,2 0 0,1 12,2M19,9.5V11A1,1 0 0,1 18,12H6A1,1 0 0,1 5,11V9.5A2.5,2.5 0 0,1 7.5,7H16.5A2.5,2.5 0 0,1 19,9.5M6,13H18V19A1,1 0 0,1 17,20H7A1,1 0 0,1 6,19V13M8,14V17H10V14H8M14,14V17H16V14H14Z" />
    </svg>
);
const GameBoard = ({ secretCode, theme, onRestart, gameMode, playerRole, playSound, user, onGameEnd }) => {
  const [turns, setTurns] = useState([]);
  const [currentGuess, setCurrentGuess] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gameState, setGameState] = useState('playing');
  const scrollContainerRef = useRef(null);
  const isPlayersTurnToGuess = useMemo(() =>
    (gameMode === 'pvc') || 
    (gameMode === 'pvp_local') ||
    (gameMode === 'pvp_online' && playerRole === 'guesser'), 
    [gameMode, playerRole]);
  const isAIsTurnToGuess = gameMode === 'pvp_online' && playerRole === 'setter';
  useEffect(() => {
    if (scrollContainerRef.current) {
      const lastTurnElement = scrollContainerRef.current.querySelector('.animate-fade-in-scale:last-of-type, .active-guess-row');
      if (lastTurnElement) {
        lastTurnElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  }, [turns]);
  const checkGuess = useCallback((guess) => {
    let bulls = 0;
    let hits = 0;
    const secretCodeCopy = [...secretCode];
    const guessCopy = [...guess];
    for (let i = guessCopy.length - 1; i >= 0; i--) {
        if (guessCopy[i] === secretCodeCopy[i]) {
            bulls++;
            secretCodeCopy.splice(i, 1);
            guessCopy.splice(i, 1);
        }
    }
    for (let i = 0; i < guessCopy.length; i++) {
        const indexInSecret = secretCodeCopy.indexOf(guessCopy[i]);
        if (indexInSecret !== -1) {
            hits++;
            secretCodeCopy.splice(indexInSecret, 1);
        }
    }
    if (bulls > 0) playSound('bull');
    else if (hits > 0) playSound('hit');
    else playSound('miss');
    return { bulls, hits };
  }, [secretCode, playSound]);
  const addTurn = useCallback((guess, isPlayerAction) => {
    const feedback = checkGuess(guess);
    const newTurn = { guess, feedback };
    const newTurns = [...turns, newTurn];
    setTurns(newTurns);
    const gameWon = feedback.bulls === CODE_LENGTH;
    const gameLost = newTurns.length >= MAX_GUESSES;
    if (gameWon) {
        playSound('win');
        setGameState('won');
        if (user && isPlayerAction) {
            updateStats(user.id, { won: true, guesses: newTurns.length });
            onGameEnd();
        }
    } else if (gameLost) {
        setGameState('lost');
         if (user && isPlayerAction) {
            updateStats(user.id, { won: false, guesses: newTurns.length });
            onGameEnd();
        }
    }
    setCurrentGuess([]);
    setIsSubmitting(false);
  }, [checkGuess, turns, playSound, user, onGameEnd]);
  useEffect(() => {
    if (isAIsTurnToGuess && gameState === 'playing' && turns.length < MAX_GUESSES) {
        const isAIturn = turns.length % 2 === 0;
        if (isAIturn) {
            setIsSubmitting(true);
            const opponentGuess = async () => {
                try {
                    console.log("AI is thinking...");
                    const guess = ai 
                        ? await getAIGuess(turns, theme) 
                        : theme.items.sort(() => 0.5 - Math.random()).slice(0, CODE_LENGTH);
                    addTurn(guess, false);
                } catch (error) {
                    console.error("AI opponent failed to make a guess, falling back to random.", error);
                    const guess = theme.items.sort(() => 0.5 - Math.random()).slice(0, CODE_LENGTH);
                    addTurn(guess, false);
                }
            };
            const timer = setTimeout(opponentGuess, 1500);
            return () => clearTimeout(timer);
        }
    }
  }, [isAIsTurnToGuess, gameState, turns, theme, addTurn]);
  const handleSubmit = () => {
    if (isPlayersTurnToGuess && currentGuess.length === CODE_LENGTH && !isSubmitting) {
      addTurn(currentGuess, true);
    }
  };
  const remainingGuesses = MAX_GUESSES - turns.length;
  return (
    <div className="p-4 md:p-6 panel-clash max-w-md mx-auto">
        <div className="mb-4">
            <div ref={scrollContainerRef} className="h-[450px] overflow-y-auto pr-2 flex flex-col justify-end space-y-2 bg-black/20 p-2 rounded-lg border border-slate-700/50 shadow-inner">
                {turns.map((turn, turnIndex) => {
                   const isPlayerGuess = (gameMode !== 'pvp_online') || (playerRole === 'guesser');
                   return (
                       <div key={turnIndex} className="flex items-center justify-between space-x-2 rtl:space-x-reverse p-2 bg-slate-800/60 rounded-lg">
                           <div className="flex items-center space-x-2 rtl:space-x-reverse">
                               <span className="text-slate-400 font-bold text-lg w-6 text-center">{turnIndex + 1}</span>
                               {!isPlayerGuess && <RobotIcon />}
                               {turn.guess.map((peg, i) => (
                                <div key={i} className="animate-pop-in" style={{ animationDelay: `${i * 80}ms` }}>
                                  <Peg value={peg} theme={theme} />
                                </div>
                               ))}
                           </div>
                           <FeedbackPegs feedback={turn.feedback} />
                       </div>
                   );
                })}
                {gameState === 'playing' && isPlayersTurnToGuess && remainingGuesses > 0 && (
                  <div className="active-guess-row flex items-center justify-between space-x-2 rtl:space-x-reverse p-2 bg-blue-900/60 rounded-lg border-2 border-yellow-500 shadow-lg">
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <span className="text-yellow-400 font-bold text-lg w-6 text-center">{turns.length + 1}</span>
                      {Array.from({ length: CODE_LENGTH }).map((_, i) =>
                        currentGuess[i] ? (
                          <div key={i} className="animate-fade-in">
                            <Peg value={currentGuess[i]} theme={theme} />
                          </div>
                        ) : (
                          <div
                            key={i}
                            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-slate-800/50 border-2 border-dashed border-slate-600"
                          />
                        )
                      )}
                    </div>
                    <div className="w-[46px] h-[46px] flex-shrink-0" />
                  </div>
                )}
            </div>
            <div className="text-center text-slate-400 mt-2 font-bold">
              ניחושים שנותרו: {remainingGuesses}
            </div>
        </div>
        
        {gameState === 'playing' && (
            isPlayersTurnToGuess ? (
                 <CodeSelector 
                    theme={theme}
                    onSelectionChange={setCurrentGuess}
                    onSubmit={handleSubmit}
                    isSubmitting={isSubmitting}
                    playSound={playSound}
                />
            ) : (
                <div className="text-center p-4 h-[288px] flex flex-col justify-center items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400 mb-4"></div>
                    <p className="text-xl font-bold text-slate-300">ה-AI חושב על המהלך הבא...</p>
                </div>
            )
        )}
        
        <Modal isOpen={gameState === 'won' || gameState === 'lost'} onClose={onRestart}>
            <div className="text-center">
                 <h2 className="text-3xl font-clash text-yellow-300 mb-4">
                    {gameState === 'won' ? 'ניצחון!' : 'הפסד...'}
                </h2>
                <p className="text-slate-200 mb-4">
                    {gameState === 'won' ? `כל הכבוד! פיצחת את הקוד ב-${turns.length} ניחושים.` : 'לא נורא, נסה שוב!'}
                </p>
                <div className="mb-6 p-3 bg-black/20 rounded-lg">
                    <p className="text-slate-300">הקוד הסודי היה:</p>
                    <div className="flex justify-center space-x-2 rtl:space-x-reverse mt-2">
                        {secretCode.map((peg, i) => <Peg key={i} value={peg} theme={theme} />)}
                    </div>
                </div>
                <button onClick={onRestart} className="w-full py-3 px-4 btn-clash btn-clash-blue font-clash text-lg">
                    שחק שוב
                </button>
            </div>
        </Modal>
    </div>
  );
};


// from components/GameModeSelector.tsx
const CrownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-yellow-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L9.208 8.167L2 9.208L7.667 14.792L6.333 22L12 18.5L17.667 22L16.333 14.792L22 9.208L14.792 8.167L12 2Z" />
    </svg>
);
const GameModeSelector = ({ onSelectMode, onOpenSettings, user, onSignIn, onOpenProfile }) => {
  const GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID;
  const isGoogleSignInConfigured = !!GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID_GOES_HERE";
  useEffect(() => {
    if (window.google?.accounts?.id) {
        if (!user && isGoogleSignInConfigured) {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: onSignIn,
          });
          google.accounts.id.renderButton(
            document.getElementById('google-signin-button'),
            { theme: 'outline', size: 'large', type: 'standard', text: 'signin_with', shape: 'pill', locale: 'iw', width: '300' }
          );
        }
    }
  }, [user, onSignIn, isGoogleSignInConfigured, GOOGLE_CLIENT_ID]);
  return (
    <div className="text-center p-6 panel-clash relative">
      <button 
        onClick={onOpenSettings}
        className="absolute top-3 right-3 rtl:right-auto rtl:left-3 z-10 w-10 h-10 bg-slate-700/80 rounded-full flex items-center justify-center border-2 border-slate-500/80 shadow-md hover:bg-slate-600 transition-colors"
        aria-label="הגדרות"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      <div className='flex justify-center mb-4'>
        <CrownIcon />
      </div>
      <h1 className="text-3xl font-clash text-yellow-300 mb-2">
        בול פגיעה
      </h1>
      <p className="text-slate-200 mb-8">בחר/י מצב משחק</p>
      <div className="space-y-4">
        <button
          onClick={() => onSelectMode('pvc')}
          className="w-full py-3 px-4 btn-clash btn-clash-blue font-clash text-lg"
        >
          שחקן נגד מחשב
        </button>
        <button
          onClick={() => onSelectMode('pvp_local')}
          className="w-full py-3 px-4 btn-clash btn-clash-green font-clash text-lg"
        >
          שחקן נגד שחקן (מקומי)
        </button>
        <button
          onClick={() => onSelectMode('pvp_online')}
          disabled={!user}
          className={`w-full py-3 px-4 btn-clash font-clash text-lg ${
            !user ? 'btn-clash-disabled' : 'btn-clash-purple'
          }`}
        >
          שחקן נגד שחקן (רשת)
        </button>
        {user && (
           <button
            onClick={onOpenProfile}
            className="w-full py-3 px-4 btn-clash btn-clash-yellow font-clash text-lg"
           >
             פרופיל
           </button>
        )}
      </div>

       {!user && (
        <div className="mt-8 flex flex-col items-center">
            <p className="text-slate-400 mb-3">יש להתחבר כדי לשחק ברשת</p>
            <div id="google-signin-button"></div>
            {!isGoogleSignInConfigured && (
              <p className="text-yellow-500 text-xs mt-2 text-center max-w-xs">
                למפתחים: יש להגדיר מזהה לקוח של גוגל ב-<code>index.html</code>.
              </p>
            )}
        </div>
      )}

    </div>
  );
};


// from components/OnlineLobby.tsx
const Spinner = () => (
    <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-yellow-400 mb-6"></div>
);
const OnlineLobby = ({ onMatchFound, onBack }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onMatchFound();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onMatchFound]);
  return (
    <div className="text-center p-8 panel-clash flex flex-col items-center">
      <Spinner />
      <h2 className="text-3xl font-clash text-yellow-300 mb-4">
        מחפש יריב...
      </h2>
      <p className="text-slate-200">החיבור יתבצע באופן אוטומטי.</p>
    </div>
  );
};


// from components/ProfileModal.tsx
const StatCard = ({ label, value, icon }) => (
    <div className="bg-slate-800/50 p-3 rounded-lg flex items-center space-x-3 rtl:space-x-reverse">
        <div className="bg-slate-700 p-2 rounded-full">
            {icon}
        </div>
        <div>
            <div className="text-slate-400 text-sm">{label}</div>
            <div className="text-white font-bold text-xl">{value}</div>
        </div>
    </div>
);
const ProfileModal = ({ isOpen, onClose, stats }) => {
  if (!isOpen) return null;
  const winRate = stats && stats.gamesPlayed > 0 ? `${Math.round((stats.gamesWon / stats.gamesPlayed) * 100)}%` : 'N/A';
  const avgGuesses = stats && stats.gamesWon > 0 ? (stats.totalGuessesInWins / stats.gamesWon).toFixed(1) : 'N/A';
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="panel-clash p-6 w-full max-w-sm mx-auto animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-clash text-yellow-300 text-center mb-6">סטטיסטיקה</h2>
        {stats ? (
             <div className="grid grid-cols-2 gap-3">
                <StatCard label="משחקים" value={stats.gamesPlayed} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-300" viewBox="0 0 24 24" fill="currentColor"><path d="M19,13H17V11H19M19,9H17V7H19M19,17H17V15H19M12,3A1,1 0 0,0 11,4V6H5V18H11V20A1,1 0 0,0 12,21A1,1 0 0,0 13,20V18H19V4A1,1 0 0,0 18,3H12M7,16V8H17V16H7Z" /></svg>} />
                <StatCard label="אחוזי נצחון" value={winRate} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" viewBox="0 0 24 24" fill="currentColor"><path d="M16,11.78L20.24,4.45L21.66,5.87L16.42,14.32L12.18,10.08L10.76,11.5L16,16.74V11.78Z" /></svg>} />
                <StatCard label="ממוצע ניחושים" value={avgGuesses} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-400" viewBox="0 0 24 24" fill="currentColor"><path d="M17.45,9.18L15.32,11.32L11.83,7.83L9.68,10L3,3.3L4.42,1.89L11.12,8.59L14.61,5.1L16.76,7.24L22,1.97V8.5H17.45V9.18Z" /></svg>} />
                <StatCard label="משחק שיא" value={stats.bestGameGuesses || 'N/A'} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12,17.27L18.18,21L17,14.64L22,9.73L14.73,8.79L12,2L9.27,8.79L2,9.73L7,14.64L5.82,21L12,17.27Z" /></svg>} />
             </div>
        ) : (
            <p className="text-center text-slate-300">לא נמצאו נתונים.</p>
        )}
        <button onClick={onClose} className="w-full mt-6 py-3 px-4 btn-clash btn-clash-blue font-clash text-lg">
          סגור
        </button>
      </div>
    </div>
  );
};


// from components/SettingsModal.tsx
const SettingsModal = ({ isOpen, onClose, soundEnabled, onToggleSound }) => {
  if (!isOpen) return null;
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="panel-clash p-6 w-full max-w-sm mx-auto animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-clash text-yellow-300 text-center mb-6">הגדרות</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg">
            <label htmlFor="sound-toggle" className="text-xl text-slate-200 font-bold">צלילים</label>
            <button
              id="sound-toggle"
              onClick={onToggleSound}
              className={`w-24 py-2 rounded-lg font-bold border-b-4 transition-colors ${
                soundEnabled 
                ? 'bg-green-500 border-green-700' 
                : 'bg-slate-600 border-slate-800'
              }`}
            >
              {soundEnabled ? 'פועל' : 'כבוי'}
            </button>
          </div>
          <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg opacity-50">
             <span className="text-xl text-slate-200 font-bold">שפה</span>
             <button
              disabled
              className="w-24 py-2 rounded-lg font-bold border-b-4 bg-slate-600 border-slate-800 cursor-not-allowed"
            >
              עברית
            </button>
          </div>
        </div>
        <button onClick={onClose} className="w-full mt-6 py-3 px-4 btn-clash btn-clash-blue font-clash text-lg">
          סגור
        </button>
      </div>
    </div>
  );
};


// from components/ThemeSelector.tsx
const ThemeCard = ({ theme, onClick }) => {
    return (
        <button onClick={onClick} className="w-full bg-gradient-to-b from-[#8c6b4f] to-[#5c402b] p-4 rounded-xl border-2 border-t-[#a18060] border-x-[#422d1b] border-b-4 border-b-[#422d1b] shadow-lg transform hover:scale-105 transition-transform duration-200 flex flex-col items-center space-y-3">
             <h3 className="text-xl font-clash text-yellow-300">{theme.name}</h3>
             <div className="flex space-x-2 rtl:space-x-reverse">
                {theme.items.slice(0, 4).map((item, index) => (
                    <div key={index} className="w-10 h-10 rounded-full flex items-center justify-center text-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] border-2 border-black/20" style={{ backgroundColor: theme.name === 'צבעים' ? item : '#374151' }}>
                        {theme.name !== 'צבעים' && item}
                    </div>
                ))}
             </div>
        </button>
    )
}
const ThemeSelector = ({ onSelectTheme }) => {
  return (
    <div className="text-center p-6 panel-clash">
       <h2 className="text-3xl font-clash text-yellow-300 filter drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)] mb-6">
        בחר/י ערכת נושא
      </h2>
      <div className="space-y-4">
        {Object.keys(THEMES).map(key => (
            <ThemeCard key={key} themeKey={key} theme={THEMES[key]} onClick={() => onSelectTheme(key)} />
        ))}
      </div>
    </div>
  );
};


// from components/UserProfile.tsx
const UserProfile = ({ user, onSignOut, onProfileClick }) => {
  return (
    <div className="absolute top-4 right-4 z-20 flex items-center bg-black/40 p-2 rounded-full shadow-lg animate-fade-in">
      <button onClick={onProfileClick} className="flex items-center text-left rtl:text-right hover:bg-white/10 rounded-full p-1 pr-2 rtl:pr-1 rtl:pl-2 transition-colors">
        <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border-2 border-yellow-400" />
        <div className="mx-2">
          <p className="font-bold text-white text-sm leading-tight">{user.name}</p>
        </div>
      </button>
      <button 
        onClick={(e) => {
            e.stopPropagation();
            onSignOut();
        }}
        className="ml-1 rtl:ml-0 rtl:mr-1 p-2 bg-slate-700/80 rounded-full hover:bg-slate-600 transition-colors"
        aria-label="התנתק"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  );
};


// from App.tsx
const soundManager = new SoundManager();
soundManager.loadAll();

const decodeJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    console.error("Error decoding JWT:", e);
    return null;
  }
};

const App = () => {
  const [gameMode, setGameMode] = useState(null);
  const [theme, setTheme] = useState(null);
  const [secretCode, setSecretCode] = useState([]);
  const [gameState, setGameState] = useState('menu');
  const [playerRole, setPlayerRole] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [user, setUser] = useState(null);
  const [userStats, setUserStats] = useState(null);

  useEffect(() => {
    if (user) {
      setUserStats(getStats(user.id));
    } else {
      setUserStats(null);
    }
  }, [user]);

  const selectedTheme = useMemo(() => {
    if (!theme) return null;
    return THEMES[theme];
  }, [theme]);
  
  const playSound = useCallback((sound) => {
    if (soundEnabled) {
      soundManager.play(sound);
    }
  }, [soundEnabled]);

  useEffect(() => {
    const listener = async (e) => {
      if (e.target instanceof HTMLElement) {
        const button = e.target.closest('button');
        if (button && !button.disabled) {
          try {
            await soundManager.unlockAudio();
            playSound('click');
          } catch (err) {
            console.error("Could not play sound on click:", err);
          }
        }
      }
    };
    
    window.addEventListener('click', listener, { capture: true });
    return () => window.removeEventListener('click', listener, { capture: true });
  }, [playSound]);

  const handleSignIn = (response) => {
    const userData = decodeJwt(response.credential);
    if (userData) {
      setUser({
        id: userData.sub,
        name: userData.given_name || userData.name,
        email: userData.email,
        picture: userData.picture,
      });
    }
  };

  const handleSignOut = () => {
    setUser(null);
    if (window.google) {
      google.accounts.id.disableAutoSelect();
    }
  };

  const handleModeSelect = (mode) => {
    setGameMode(mode);
    setGameState('theme_select');
  };
  
  const handleThemeSelect = (selectedThemeType) => {
    playSound('select_theme');
    setTheme(selectedThemeType);
    if (gameMode === 'pvc') {
      const items = [...THEMES[selectedThemeType].items];
      const code = items.sort(() => 0.5 - Math.random()).slice(0, CODE_LENGTH);
      setSecretCode(code);
      setGameState('playing');
    } else if (gameMode === 'pvp_local') {
      setGameState('code_set');
    } else if (gameMode === 'pvp_online') {
      setGameState('searching');
    }
  };
  
  const handleMatchFound = () => {
    const role = Math.random() < 0.5 ? 'guesser' : 'setter';
    setPlayerRole(role);

    if (role === 'guesser' && theme) {
      const items = [...THEMES[theme].items];
      const code = items.sort(() => 0.5 - Math.random()).slice(0, CODE_LENGTH);
      setSecretCode(code);
      setGameState('playing');
    } else {
      setGameState('code_set');
    }
  };

  const handleCodeSet = (code) => {
    setSecretCode(code);
    setGameState('playing');
  }

  const handleRestart = () => {
    setGameMode(null);
    setTheme(null);
    setSecretCode([]);
    setGameState('menu');
    setPlayerRole(null);
  };
  
  const handleOpenSettings = () => setIsSettingsOpen(true);
  const handleCloseSettings = () => setIsSettingsOpen(false);

  const handleOpenProfile = () => setIsProfileOpen(true);
  const handleCloseProfile = () => setIsProfileOpen(false);
  
  const handleToggleSound = () => setSoundEnabled(prev => !prev);
  
  const handleGameEnd = useCallback(() => {
    if (user) {
        setUserStats(getStats(user.id));
    }
  }, [user]);


  const renderContent = () => {
    switch (gameState) {
      case 'menu':
        return <GameModeSelector onSelectMode={handleModeSelect} onOpenSettings={handleOpenSettings} user={user} onSignIn={handleSignIn} onOpenProfile={handleOpenProfile} />;
      case 'theme_select':
        return <ThemeSelector onSelectTheme={handleThemeSelect} />;
      case 'searching':
        return <OnlineLobby onMatchFound={handleMatchFound} onBack={handleRestart} />;
      case 'code_set':
        if (!theme || !selectedTheme) return null;
        return <CodeSetter theme={selectedTheme} onCodeSet={handleCodeSet} gameMode={gameMode} playSound={playSound} />;
      case 'playing':
        if (!theme || !secretCode.length || !selectedTheme) return null;
        return <GameBoard 
          secretCode={secretCode} 
          theme={selectedTheme} 
          onRestart={handleRestart} 
          gameMode={gameMode} 
          playerRole={playerRole} 
          playSound={playSound}
          user={user}
          onGameEnd={handleGameEnd}
        />;
      default:
        return <GameModeSelector onSelectMode={handleModeSelect} onOpenSettings={handleOpenSettings} user={user} onSignIn={handleSignIn} onOpenProfile={handleOpenProfile} />;
    }
  };

  return (
    <div className="min-h-screen text-white p-4 flex flex-col items-center justify-center relative">
       {gameState !== 'menu' && <BackButton onBack={handleRestart} />}
       {user && <UserProfile user={user} onSignOut={handleSignOut} onProfileClick={handleOpenProfile} />}
      <div className="w-full max-w-md mx-auto">
        <div key={gameState} className="animate-fade-in-scale">
          {renderContent()}
        </div>
      </div>
       <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
      />
      <ProfileModal 
        isOpen={isProfileOpen}
        onClose={handleCloseProfile}
        stats={userStats}
      />
    </div>
  );
};


// from index.tsx
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
