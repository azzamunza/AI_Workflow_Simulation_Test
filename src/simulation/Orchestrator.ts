import { useSimulationStore } from '../store';

/**
 * AI Orchestration Layer
 * Handles the async "Thinking" state and simulates physical task delegation.
 */
export class ProjectManager {
  private static instance: ProjectManager;
  private isThinking: boolean = false;

  public static getInstance(): ProjectManager {
    if (!ProjectManager.instance) {
      ProjectManager.instance = new ProjectManager();
    }
    return ProjectManager.instance;
  }

  public initializeAgents() {
    const store = useSimulationStore.getState();
    
    // 1. Receptionist
    store.updateAgent('receptionist', {
      id: 'receptionist', name: 'Receptionist', role: 'Receptionist',
      status: 'Ready', location: { x: 8 * 32, y: 23 * 32 }, isThinking: false
    });

    // 2. Client (Enters through front)
    store.updateAgent('client', {
      id: 'client', name: 'Client', role: 'Client',
      status: 'Entering', location: { x: 0, y: 23 * 32 }, isThinking: false,
      targetLocation: { x: 7 * 32, y: 23 * 32 }
    });

    // 3. Dept Managers & Sub-Agents
    const depts = ["Art", "Programming", "QA", "Research", "AI Ops", "Planning"];
    depts.forEach(dept => {
      // Manager
      store.updateAgent(`manager-${dept}`, {
        id: `manager-${dept}`, name: `${dept} Manager`, role: 'Manager', dept,
        status: 'Idle', location: { x: 0, y: 0 }, isThinking: false
      });
      // Sub-Agents
      for (let i = 1; i <= 2; i++) {
        store.updateAgent(`sub-${dept}-${i}`, {
          id: `sub-${dept}-${i}`, name: `${dept} Agent ${i}`, role: 'Sub-Agent', dept,
          status: 'Waiting', location: { x: 0, y: 0 }, isThinking: false
        });
      }
    });
  }

  public async triggerMeeting(managerId: string) {
    const store = useSimulationStore.getState();
    store.updateAgent(managerId, {
      status: 'Heading to meeting',
      targetLocation: { x: 40 * 32, y: 15 * 32 }
    });
  }
}
