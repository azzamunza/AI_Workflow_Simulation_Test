import { create } from 'zustand';

interface AgentState {
  id: string;
  name: string;
  role: string;
  status: string;
  location: { x: number; y: number };
}

interface SimulationState {
  agents: Record<string, AgentState>;
  tasks: any[];
  simulationTime: number;
  // Metadata for HUD
  updateAgent: (id: string, data: Partial<AgentState>) => void;
  setSimulationTime: (time: number) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  agents: {},
  tasks: [],
  simulationTime: 0,
  updateAgent: (id, data) => set((state) => ({
    agents: {
      ...state.agents,
      [id]: { ...state.agents[id], ...data }
    }
  })),
  setSimulationTime: (time) => set({ simulationTime: time }),
}));
