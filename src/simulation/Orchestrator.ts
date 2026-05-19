import { useSimulationStore, Task } from '../store';

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
    
    // 1. Receptionist (at desk)
    store.updateAgent('receptionist', {
      id: 'receptionist', name: 'Receptionist', role: 'Receptionist',
      status: 'Ready', location: { x: 8 * 32 + 16, y: 23 * 32 + 16 }, isThinking: false
    });

    // 2. Client (starts outside)
    store.updateAgent('client', {
      id: 'client', name: 'Client', role: 'Client',
      status: 'Entering', location: { x: 0, y: 23 * 32 + 16 }, isThinking: false,
      targetLocation: { x: 7 * 32 + 16, y: 23 * 32 + 16 },
      carryingTaskId: 'initial-client-box' // Client starts with the box
    });

    // 3. Dept Managers & Sub-Agents (start in their depts)
    const depts = ["Art", "Programming", "QA", "Research", "AI Ops", "Planning"];
    depts.forEach(dept => {
      // Manager (at centroid/desk)
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

    // Initial Task
    store.addProject({
      id: 'p-initial',
      name: 'Client Project',
      status: 'Active',
      tasks: [
        { id: 'initial-client-box', name: 'Original Request', dept: 'Reception', status: 'Reception', blades: [] }
      ]
    });
  }

  /**
   * Main Simulation Logic loop (ticks externally or via timeouts)
   */
  public step() {
    const store = useSimulationStore.getState();
    const agents = store.agents;
    const client = agents['client'];
    const receptionist = agents['receptionist'];

    // 1. Client arrives at Reception
    if (client.status === 'Entering' && !client.targetLocation) {
       console.log("[Simulation] Client arrived at Reception.");
       store.updateAgent('client', { status: 'Placing Box' });
       setTimeout(() => {
          // Drop box for receptionist
          store.updateAgent('client', { status: 'Leaving', carryingTaskId: undefined, targetLocation: { x: 0, y: 23 * 32 + 16 } });
          store.updateAgent('receptionist', { status: 'Picking up Box', carryingTaskId: 'initial-client-box' });
          
          // Next step: Move to meeting
          setTimeout(() => this.moveReceptionistToMeeting(), 2000);
       }, 2000);
    }
  }

  private moveReceptionistToMeeting() {
    const store = useSimulationStore.getState();
    store.updateAgent('receptionist', { 
      status: 'Moving to Meeting Room', 
      targetLocation: { x: 40 * 32 + 16, y: 15 * 32 + 16 } 
    });

    // Summon Managers
    const managers = Object.values(store.agents).filter(a => a.role === 'Manager');
    managers.forEach(m => {
       store.updateAgent(m.id, { 
         status: 'Heading to Meeting', 
         targetLocation: { x: 40 * 32 + 16, y: 15 * 32 + 16 } 
       });
    });

    // Check for arrival loop
    this.waitForMeetingArrival();
  }

  private waitForMeetingArrival() {
    const store = useSimulationStore.getState();
    const agents = store.agents;
    const receptionist = agents['receptionist'];
    const managers = Object.values(agents).filter(a => a.role === 'Manager');

    const allAtMeeting = !receptionist.targetLocation && managers.every(m => !m.targetLocation);

    if (allAtMeeting) {
       console.log("[Simulation] Meeting in progress. Duplicating box for managers.");
       // Duplicate logic
       const project = store.projects[0];
       const depts = ["Art", "Programming", "QA", "Research", "AI Ops", "Planning"];
       
       const newTasks: Task[] = depts.map(dept => ({
          id: `task-${dept}`,
          name: `${dept} Project Segment`,
          dept,
          status: 'Meeting',
          blades: [
            { id: `b-${dept}-1`, taskId: `task-${dept}`, status: 'Pending', workProgress: 0 },
            { id: `b-${dept}-2`, taskId: `task-${dept}`, status: 'Pending', workProgress: 0 }
          ]
       }));

       store.addProject({
          ...project,
          tasks: [...project.tasks, ...newTasks]
       });

       // Assign boxes to managers
       managers.forEach(m => {
          store.updateAgent(m.id, { 
            status: 'Returning to Dept', 
            carryingTaskId: `task-${m.dept}`,
            targetLocation: this.getDeptInboxLocation(m.dept!)
          });
       });

       store.updateAgent('receptionist', { status: 'Returning to Desk', carryingTaskId: undefined, targetLocation: { x: 8 * 32 + 16, y: 23 * 32 + 16 } });
    } else {
       setTimeout(() => this.waitForMeetingArrival(), 1000);
    }
  }

  private getDeptInboxLocation(dept: string): { x: number, y: number } {
    const centroids: Record<string, { x: number, y: number }> = {
      "Research": { x: 6 * 32 + 16, y: 6 * 32 + 16 },
      "PM": { x: 56 * 32 + 16, y: 6 * 32 + 16 },
      "Art": { x: 6 * 32 + 16, y: 36 * 32 + 16 },
      "Programming": { x: 56 * 32 + 16, y: 36 * 32 + 16 },
      "AI Ops": { x: 26 * 32 + 16, y: 6 * 32 + 16 },
      "QA": { x: 26 * 32 + 16, y: 36 * 32 + 16 },
      "Planning": { x: 46 * 32 + 16, y: 36 * 32 + 16 }
    };
    return centroids[dept] || { x: 0, y: 0 };
  }

  private setThinking(id: string, value: boolean) {
    this.isThinking = value;
    useSimulationStore.getState().updateAgent(id, { 
      isThinking: value,
      status: value ? 'Thinking...' : 'Idle'
    });
  }
}
