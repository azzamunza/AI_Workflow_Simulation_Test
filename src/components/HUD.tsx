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
      width: '100%',
      height: '100%'
    }}>
      <div style={{ display: 'flex', gap: '40px', flex: 1 }}>
        <div id="agent-section" style={{ width: '300px' }}>
          <h2 id="hud-title" style={{ margin: 0, color: '#00ccff' }}>Simulation Agents</h2>
          <div id="hud-agent-list" style={{ marginTop: '20px', maxHeight: '400px', overflowY: 'auto' }}>
            {Object.values(agents).map((agent) => (
              <div key={agent.id} id={`agent-row-${agent.id}`} style={{ 
                marginBottom: '10px', 
                fontSize: '14px', 
                color: agent.isThinking ? '#ffff00' : 'white',
                borderLeft: agent.carryingTaskId ? '3px solid #00ff00' : 'none',
                paddingLeft: '5px'
              }}>
                 <strong>{agent.name}</strong><br/>
                 <span style={{ fontSize: '11px', opacity: 0.7 }}>
                   {agent.role} | {agent.status}
                 </span>
              </div>
            ))}
          </div>
        </div>

        <div id="project-section" style={{ flex: 1 }}>
          <h2 id="project-title" style={{ margin: 0, color: '#ffcc00' }}>Active Projects</h2>
          <div id="hud-project-list" style={{ marginTop: '20px' }}>
            {projects.length === 0 && <div style={{ opacity: 0.5 }}>Waiting for AI Planning...</div>}
            {projects.map((project) => (
              <div key={project.id} style={{ marginBottom: '15px', backgroundColor: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '5px' }}>
                <strong>📁 {project.name}</strong>
                <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                  {project.tasks.map(task => (
                    <div key={task.id} style={{ 
                      fontSize: '12px',
                      opacity: task.status === 'Complete' ? 0.3 : 1.0,
                      color: task.status === 'Stubbed' ? '#ffff00' : 'white',
                      textDecoration: task.status === 'Complete' ? 'line-through' : 'none',
                      padding: '5px',
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      [{task.status}] {task.name}<br/>
                      <span style={{ opacity: 0.6 }}>Dept: {task.dept}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div id="analytics-section" style={{ 
        backgroundColor: 'rgba(0,0,0,0.7)', 
        padding: '15px', 
        borderRadius: '8px',
        border: '1px solid #444',
        alignSelf: 'flex-start',
        marginBottom: '40px'
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
