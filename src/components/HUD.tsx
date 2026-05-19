import React from 'react';
import { useSimulationStore } from '../store';

export const HUD: React.FC = () => {
  const agents = useSimulationStore((state) => state.agents);
  const projects = useSimulationStore((state) => state.projects);
  const completedCount = useSimulationStore((state) => state.completedTasks);
  const bottlenecks = useSimulationStore((state) => state.bottlenecks);

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
      flexDirection: 'column',
      gap: '20px',
      width: '100%'
    }}>
      <div style={{ display: 'flex', gap: '40px' }}>
        <div id="agent-section">
          <h2 id="hud-title" style={{ margin: 0 }}>AI Office Simulation v1.2</h2>
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
                    <div key={task.id} style={{ 
                      opacity: task.status === 'Complete' ? 0.3 : 1.0,
                      color: task.status === 'Stubbed' ? '#ffff00' : 'white',
                      textDecoration: task.status === 'Complete' ? 'line-through' : 'none'
                    }}>
                      - [{task.status}] {task.name} ({task.dept})
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div id="analytics-section" style={{ 
        backgroundColor: 'rgba(0,0,0,0.5)', 
        padding: '15px', 
        borderRadius: '8px',
        border: '1px solid #444',
        alignSelf: 'flex-start'
      }}>
        <h3 style={{ margin: 0, color: '#00ff00' }}>Office Analytics</h3>
        <div style={{ marginTop: '10px', fontSize: '14px' }}>
          <div>Total Tasks Completed: <strong>{completedCount}</strong></div>
          <div>Active Bottlenecks: <strong style={{ color: bottlenecks.length > 0 ? '#ff4444' : '#00ff00' }}>
            {bottlenecks.length > 0 ? bottlenecks.join(', ') : 'None'}
          </strong></div>
        </div>
      </div>
    </div>
  );
};
