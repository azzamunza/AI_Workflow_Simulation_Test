import { useEffect, useRef } from 'react';
import { initGame } from './simulation/Game';
import { HUD } from './components/HUD';

function App() {
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = initGame('game-container');
    }
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000', overflow: 'hidden', position: 'relative' }}>
      <div id="game-container" style={{ width: '100%', height: '100%' }} />
      <HUD />
    </div>
  );
}

export default App;
