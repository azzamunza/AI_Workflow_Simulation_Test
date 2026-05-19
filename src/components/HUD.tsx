import React from 'react';
import { useSimulationStore } from '../store';

export const HUD: React.FC = () => {
  const agents = useSimulationStore((state) => state.agents);

  return (
    <div id="hud-container" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      padding: '20px',
      color: 'white',
      pointerEvents: 'none',
      fontFamily: 'monospace',
      textShadow: '1px 1px 2px black'
    }}>
      <h2 id="hud-title" style={{ margin: 0 }}>AI Office Simulation v1.0</h2>
      <div id="hud-agent-list" style={{ marginTop: '20px' }}>
        <strong id="hud-agents-label">Live Agents:</strong>
        {Object.values(agents).map((agent) => (
          <div key={agent.id} id={`agent-row-${agent.id}`} style={{ marginLeft: '10px', fontSize: '14px' }}>
             <span id={`agent-name-${agent.id}`}>{agent.name}</span> (<span id={`agent-role-${agent.id}`}>{agent.role}</span>) - <span id={`agent-status-${agent.id}`}>{agent.status}</span> at [<span id={`agent-loc-${agent.id}`}>{agent.location.x}, {agent.location.y}</span>]
          </div>
        ))}
      </div>
    </div>
  );
};
