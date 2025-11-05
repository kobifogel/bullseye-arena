import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { GameMode, ThemeType, PlayerRole, SoundEffect, User } from './types';
import { THEMES, CODE_LENGTH } from './constants';
import GameModeSelector from './components/GameModeSelector';
import ThemeSelector from './components/ThemeSelector';
import GameBoard from './components/GameBoard';
import CodeSetter from './components/CodeSetter';
import OnlineLobby from './components/OnlineLobby';
import SettingsModal from './components/SettingsModal';
import BackButton from './components/BackButton';
import UserProfile from './components/UserProfile';
import { SoundManager } from './utils/sounds';

type GameState = 'menu' | 'theme_select' | 'searching' | 'code_set' | 'playing';

// Initialize sound manager
const soundManager = new SoundManager();
soundManager.loadAll();

const decodeJwt = (token: string) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    console.error("Error decoding JWT:", e);
    return null;
  }
};


const App: React.FC = () => {
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [theme, setTheme] = useState<ThemeType | null>(null);
  const [secretCode, setSecretCode] = useState<string[]>([]);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [playerRole, setPlayerRole] = useState<PlayerRole | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const selectedTheme = useMemo(() => {
    if (!theme) return null;
    return THEMES[theme];
  }, [theme]);
  
  const playSound = useCallback((sound: SoundEffect) => {
    if (soundEnabled) {
      soundManager.play(sound);
    }
  }, [soundEnabled]);

  useEffect(() => {
    const listener = async (e: MouseEvent) => {
      // On any user click, we attempt to unlock the AudioContext.
      // This is required by modern browsers before any sound can be played.
      const unlockPromise = soundManager.unlockAudio();

      // If the click was on a button, we await the unlock and then play a sound.
      if (e.target instanceof HTMLElement && e.target.closest('button')) {
        try {
            // Awaiting the unlock promise ensures the context is ready for the first click sound.
            // This fixes the issue where the very first click might not produce sound.
            await unlockPromise;
            playSound('click');
        } catch (err) {
            console.error("Could not play sound on click:", err);
        }
      }
    };
    
    // Use capture to play sound on press down for better perceived responsiveness
    window.addEventListener('click', listener, { capture: true });
    return () => window.removeEventListener('click', listener, { capture: true });
  }, [playSound]);

  const handleSignIn = (response: any) => {
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
    // Optional: Add logic to revoke token if necessary
    // @ts-ignore
    if (window.google) {
      // @ts-ignore
      google.accounts.id.disableAutoSelect();
    }
  };


  const handleModeSelect = (mode: GameMode) => {
    setGameMode(mode);
    setGameState('theme_select');
  };
  
  const handleThemeSelect = (selectedThemeType: ThemeType) => {
    setTheme(selectedThemeType);
    if (gameMode === 'pvc') {
      const items = [...THEMES[selectedThemeType].items];
      // Shuffle items and pick the first CODE_LENGTH to ensure no duplicates
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
    const role: PlayerRole = Math.random() < 0.5 ? 'guesser' : 'setter';
    setPlayerRole(role);

    if (role === 'guesser' && theme) {
      // Opponent sets the code
      const items = [...THEMES[theme].items];
      // Shuffle items and pick the first CODE_LENGTH to ensure no duplicates
      const code = items.sort(() => 0.5 - Math.random()).slice(0, CODE_LENGTH);
      setSecretCode(code);
      setGameState('playing');
    } else {
      // Player sets the code
      setGameState('code_set');
    }
  };

  const handleCodeSet = (code: string[]) => {
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
  const handleToggleSound = () => setSoundEnabled(prev => !prev);


  const renderContent = () => {
    switch (gameState) {
      case 'menu':
        return <GameModeSelector onSelectMode={handleModeSelect} onOpenSettings={handleOpenSettings} user={user} onSignIn={handleSignIn} />;
      case 'theme_select':
        return <ThemeSelector onSelectTheme={handleThemeSelect} />;
      case 'searching':
        return <OnlineLobby onMatchFound={handleMatchFound} onBack={handleRestart} />;
      case 'code_set':
        if (!theme || !selectedTheme) return null;
        return <CodeSetter theme={selectedTheme} onCodeSet={handleCodeSet} gameMode={gameMode} />;
      case 'playing':
        if (!theme || !secretCode.length || !selectedTheme) return null;
        return <GameBoard secretCode={secretCode} theme={selectedTheme} onRestart={handleRestart} gameMode={gameMode} playerRole={playerRole} playSound={playSound} />;
      default:
        return <GameModeSelector onSelectMode={handleModeSelect} onOpenSettings={handleOpenSettings} user={user} onSignIn={handleSignIn} />;
    }
  };

  return (
    <div className="min-h-screen text-white p-4 flex flex-col items-center justify-center relative">
       {gameState !== 'menu' && <BackButton onBack={handleRestart} />}
       {user && <UserProfile user={user} onSignOut={handleSignOut} />}
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
    </div>
  );
};

export default App;