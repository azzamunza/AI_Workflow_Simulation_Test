import { useSimulationStore, type Task } from '../store';
import { INITIAL_DATA } from './data';

export class ProjectManager {
  private static instance: ProjectManager;
  public static getInstance(): ProjectManager {
    if (!ProjectManager.instance) ProjectManager.instance = new ProjectManager();
    return ProjectManager.instance;
  }

  public initializeAgents() {
    const store = useSimulationStore.getState();
    const { agents, desks, metadata } = INITIAL_DATA;

    const prefixToRoom: Record<string, number> = {
      "A": 11, "B": 12, "C": 13, "D": 14, "E": 15, "F": 16, "G": 17, "H": 18, "I": 19, "J": 20, "K": 21, "L": 8
    };

    // 1. Initialize Agents from Spawn Locations
    agents.forEach((a: any) => {
      const agentMeta = (metadata.agents as any)[a.id];
      let role: any = 'Sub-Agent';
      if (agentMeta?.role?.includes('Company Manager')) role = 'Agent';
      else if (agentMeta?.role?.includes('Department Manager')) role = 'Manager';

      const spawnX = a.x * 32 + 16;
      const spawnY = a.y * 32 + 16;

      // 2. Desk Allocation (sitting logic: 1 square away)
      const prefix = a.id.charAt(0);
      const roomId = prefixToRoom[prefix];
      const deskType = role === 'Agent' ? 'CMD' : (role === 'Manager' ? 'DMD' : 'SAD');
      
      const myDesk = (desks as any[]).find(d => d.room === roomId && d.type === deskType && !d.occupied);
      let deskTarget = { x: spawnX, y: spawnY };
      
      if (myDesk) {
         myDesk.occupied = true;
         // Sitting position: 1 square to the right of the first tile
         const tile = myDesk.tiles[0];
         deskTarget = { x: (tile.x + 1) * 32 + 16, y: tile.y * 32 + 16 }; 
      }

      store.updateAgent(a.id, {
        id: a.id, name: agentMeta?.role || a.id, role: role,
        status: 'Walking to Desk',
        location: { x: spawnX, y: spawnY },
        targetLocation: deskTarget,
        isThinking: false
      });
    });

    // 3. Receptionist (E1 sits behind desk)
    const receptionDesk = (desks as any[]).find(d => d.type === 'RCD');
    if (receptionDesk) {
        const deskTile = receptionDesk.tiles[0];
        // Behind desk
        store.updateAgent('receptionist', {
            id: 'receptionist', name: 'Receptionist', role: 'Receptionist',
            status: 'At Desk',
            location: { x: (deskTile.x + 1) * 32 + 16, y: deskTile.y * 32 + 16 },
            isThinking: false
        });
    }

    // 4. Client (Spawn at 0,5)
    const clientSpawn = { x: 0 * 32 + 16, y: 5 * 32 + 16 };
    if (receptionDesk) {
        const deskTile = receptionDesk.tiles[0];
        const stopPos = { x: (deskTile.x - 1) * 32 + 16, y: deskTile.y * 32 + 16 };
        store.updateAgent('client', {
          id: 'client', name: 'Client', role: 'Client',
          status: 'Entering', location: clientSpawn, isThinking: false,
          targetLocation: stopPos,
          carryingTaskId: 'initial-client-box'
        });
    }

    store.addProject({
      id: 'p-initial', name: 'Client Project', status: 'Active',
      tasks: [{ id: 'initial-client-box', name: 'Original Request', dept: 'Client Relations & Communications', status: 'Reception', blades: [] }]
    });
  }

  public step() {
    const store = useSimulationStore.getState();
    const agents = store.agents;
    const client = agents['client'];
    if (!client) return;

    // 1. Client drops box
    if (client.status === 'Entering' && !client.targetLocation) {
       store.updateAgent('client', { status: 'Placing Box' });
       const receptionDesk = (INITIAL_DATA.desks as any[]).find(d => d.type === 'RCD');
       const dropPos = { x: receptionDesk.tiles[0].x * 32 + 16, y: receptionDesk.tiles[0].y * 32 + 16 };

       setTimeout(() => {
          store.updateAgent('client', { status: 'Leaving', carryingTaskId: undefined, targetLocation: { x: 0, y: 5 * 32 + 16 } });
          this.updateTaskLocation('initial-client-box', dropPos);
          store.updateAgent('receptionist', { status: 'Picking up Box', targetLocation: dropPos });
       }, 2000);
    }

    // 2. Receptionist picks up and moves to Boardroom
    const rec = agents['receptionist'];
    if (rec && rec.status === 'Picking up Box' && !rec.targetLocation && !rec.carryingTaskId) {
        this.updateTaskLocation('initial-client-box', undefined);
        const boardroomTable = (INITIAL_DATA.desks as any[]).find(d => d.type === 'BRT');
        const tablePos = { x: boardroomTable.tiles[0].x * 32 + 16, y: boardroomTable.tiles[0].y * 32 + 16 };
        store.updateAgent('receptionist', { carryingTaskId: 'initial-client-box', status: 'Moving to Meeting', targetLocation: tablePos });
    }

    // 3. Meeting arrival
    if (rec && rec.status === 'Moving to Meeting' && !rec.targetLocation) {
        const boardroomTable = (INITIAL_DATA.desks as any[]).find(d => d.type === 'BRT');
        const tablePos = { x: boardroomTable.tiles[0].x * 32 + 16, y: boardroomTable.tiles[0].y * 32 + 16 };
        this.updateTaskLocation('initial-client-box', tablePos);
        store.updateAgent('receptionist', { carryingTaskId: undefined, status: 'Returning to Desk', targetLocation: this.getSubAgentDeskLocation('receptionist') });
        
        // Summon Managers
        const managers = Object.values(agents).filter(a => a.role === 'Manager');
        managers.forEach(m => store.updateAgent(m.id, { status: 'Heading to Meeting', targetLocation: tablePos }));
    }

    // 4. Managers pick up clones
    const managers = Object.values(agents).filter(a => a.role === 'Manager');
    managers.forEach(m => {
       if (m.status === 'Heading to Meeting' && !m.targetLocation) {
          const deptTaskId = `task-${m.id}`;
          this.spawnDeptTask(m.id, m.dept || "");
          store.updateAgent(m.id, { status: 'Returning to Dept', carryingTaskId: deptTaskId, targetLocation: this.getDeptInboxLocation(m.dept || "") });
       }
       
       if (m.status === 'Returning to Dept' && !m.targetLocation && m.carryingTaskId) {
          const dropPos = this.getDeptInboxLocation(m.dept || "");
          this.updateTaskLocation(m.carryingTaskId, dropPos, 'In-Dept');
          store.updateAgent(m.id, { status: 'At Desk', carryingTaskId: undefined, targetLocation: this.getSubAgentDeskLocation(m.id) });
       }
    });

    // 5. Sub-agents work
    const subAgents = Object.values(agents).filter(a => a.role === 'Sub-Agent');
    subAgents.forEach(sa => {
       if (sa.status === 'At Desk' || sa.status === 'Walking to Desk' || sa.status === 'Waiting') {
          const project = store.projects[0];
          const myTask = project?.tasks.find(t => t.status === 'In-Dept' && t.placedAt && this.isAgentInDept(sa.id, t.dept));
          if (myTask) {
             const blade = myTask.blades.find(b => b.status === 'Pending');
             if (blade) {
                store.updateAgent(sa.id, { status: 'Picking up Blade', targetLocation: myTask.placedAt, carryingBladeId: blade.id });
                this.updateBladeStatus(project.id, myTask.id, blade.id, 'At-Desk');
                setTimeout(() => {
                   const desk = this.getSubAgentDeskLocation(sa.id);
                   store.updateAgent(sa.id, { status: 'Working', targetLocation: desk });
                }, 2000);
             }
          }
       }
    });
  }

  private isAgentInDept(agentId: string, deptName: string): boolean {
      const prefixMap: Record<string, string> = { "A": "Executive Management", "B": "Software & Systems Development", "C": "Data Analysis & Decision Systems", "D": "Security, Compliance & Risk", "E": "Client Relations & Communications", "F": "Creative Digital Media", "G": "Automation & Tool Operations", "H": "Multimodal Interaction & Human Interface", "I": "Research & Intelligence", "J": "3D Visualisation & Simulation", "K": "Memory, Knowledge & Training" };
      return prefixMap[agentId.charAt(0)] === deptName;
  }

  private updateTaskLocation(taskId: string, pos?: { x: number, y: number }, status?: Task['status']) {
      const store = useSimulationStore.getState();
      const project = store.projects[0];
      if (!project) return;
      const tasks = project.tasks.map(t => t.id === taskId ? { ...t, placedAt: pos, status: status || t.status } : t);
      store.updateProject({ ...project, tasks });
  }

  private spawnDeptTask(managerId: string, dept: string) {
      const store = useSimulationStore.getState();
      const project = store.projects[0];
      const taskId = `task-${managerId}`;
      if (project.tasks.find(t => t.id === taskId)) return;
      const newTask: Task = {
          id: taskId, name: `${dept} Job`, dept, status: 'Meeting',
          blades: [{ id: `b-${managerId}-1`, taskId, status: 'Pending', workProgress: 0 }],
          placedAt: undefined
      };
      store.updateProject({ ...project, tasks: [...project.tasks, newTask] });
  }

  private updateBladeStatus(projId: string, taskId: string, bladeId: string, status: any) {
     const store = useSimulationStore.getState();
     const project = store.projects.find(p => p.id === projId);
     if (project) {
        const tasks = project.tasks.map(t => t.id === taskId ? { ...t, blades: t.blades.map(b => b.id === bladeId ? { ...b, status } : b) } : t);
        store.updateProject({ ...project, tasks });
     }
  }

  private getSubAgentDeskLocation(id: string): { x: number, y: number } {
     const agent = INITIAL_DATA.agents.find((a: any) => a.id === id);
     if (!agent && id === 'receptionist') {
         const rd = (INITIAL_DATA.desks as any[]).find(d => d.type === 'RCD');
         return rd ? { x: (rd.tiles[0].x + 1) * 32 + 16, y: rd.tiles[0].y * 32 + 16 } : { x: 0, y: 0 };
     }
     if (agent) {
         const prefix = id.charAt(0);
         const roomId = { "A": 11, "B": 12, "C": 13, "D": 14, "E": 15, "F": 16, "G": 17, "H": 18, "I": 19, "J": 20, "K": 21, "L": 8 }[prefix];
         const role = (INITIAL_DATA.metadata.agents as any)[id]?.role;
         const deskType = role?.includes('Company Manager') ? 'CMD' : (role?.includes('Department Manager') ? 'DMD' : 'SAD');
         const desk = (INITIAL_DATA.desks as any[]).find(d => d.room === roomId && d.type === deskType);
         if (desk) return { x: (desk.tiles[0].x + 1) * 32 + 16, y: desk.tiles[0].y * 32 + 16 };
     }
     return { x: 0, y: 0 };
  }

  private getDeptInboxLocation(dept: string): { x: number, y: number } {
     const prefixMap: Record<string, string> = { "Executive Management": "A", "Software & Systems Development": "B", "Data Analysis & Decision Systems": "C", "Security, Compliance & Risk": "D", "Client Relations & Communications": "E", "Creative Digital Media": "F", "Automation & Tool Operations": "G", "Multimodal Interaction & Human Interface": "H", "Research & Intelligence": "I", "3D Visualisation & Simulation": "J", "Memory, Knowledge & Training": "K", "Company Management": "L" };
     const prefix = prefixMap[dept];
     const roomId = { "A": 11, "B": 12, "C": 13, "D": 14, "E": 15, "F": 16, "G": 17, "H": 18, "I": 19, "J": 20, "K": 21, "L": 8 }[prefix];
     const jobDesk = (INITIAL_DATA.desks as any[]).find(d => d.room === roomId && d.type === 'DJD');
     return jobDesk ? { x: jobDesk.tiles[0].x * 32 + 16, y: jobDesk.tiles[0].y * 32 + 16 } : { x: 0, y: 0 };
  }
}
