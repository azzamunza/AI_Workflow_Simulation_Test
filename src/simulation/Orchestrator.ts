import { useSimulationStore, type Task } from '../store';
import { INITIAL_DATA } from './data';

export class ProjectManager {
  private static instance: ProjectManager;
  private boardroomSeats: any[] = [];
  private meetingCalled = false;

  public static getInstance(): ProjectManager {
    if (!ProjectManager.instance) ProjectManager.instance = new ProjectManager();
    return ProjectManager.instance;
  }

  private getInteractionSpot(gridX: number, gridY: number): { x: number, y: number } {
     const neighbors = [{x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1}];
     for (const n of neighbors) {
         const nx = gridX + n.x;
         const ny = gridY + n.y;
         const isFurniture = (INITIAL_DATA.desks as any[]).some(d => d.tiles.some((t: any) => t.x === nx && t.y === ny));
         if (!isFurniture && nx >= 0 && nx < 63 && ny >= 0 && ny < 43) {
             return { x: nx * 32 + 16, y: ny * 32 + 16 };
         }
     }
     return { x: gridX * 32 + 16, y: gridY * 32 + 16 };
  }

  public initializeAgents() {
    const store = useSimulationStore.getState();
    const { agents, desks, chairs, metadata } = INITIAL_DATA;

    const prefixToRoom: Record<string, number> = {
      "A": 11, "B": 12, "C": 13, "D": 14, "E": 15, "F": 16, "G": 17, "H": 18, "I": 19, "J": 20, "K": 21, "L": 8
    };

    this.boardroomSeats = (chairs as any[]).filter(c => c.room === 10).map(c => ({...c, occupiedBy: null}));
    this.meetingCalled = false;

    agents.forEach((a: any) => {
      const agentMeta = (metadata.agents as any)[a.id];
      let role: any = 'Sub-Agent';
      if (agentMeta?.role?.includes('Company Manager')) role = 'Agent';
      else if (agentMeta?.role?.includes('Department Manager')) role = 'Manager';

      const spawnX = a.x * 32 + 16;
      const spawnY = a.y * 32 + 16;
      const prefix = a.id.charAt(0);
      const roomId = prefixToRoom[prefix];
      
      const myChair = (chairs as any[]).find(c => c.room === roomId && !c.occupied);
      let deskTarget = { x: spawnX, y: spawnY };
      if (myChair) {
         myChair.occupied = true;
         myChair.ownerId = a.id; 
         deskTarget = { x: myChair.x * 32 + 16, y: myChair.y * 32 + 16 }; 
      }

      store.updateAgent(a.id, {
        id: a.id, name: agentMeta?.role || a.id, role: role,
        status: 'Walking to Desk',
        location: { x: spawnX, y: spawnY },
        targetLocation: deskTarget,
        isThinking: false
      });
    });

    const receptionDesk = (desks as any[]).find(d => d.type === 'RCD');
    if (receptionDesk) {
        const spot = this.getInteractionSpot(receptionDesk.tiles[0].x, receptionDesk.tiles[0].y);
        store.updateAgent('receptionist', {
            id: 'receptionist', name: 'Receptionist', role: 'Receptionist',
            status: 'At Desk',
            location: spot,
            isThinking: false
        });
    }

    const entranceSpawn = { x: 0 * 32 + 16, y: 5 * 32 + 16 };
    if (receptionDesk) {
        const deskTile = receptionDesk.tiles[0];
        const stopPos = this.getInteractionSpot(deskTile.x, deskTile.y);
        store.updateAgent('client', {
          id: 'client', name: 'Client', role: 'Client',
          status: 'Entering', location: entranceSpawn, isThinking: false,
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

    if (client.status === 'Entering' && !client.targetLocation) {
       store.updateAgent('client', { status: 'Placing Box' });
       const receptionDesk = (INITIAL_DATA.desks as any[]).find(d => d.type === 'RCD');
       const deskTile = receptionDesk?.tiles[0];
       const dropPos = { x: deskTile.x * 32 + 16, y: deskTile.y * 32 + 16 };
       const pickUpSpot = this.getInteractionSpot(receptionDesk.tiles[0].x, receptionDesk.tiles[0].y);

       setTimeout(() => {
          store.updateAgent('client', { status: 'Leaving', carryingTaskId: undefined, targetLocation: { x: 0, y: 5 * 32 + 16 } });
          this.updateTaskLocation('initial-client-box', dropPos);
          store.updateAgent('receptionist', { status: 'Picking up Box', targetLocation: pickUpSpot });
       }, 2000);
    }

    const rec = agents['receptionist'];
    const compManager = agents['L1'];
    if (rec && rec.status === 'Picking up Box' && !rec.targetLocation && !rec.carryingTaskId) {
        this.updateTaskLocation('initial-client-box', undefined);
        const cmDesk = (INITIAL_DATA.desks as any[]).find(d => d.type === 'CMD');
        const spot = cmDesk ? this.getInteractionSpot(cmDesk.tiles[0].x, cmDesk.tiles[0].y) : { x: 0, y: 0 };
        store.updateAgent('receptionist', { carryingTaskId: 'initial-client-box', status: 'Taking to Company Manager', targetLocation: spot });
    }

    if (rec && rec.status === 'Taking to Company Manager' && !rec.targetLocation) {
        const cmDesk = (INITIAL_DATA.desks as any[]).find(d => d.type === 'CMD');
        const boxPos = { x: cmDesk.tiles[0].x * 32 + 16, y: cmDesk.tiles[0].y * 32 + 16 };
        this.updateTaskLocation('initial-client-box', boxPos);
        store.updateAgent('receptionist', { carryingTaskId: undefined, status: 'Returning to Desk', targetLocation: this.getAgentHomeSeat('receptionist') });
        if (!this.meetingCalled) {
            this.meetingCalled = true;
            const managers = Object.values(agents).filter(a => a.role === 'Manager');
            managers.forEach(m => store.updateAgent(m.id, { status: 'Finding Boardroom Seat' }));
        }
    }

    const managers = Object.values(agents).filter(a => a.role === 'Manager');
    managers.forEach(m => {
        if (m.status === 'Finding Boardroom Seat') {
            const currentSeat = this.boardroomSeats.find(s => s.occupiedBy === m.id);
            if (!currentSeat) {
                const vacantSeat = this.boardroomSeats.find(s => !s.occupiedBy);
                if (vacantSeat) {
                    vacantSeat.occupiedBy = m.id;
                    store.updateAgent(m.id, { targetLocation: { x: vacantSeat.x * 32 + 16, y: vacantSeat.y * 32 + 16 } });
                }
            } else if (!m.targetLocation) {
                store.updateAgent(m.id, { status: 'Seated in Boardroom' });
            }
        }
    });

    const allDMsSeated = managers.every(m => m.status === 'Seated in Boardroom');
    if (this.meetingCalled && allDMsSeated && compManager && compManager.status !== 'Moving to Meeting' && compManager.status !== 'Seated in Meeting') {
        this.updateTaskLocation('initial-client-box', undefined);
        const boardroomTable = (INITIAL_DATA.desks as any[]).find(d => d.type === 'BRT');
        const spot = this.getInteractionSpot(boardroomTable.tiles[0].x, boardroomTable.tiles[0].y);
        store.updateAgent('L1', { carryingTaskId: 'initial-client-box', status: 'Moving to Meeting', targetLocation: spot });
    }

    if (compManager && compManager.status === 'Moving to Meeting' && !compManager.targetLocation) {
        const boardroomTable = (INITIAL_DATA.desks as any[]).find(d => d.type === 'BRT');
        const tablePos = { x: boardroomTable.tiles[0].x * 32 + 16, y: boardroomTable.tiles[0].y * 32 + 16 };
        this.updateTaskLocation('initial-client-box', tablePos);
        managers.forEach(m => {
            const taskId = `task-${m.id}`;
            this.spawnDeptTask(m.id, m.dept || "", { x: m.location.x, y: m.location.y }); 
            store.updateAgent(m.id, { carryingTaskId: taskId, status: 'Returning to Dept', targetLocation: this.getDeptInboxLocation(m.dept || "") });
        });
        const cmChair = (INITIAL_DATA.chairs as any[]).find((c: any) => c.room === 10 && !this.boardroomSeats.some(s => s.x === c.x && s.y === c.y));
        if (cmChair) store.updateAgent('L1', { carryingTaskId: undefined, status: 'Seated in Meeting', targetLocation: { x: cmChair.x * 32 + 16, y: cmChair.y * 32 + 16 } });
        else store.updateAgent('L1', { carryingTaskId: undefined, status: 'Seated in Meeting' });
    }

    managers.forEach(m => {
       if (m.status === 'Returning to Dept' && !m.targetLocation && m.carryingTaskId) {
          const prefix = m.id.charAt(0);
          const prefixToRoom: Record<string, number> = { "A": 11, "B": 12, "C": 13, "D": 14, "E": 15, "F": 16, "G": 17, "H": 18, "I": 19, "J": 20, "K": 21, "L": 8 };
          const roomId = prefixToRoom[prefix];
          const mgtDesk = (INITIAL_DATA.desks as any[]).find(d => d.room === roomId && d.type === 'DMD');
          const boxPos = mgtDesk ? { x: mgtDesk.tiles[0].x * 32 + 16, y: mgtDesk.tiles[0].y * 32 + 16 } : m.location;
          this.updateTaskLocation(m.carryingTaskId, boxPos, 'In-Dept');
          store.updateAgent(m.id, { status: 'At Desk', carryingTaskId: undefined, targetLocation: this.getAgentHomeSeat(m.id) });
       }
    });

    const subAgents = Object.values(agents).filter(a => a.role === 'Sub-Agent');
    subAgents.forEach(sa => {
       if (sa.status === 'At Desk' || sa.status === 'Waiting') {
          const project = store.projects[0];
          const prefixToDept: Record<string, string> = { "A": "Executive Management", "B": "Software & Systems Development", "C": "Data Analysis & Decision Systems", "D": "Security, Compliance & Risk", "E": "Client Relations & Communications", "F": "Creative Digital Media", "G": "Automation & Tool Operations", "H": "Multimodal Interaction & Human Interface", "I": "Research & Intelligence", "J": "3D Visualisation & Simulation", "K": "Memory, Knowledge & Training" };
          const myDept = prefixToDept[sa.id.charAt(0)];
          const myTask = project?.tasks.find(t => t.status === 'In-Dept' && t.placedAt && t.dept === myDept);
          if (myTask && myTask.placedAt) {
             const blade = myTask.blades.find(b => b.status === 'Pending');
             if (blade) {
                const pickUpSpot = this.getInteractionSpot(Math.floor(myTask.placedAt.x / 32), Math.floor(myTask.placedAt.y / 32));
                store.updateAgent(sa.id, { status: 'Picking up Blade', targetLocation: pickUpSpot, carryingBladeId: blade.id });
                this.updateBladeStatus(project.id, myTask.id, blade.id, 'At-Desk');
                setTimeout(() => {
                   store.updateAgent(sa.id, { status: 'Working', targetLocation: this.getAgentHomeSeat(sa.id) });
                }, 2000);
             }
          }
       }
    });
  }

  private updateTaskLocation(taskId: string, pos?: { x: number, y: number }, status?: Task['status']) {
      const store = useSimulationStore.getState();
      const project = store.projects[0];
      if (!project) return;
      const tasks = project.tasks.map(t => t.id === taskId ? { ...t, placedAt: pos, status: status || t.status } : t);
      store.updateProject({ ...project, tasks });
  }

  private spawnDeptTask(managerId: string, dept: string, pos?: { x: number, y: number }) {
      const store = useSimulationStore.getState();
      const project = store.projects[0];
      const taskId = `task-${managerId}`;
      if (project.tasks.find(t => t.id === taskId)) return;
      const newTask: Task = {
          id: taskId, name: `${dept} Job`, dept, status: 'Meeting',
          blades: [{ id: `b-${managerId}-1`, taskId, status: 'Pending', workProgress: 0 }],
          placedAt: pos
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

  private getAgentHomeSeat(id: string): { x: number, y: number } {
     if (id === 'receptionist') {
         const rd = (INITIAL_DATA.desks as any[]).find(d => d.type === 'RCD');
         return rd ? this.getInteractionSpot(rd.tiles[0].x, rd.tiles[0].y) : { x: 0, y: 0 };
     }
     const myChair = (INITIAL_DATA.chairs as any[]).find((c: any) => c.ownerId === id);
     if (myChair) return { x: myChair.x * 32 + 16, y: myChair.y * 32 + 16 };
     return { x: 0, y: 0 };
  }

  private getDeptInboxLocation(dept: string): { x: number, y: number } {
     const prefixMap: Record<string, string> = { "Executive Management": "A", "Software & Systems Development": "B", "Data Analysis & Decision Systems": "C", "Security, Compliance & Risk": "D", "Client Relations & Communications": "E", "Creative Digital Media": "F", "Automation & Tool Operations": "G", "Multimodal Interaction & Human Interface": "H", "Research & Intelligence": "I", "3D Visualisation & Simulation": "J", "Memory, Knowledge & Training": "K", "Company Management": "L" };
     const prefix = prefixMap[dept];
     const roomId = { "A": 11, "B": 12, "C": 13, "D": 14, "E": 15, "F": 16, "G": 17, "H": 18, "I": 19, "J": 20, "K": 21, "L": 8 }[prefix];
     const mgtDesk = (INITIAL_DATA.desks as any[]).find(d => d.room === roomId && d.type === 'DMD');
     return mgtDesk ? this.getInteractionSpot(mgtDesk.tiles[0].x, mgtDesk.tiles[0].y) : { x: 0, y: 0 };
  }
}
