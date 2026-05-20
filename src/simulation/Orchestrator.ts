import { useSimulationStore, type Task, type Blade } from '../store';
import { INITIAL_DATA } from './data';

/**
 * AI Orchestration Layer
 * Handles the async "Thinking" state and simulates physical task delegation.
 */
export class ProjectManager {
  private static instance: ProjectManager;

  public static getInstance(): ProjectManager {
    if (!ProjectManager.instance) {
      ProjectManager.instance = new ProjectManager();
    }
    return ProjectManager.instance;
  }

  public initializeAgents() {
    const store = useSimulationStore.getState();
    const { agents, metadata } = INITIAL_DATA;

    // 1. Initialize Agents from Excel positions
    agents.forEach((a: any) => {
      const agentMeta = (metadata.agents as any)[a.id];
      let role: any = 'Sub-Agent';
      if (agentMeta?.role?.includes('Company Manager')) role = 'Agent';
      else if (agentMeta?.role?.includes('Department Manager')) role = 'Manager';

      store.updateAgent(a.id, {
        id: a.id,
        name: agentMeta?.role || a.id,
        role: role,
        status: 'Idle',
        location: { x: a.x * 32 + 16, y: a.y * 32 + 16 },
        isThinking: false
      });
    });

    // Special cases (Receptionist/Client if not in Excel yet or as fallback)
    if (!store.agents['receptionist']) {
      store.updateAgent('receptionist', {
        id: 'receptionist', name: 'Receptionist', role: 'Receptionist',
        status: 'Ready', location: { x: 3.5 * 32 + 16, y: 11.5 * 32 + 16 }, isThinking: false
      });
    }

    if (!store.agents['client']) {
      store.updateAgent('client', {
        id: 'client', name: 'Client', role: 'Client',
        status: 'Entering', location: { x: 0 * 32 + 16, y: 7 * 32 + 16 }, isThinking: false,
        targetLocation: { x: 2 * 32 + 16, y: 11 * 32 + 16 },
        carryingTaskId: 'initial-client-box'
      });
    }

    // Initial Task
    store.addProject({
      id: 'p-initial',
      name: 'Client Project',
      status: 'Active',
      tasks: [
        { id: 'initial-client-box', name: 'Original Request', dept: 'Executive Management', status: 'Reception', blades: [] }
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
    if (!client) return;

    // 1. Client arrives at Reception
    if (client.status === 'Entering' && !client.targetLocation) {
       console.log("[Simulation] Client arrived at Reception.");
       store.updateAgent('client', { status: 'Placing Box' });
       setTimeout(() => {
          store.updateAgent('client', { status: 'Leaving', carryingTaskId: undefined, targetLocation: { x: 0 * 32 + 16, y: 7 * 32 + 16 } });
          store.updateAgent('receptionist', { status: 'Picking up Box', carryingTaskId: 'initial-client-box' });
          setTimeout(() => this.moveReceptionistToMeeting(), 2000);
       }, 2000);
    }

    // 2. Manager returns to Department and drops box
    const managers = Object.values(agents).filter(a => a.role === 'Manager');
    managers.forEach(m => {
       if (m.status === 'Returning to Dept' && !m.targetLocation && m.carryingTaskId) {
          console.log(`[Simulation] ${m.name} arrived at Dept Inbox.`);
          const taskId = m.carryingTaskId;
          store.updateAgent(m.id, { status: 'Idle', carryingTaskId: undefined });
          store.updateTask('p-initial', taskId, 'In-Dept');
       }
    });

    // 3. Sub-agents pick up blades from boxes in their department
    const subAgents = Object.values(agents).filter(a => a.role === 'Sub-Agent');
    subAgents.forEach(sa => {
       if (sa.status === 'Waiting') {
          const project = store.projects[0];
          if (!project) return;
          const taskInDept = project.tasks.find(t => t.dept === sa.dept && t.status === 'In-Dept');
          
          if (taskInDept && taskInDept.blades && taskInDept.blades.length > 0) {
             const pendingBlade = taskInDept.blades.find(b => b.status === 'Pending');
             if (pendingBlade) {
                console.log(`[Simulation] ${sa.name} taking blade ${pendingBlade.id}`);
                const inbox = this.getDeptInboxLocation(sa.dept!);
                store.updateAgent(sa.id, { 
                   status: 'Picking up Blade', 
                   targetLocation: inbox,
                   carryingBladeId: pendingBlade.id
                });
                this.updateBladeStatus(project.id, taskInDept.id, pendingBlade.id, 'At-Desk');
                
                // Working sequence
                setTimeout(() => {
                   const desk = this.getSubAgentDeskLocation(sa.id);
                   store.updateAgent(sa.id, { 
                      status: 'Working at Desk', 
                      targetLocation: { x: desk.x + 16, y: desk.y } // Move to right side of desk
                   });
                   
                   // Finish work after some time
                   setTimeout(() => {
                      const reviewSpot = this.getDeptReviewLocation(sa.dept!);
                      store.updateAgent(sa.id, {
                         status: 'Moving to Review Desk',
                         targetLocation: reviewSpot
                      });
                      
                      setTimeout(() => {
                         store.updateAgent(sa.id, {
                            status: 'Waiting',
                            carryingBladeId: undefined,
                            targetLocation: { x: desk.x - 16, y: desk.y }
                         });
                         this.updateBladeStatus(project.id, taskInDept.id, pendingBlade.id, 'Review');
                      }, 4000);
                   }, 5000);
                }, 4000);
             }
          }
       }
    });

    // 4. Manager reviews blades
    managers.forEach(m => {
       if (m.status === 'Idle') {
          const project = store.projects[0];
          if (!project) return;
          const taskInDept = project.tasks.find(t => t.dept === m.dept && t.status === 'In-Dept');
          
          if (taskInDept && taskInDept.blades) {
             const reviewBlade = taskInDept.blades.find(b => b.status === 'Review');
             
             if (reviewBlade) {
                const reviewSpot = this.getDeptReviewLocation(m.dept!);
                store.updateAgent(m.id, {
                   status: 'Reviewing Blade',
                   targetLocation: reviewSpot,
                   carryingBladeId: reviewBlade.id
                });
                
                setTimeout(() => {
                   const inbox = this.getDeptInboxLocation(m.dept!);
                   store.updateAgent(m.id, {
                      status: 'Idle',
                      targetLocation: inbox,
                      carryingBladeId: undefined
                   });
                   this.updateBladeStatus(project.id, taskInDept.id, reviewBlade.id, 'Complete');
                   
                   // If all blades complete, task is complete
                   const currentProject = store.projects.find(p => p.id === project.id);
                   const currentTask = currentProject?.tasks.find(t => t.id === taskInDept.id);
                   if (currentTask && currentTask.blades.every(b => b.status === 'Complete')) {
                      store.updateTask(project.id, taskInDept.id, 'Complete');
                      store.recordCompletion();
                   }
                }, 3000);
             }
          }
       }
    });
  }

  public getDeptReviewLocation(dept: string): { x: number, y: number } {
     return this.getDeptInboxLocation(dept);
  }

  private updateBladeStatus(projId: string, taskId: string, bladeId: string, status: Blade['status']) {
     const store = useSimulationStore.getState();
     const project = store.projects.find(p => p.id === projId);
     if (project) {
        const tasks = project.tasks.map(t => {
           if (t.id === taskId) {
              return { ...t, blades: t.blades.map(b => b.id === bladeId ? { ...b, status } : b) };
           }
           return t;
        });
        store.updateProject({ ...project, tasks });
     }
  }

  private getSubAgentDeskLocation(id: string): { x: number, y: number } {
     const agent = INITIAL_DATA.agents.find((a: any) => a.id === id);
     return agent ? { x: agent.x * 32 + 16, y: agent.y * 32 + 16 } : { x: 0, y: 0 };
  }

  private getDeptInboxLocation(dept: string): { x: number, y: number } {
     const prefixMap: Record<string, string> = {
        "Executive Management": "A",
        "Software & Systems Development": "B",
        "Data Analysis & Decision Systems": "C",
        "Security, Compliance & Risk": "D",
        "Client Relations & Communications": "E",
        "Creative Digital Media": "F",
        "Automation & Tool Operations": "G",
        "Multimodal Interaction & Human Interface": "H",
        "Research & Intelligence": "I",
        "3D Visualisation & Simulation": "J",
        "Memory, Knowledge & Training": "K",
        "Company Management": "L"
     };
     const prefix = prefixMap[dept];
     const manager = INITIAL_DATA.agents.find((a: any) => a.id === `${prefix}1`);
     return manager ? { x: manager.x * 32 + 16, y: manager.y * 32 + 16 } : { x: 0, y: 0 };
  }

  private moveReceptionistToMeeting() {
    const store = useSimulationStore.getState();
    store.updateAgent('receptionist', { 
      status: 'Moving to Meeting Room', 
      targetLocation: { x: 12 * 32 + 16, y: 17.5 * 32 + 16 } 
    });

    // Summon Managers to unique spots around the large table
    const managers = Object.values(store.agents).filter(a => a.role === 'Manager');
    const offsets = [
       { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -2, y: 0 }, 
       { x: 2, y: 0 }, { x: -1, y: 1 }, { x: 1, y: 1 }
    ];

    managers.forEach((m, i) => {
       const offset = offsets[i % offsets.length];
       store.updateAgent(m.id, { 
         status: 'Heading to Meeting', 
         targetLocation: { x: (12 + offset.x) * 32 + 16, y: (17.5 + offset.y) * 32 + 16 } 
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
    const depts = ["Software & Systems Development", "Research & Intelligence", "3D Visualisation & Simulation", "Memory, Knowledge & Training", "Executive Management", "Creative Digital Media", "Client Relations & Communications"];
       
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

       store.updateProject({
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

       store.updateAgent('receptionist', { status: 'Returning to Desk', carryingTaskId: undefined, targetLocation: { x: 3.5 * 32 + 16, y: 11.5 * 32 + 16 } });
    } else {
       setTimeout(() => this.waitForMeetingArrival(), 1000);
    }
  }
}
