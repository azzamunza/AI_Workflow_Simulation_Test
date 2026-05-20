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
    const { agents, desks, metadata } = INITIAL_DATA;

    const prefixToRoom: Record<string, number> = {
      "A": 11, "B": 12, "C": 13, "D": 14, "E": 15, "F": 16, "G": 17, "H": 18, "I": 19, "J": 20, "K": 21, "L": 8
    };

    // 1. Initialize Agents from Excel positions
    agents.forEach((a: any) => {
      const agentMeta = (metadata.agents as any)[a.id];
      let role: any = 'Sub-Agent';
      if (agentMeta?.role?.includes('Company Manager')) role = 'Agent';
      else if (agentMeta?.role?.includes('Department Manager')) role = 'Manager';

      const spawnX = a.x * 32 + 16;
      const spawnY = a.y * 32 + 16;

      const prefix = a.id.charAt(0);
      const roomId = prefixToRoom[prefix];
      const deskType = role === 'Agent' ? 'CMD' : (role === 'Manager' ? 'DMD' : 'SAD');
      
      const myDesk = (desks as any[]).find(d => d.room === roomId && d.type === deskType && !d.occupied);
      let targetPos = { x: spawnX, y: spawnY };
      
      if (myDesk) {
         myDesk.occupied = true;
         const tile = myDesk.tiles[0];
         targetPos = { x: (tile.x + 1) * 32 + 16, y: tile.y * 32 + 16 }; 
      }

      store.updateAgent(a.id, {
        id: a.id,
        name: agentMeta?.role || a.id,
        role: role,
        status: 'Walking to Desk',
        location: { x: spawnX, y: spawnY },
        targetLocation: targetPos,
        isThinking: false
      });
    });

    // 2. Add Receptionist
    const receptionDesk = (desks as any[]).find(d => d.type === 'RCD');
    const receptionistId = 'receptionist';
    if (receptionDesk) {
        const deskTile = receptionDesk.tiles[0];
        store.updateAgent(receptionistId, {
            id: receptionistId, name: 'Receptionist', role: 'Receptionist',
            status: 'At Desk',
            location: { x: (deskTile.x + 1) * 32 + 16, y: deskTile.y * 32 + 16 },
            isThinking: false
        });
    }

    // 3. Client
    const entranceSpawn = { x: 0 * 32 + 16, y: 5 * 32 + 16 };
    if (receptionDesk) {
        const deskTile = receptionDesk.tiles[0];
        const stopPos = { x: (deskTile.x - 1) * 32 + 16, y: deskTile.y * 32 + 16 };
        store.updateAgent('client', {
          id: 'client', name: 'Client', role: 'Client',
          status: 'Entering', 
          location: entranceSpawn, 
          isThinking: false,
          targetLocation: stopPos,
          carryingTaskId: 'initial-client-box'
        });
    }

    // Initial Task
    store.addProject({
      id: 'p-initial',
      name: 'Client Project',
      status: 'Active',
      tasks: [
        { id: 'initial-client-box', name: 'Original Request', dept: 'Client Relations & Communications', status: 'Reception', blades: [] }
      ]
    });
  }

  public step() {
    const store = useSimulationStore.getState();
    const agents = store.agents;
    const client = agents['client'];
    if (!client) return;

    // 1. Client arrives at Reception
    if (client.status === 'Entering' && !client.targetLocation) {
       store.updateAgent('client', { status: 'Placing Box' });
       
       const receptionDesk = (INITIAL_DATA.desks as any[]).find(d => d.type === 'RCD');
       const deskTile = receptionDesk?.tiles[0];
       const dropPos = deskTile ? { x: deskTile.x * 32 + 16, y: deskTile.y * 32 + 16 } : undefined;

       setTimeout(() => {
          store.updateAgent('client', { status: 'Leaving', carryingTaskId: undefined, targetLocation: { x: 0 * 32 + 16, y: 5 * 32 + 16 } });
          const project = store.projects[0];
          if (project) {
              const updatedTasks = project.tasks.map(t => t.id === 'initial-client-box' ? { ...t, placedAt: dropPos } : t);
              store.updateProject({ ...project, tasks: updatedTasks });
          }
          
          if (dropPos) {
              store.updateAgent('receptionist', { status: 'Picking up Box', targetLocation: dropPos });
              this.waitForReceptionistPickUp('initial-client-box');
          }
       }, 2000);
    }

    // 2. Managers return to Dept
    const managers = Object.values(agents).filter(a => a.role === 'Manager');
    managers.forEach(m => {
       if (m.status === 'Returning to Dept' && !m.targetLocation && m.carryingTaskId) {
          const taskId = m.carryingTaskId;
          const prefix = m.id.charAt(0);
          const prefixToRoom: Record<string, number> = { "A": 11, "B": 12, "C": 13, "D": 14, "E": 15, "F": 16, "G": 17, "H": 18, "I": 19, "J": 20, "K": 21, "L": 8 };
          const roomId = prefixToRoom[prefix];
          const jobDesk = (INITIAL_DATA.desks as any[]).find(d => d.room === roomId && d.type === 'DJD');
          const deskTile = jobDesk?.tiles[0];
          const dropPos = deskTile ? { x: deskTile.x * 32 + 16, y: deskTile.y * 32 + 16 } : undefined;

          store.updateAgent(m.id, { status: 'Idle', carryingTaskId: undefined });
          const project = store.projects[0];
          if (project) {
              store.updateProject({ ...project, tasks: project.tasks.map(t => t.id === taskId ? { ...t, status: 'In-Dept', placedAt: dropPos } : t) });
          }
       }
    });

    // 3. Sub-agents pick up blades
    const subAgents = Object.values(agents).filter(a => a.role === 'Sub-Agent');
    subAgents.forEach(sa => {
       if (sa.status === 'Waiting' || sa.status === 'At Desk' || sa.status === 'Walking to Desk') {
          const project = store.projects[0];
          if (!project) return;
          const prefixToDept: Record<string, string> = { "A": "Executive Management", "B": "Software & Systems Development", "C": "Data Analysis & Decision Systems", "D": "Security, Compliance & Risk", "E": "Client Relations & Communications", "F": "Creative Digital Media", "G": "Automation & Tool Operations", "H": "Multimodal Interaction & Human Interface", "I": "Research & Intelligence", "J": "3D Visualisation & Simulation", "K": "Memory, Knowledge & Training" };
          const myDept = prefixToDept[sa.id.charAt(0)];
          const taskInDept = project.tasks.find(t => t.dept === myDept && t.status === 'In-Dept');
          
          if (taskInDept && taskInDept.placedAt) {
             const pendingBlade = taskInDept.blades.find(b => b.status === 'Pending');
             if (pendingBlade) {
                store.updateAgent(sa.id, { 
                   status: 'Picking up Blade', 
                   targetLocation: taskInDept.placedAt,
                   carryingBladeId: pendingBlade.id
                });
                this.updateBladeStatus(project.id, taskInDept.id, pendingBlade.id, 'At-Desk');
                
                setTimeout(() => {
                   const desk = this.getSubAgentDeskLocation(sa.id);
                   store.updateAgent(sa.id, { 
                      status: 'Working at Desk', 
                      targetLocation: desk
                   });
                   
                   setTimeout(() => {
                      const reviewSpot = this.getDeptReviewLocation(myDept);
                      store.updateAgent(sa.id, { status: 'Moving to Review Desk', targetLocation: reviewSpot });
                      setTimeout(() => {
                         store.updateAgent(sa.id, { status: 'Waiting', carryingBladeId: undefined, targetLocation: desk });
                         this.updateBladeStatus(project.id, taskInDept.id, pendingBlade.id, 'Review');
                      }, 4000);
                   }, 5000);
                }, 4000);
             }
          }
       }
    });
  }

  private waitForReceptionistPickUp(taskId: string) {
      const store = useSimulationStore.getState();
      const rec = store.agents['receptionist'];
      if (rec && !rec.targetLocation && rec.status === 'Picking up Box') {
          const project = store.projects[0];
          store.updateProject({ ...project, tasks: project.tasks.map(t => t.id === taskId ? { ...t, placedAt: undefined } : t) });
          store.updateAgent('receptionist', { carryingTaskId: taskId, status: 'Moving to Meeting Room' });
          
          const boardroomTable = (INITIAL_DATA.desks as any[]).find(d => d.type === 'BRT');
          const tableTile = boardroomTable?.tiles[0];
          if (tableTile) {
              store.updateAgent('receptionist', { targetLocation: { x: tableTile.x * 32 + 16, y: tableTile.y * 32 + 16 } });
              this.waitForMeetingArrival();
          }
      } else {
          setTimeout(() => this.waitForReceptionistPickUp(taskId), 500);
      }
  }

  private waitForMeetingArrival() {
    const store = useSimulationStore.getState();
    const agents = store.agents;
    const receptionist = agents['receptionist'];
    const managers = Object.values(agents).filter(a => a.role === 'Manager');

    const allAtMeeting = (!receptionist || !receptionist.targetLocation) && managers.every(m => !m.targetLocation);

    if (allAtMeeting && receptionist?.carryingTaskId) {
       const boardroomTable = (INITIAL_DATA.desks as any[]).find(d => d.type === 'BRT');
       const tableTile = boardroomTable?.tiles[0];
       const dropPos = tableTile ? { x: tableTile.x * 32 + 16, y: tableTile.y * 32 + 16 } : undefined;

       const project = store.projects[0];
       store.updateProject({ ...project, tasks: project.tasks.map(t => t.id === 'initial-client-box' ? { ...t, placedAt: dropPos } : t) });
       store.updateAgent('receptionist', { carryingTaskId: undefined, status: 'Meeting' });

       setTimeout(() => {
          const depts = ["Executive Management", "Software & Systems Development", "Research & Intelligence", "3D Visualisation & Simulation", "Memory, Knowledge & Training", "Creative Digital Media", "Client Relations & Communications"];
          const newTasks: Task[] = depts.map(dept => ({
             id: `task-${dept}`, name: `${dept} Job`, dept, status: 'Meeting',
             blades: [
               { id: `b-${dept}-1`, taskId: `task-${dept}`, status: 'Pending', workProgress: 0 },
               { id: `b-${dept}-2`, taskId: `task-${dept}`, status: 'Pending', workProgress: 0 }
             ],
             placedAt: dropPos
          }));

          store.updateProject({ ...project, tasks: [...project.tasks, ...newTasks] });
          managers.forEach(m => {
             store.updateAgent(m.id, { 
               status: 'Returning to Dept', 
               carryingTaskId: `task-${m.dept}`,
               targetLocation: this.getDeptInboxLocation(m.dept!)
             });
          });
          store.updateAgent('receptionist', { status: 'Returning to Desk', targetLocation: this.getSubAgentDeskLocation('receptionist') });
       }, 3000);
    } else {
       setTimeout(() => this.waitForMeetingArrival(), 1000);
    }
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
     if (!agent && id === 'receptionist') {
         const rd = (INITIAL_DATA.desks as any[]).find(d => d.type === 'RCD');
         return rd ? { x: (rd.tiles[0].x + 1) * 32 + 16, y: rd.tiles[0].y * 32 + 16 } : { x: 0, y: 0 };
     }
     return agent ? { x: agent.x * 32 + 16, y: agent.y * 32 + 16 } : { x: 0, y: 0 };
  }

  private getDeptInboxLocation(dept: string): { x: number, y: number } {
     const prefixMap: Record<string, string> = {
        "Executive Management": "A", "Software & Systems Development": "B", "Data Analysis & Decision Systems": "C", "Security, Compliance & Risk": "D", "Client Relations & Communications": "E", "Creative Digital Media": "F", "Automation & Tool Operations": "G", "Multimodal Interaction & Human Interface": "H", "Research & Intelligence": "I", "3D Visualisation & Simulation": "J", "Memory, Knowledge & Training": "K", "Company Management": "L"
     };
     const prefix = prefixMap[dept];
     const roomId = { "A": 11, "B": 12, "C": 13, "D": 14, "E": 15, "F": 16, "G": 17, "H": 18, "I": 19, "J": 20, "K": 21, "L": 8 }[prefix];
     const jobDesk = (INITIAL_DATA.desks as any[]).find(d => d.room === roomId && d.type === 'DJD');
     const tile = jobDesk?.tiles[0];
     return tile ? { x: (tile.x + 1) * 32 + 16, y: tile.y * 32 + 16 } : { x: 0, y: 0 };
  }
}
