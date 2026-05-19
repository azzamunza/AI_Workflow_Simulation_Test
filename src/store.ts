import { create } from 'zustand';

interface AgentState {
  id: string;
  name: string;
  role: string;
  status: string;
  location: { x: number; y: number };
  isThinking: boolean; // New: visual state
}

interface Project {
  id: string;
  name: string;
  status: 'Planning' | 'Active' | 'Complete';
  tasks: Task[];
}

interface Task {
  id: string;
  name: string;
  dept: string;
  status: 'Pending' | 'In-Progress' | 'Complete';
}

interface SimulationState {
  agents: Record<string, AgentState>;
  projects: Project[]; // New: Track active client projects
  simulationTime: number;
  updateAgent: (id: string, data: Partial<AgentState>) => void;
  addProject: (project: Project) => void;
  updateTask: (projectId: string, taskId: string, status: Task['status']) => void;
  setSimulationTime: (time: number) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  agents: {},
  projects: [],
  simulationTime: 0,
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
}));
