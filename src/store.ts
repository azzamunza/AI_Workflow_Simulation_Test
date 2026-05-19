import { create } from 'zustand';

interface AgentState {
  id: string;
  name: string;
  role: 'Receptionist' | 'Manager' | 'Sub-Agent' | 'Client' | 'Courier';
  dept?: string;
  status: string;
  location: { x: number, y: number };
  isThinking: boolean;
  carryingTaskId?: string; 
  carryingBladeId?: string; // New: Piece of a task
  targetLocation?: { x: number, y: number }; 
}

interface Blade {
  id: string;
  taskId: string;
  status: 'Pending' | 'At-Desk' | 'Review' | 'Complete';
  workProgress: number;
}

interface Task {
  id: string;
  name: string;
  dept: string;
  status: 'Reception' | 'Meeting' | 'In-Dept' | 'Complete';
  blades: Blade[];
}

interface SimulationState {
  agents: Record<string, AgentState>;
  projects: Project[];
  simulationTime: number;
  completedTasks: number; // New: Analytics
  bottlenecks: string[]; // New: List of overloaded departments
  updateAgent: (id: string, data: Partial<AgentState>) => void;
  addProject: (project: Project) => void;
  updateTask: (projectId: string, taskId: string, status: Task['status']) => void;
  setSimulationTime: (time: number) => void;
  recordCompletion: () => void; // New: Increment analytics
  setBottlenecks: (depts: string[]) => void; // New: Sync visual warnings
}

export const useSimulationStore = create<SimulationState>((set) => ({
  agents: {},
  projects: [],
  simulationTime: 0,
  completedTasks: 0,
  bottlenecks: [],
  updateAgent: (id, data) => set((state) => ({
    agents: {
      ...state.agents,
      [id]: { ...state.agents[id], ...data }
    }
  })),
  addProject: (project) => set((state) => ({
    projects: [...state.projects, project]
  })),
  updateTask: (projectId, taskId, status) => set((state) => ({
    projects: state.projects.map(p => 
      p.id === projectId 
        ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, status } : t) }
        : p
    )
  })),
  setSimulationTime: (time) => set({ simulationTime: time }),
  recordCompletion: () => set((state) => ({ completedTasks: state.completedTasks + 1 })),
  setBottlenecks: (depts) => set({ bottlenecks: depts }),
}));
