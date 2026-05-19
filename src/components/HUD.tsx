import React from 'react';
import { useSimulationStore } from '../store';

export const HUD: React.FC = () => {
  const agents = useSimulationStore((state) => state.agents);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      padding: '20px',
      color: 'white',
      pointerEvents: 'none',
      fontFamily: 'monospace',
      textShadow: '1px 1px 2px black'
    }}>
      <h2 style={{ margin: 0 }}>AI Office Simulation v1.0</h2>
      <div style={{ marginTop: '20px' }}>
        <strong>Live Agents:</strong>
        {Object.values(agents).map((agent) => (
          <div key={agent.id} style={{ marginLeft: '10px', fontSize: '14px' }}>
            {agent.name} ({agent.role}) - {agent.status} at [{agent.location.x}, {agent.location.y}]
          </div>
        ))}
      </div>
    </div>
  );
};
