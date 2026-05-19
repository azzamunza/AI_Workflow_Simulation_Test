import React from 'react';
import { useSimulationStore } from '../store';

export const HUD: React.FC = () => {
  const agents = useSimulationStore((state) => state.agents);
  const projects = useSimulationStore((state) => state.projects);

  return (
    <div id="hud-container" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      padding: '20px',
      color: 'white',
      pointerEvents: 'none',
      fontFamily: 'monospace',
      textShadow: '1px 1px 2px black',
      display: 'flex',
      gap: '40px'
    }}>
      <div id="agent-section">
        <h2 id="hud-title" style={{ margin: 0 }}>AI Office Simulation v1.1</h2>
        <div id="hud-agent-list" style={{ marginTop: '20px' }}>
          <strong id="hud-agents-label">Live Agents:</strong>
          {Object.values(agents).map((agent) => (
            <div key={agent.id} id={`agent-row-${agent.id}`} style={{ 
              marginLeft: '10px', 
              fontSize: '14px', 
              color: agent.isThinking ? '#ffff00' : 'white' 
            }}>
               <span id={`agent-name-${agent.id}`}>{agent.name}</span> (<span id={`agent-role-${agent.id}`}>{agent.role}</span>) - <span id={`agent-status-${agent.id}`}>{agent.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div id="project-section">
        <h2 id="project-title" style={{ margin: 0 }}>Active Projects</h2>
        <div id="hud-project-list" style={{ marginTop: '20px' }}>
          {projects.length === 0 && <div style={{ opacity: 0.5 }}>Waiting for AI Planning...</div>}
          {projects.map((project) => (
            <div key={project.id} style={{ marginBottom: '15px' }}>
              <strong>📁 {project.name}</strong>
              <div style={{ marginLeft: '15px', fontSize: '12px' }}>
                {project.tasks.map(task => (
                  <div key={task.id} style={{ opacity: 0.8 }}>
                    - [{task.status}] {task.name} ({task.dept})
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
