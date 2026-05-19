import { useSimulationStore } from '../store';

/**
 * AI Orchestration Layer
 * Handles the async "Thinking" state and simulates LLM response validation.
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

  /**
   * Simulates an async LLM call via Cloudflare Workers
   */
  public async planProject(projectName: string, managerId: string) {
    if (this.isThinking) return;

    console.log(`[AI Orchestrator] Requesting plan for project: ${projectName}`);
    
    // 1. Enter "Thinking" State (Visible in Simulation)
    this.setThinking(managerId, true);

    // 2. Simulate Network Latency / LLM Reasoning (2-4 seconds)
    const delay = 2000 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // 3. Mock JSON Schema Validation
    const mockLLMOutput = {
      action: "create_project",
      projectName: projectName,
      tasks: [
        { id: "t1", name: "Create Concept Art", dept: "Art" },
        { id: "t2", name: "Develop Prototype", dept: "Programming" },
        { id: "t3", name: "QA Testing", dept: "QA" }
      ]
    };

    console.log(`[AI Orchestrator] Received validated JSON plan:`, mockLLMOutput);

    // 4. Commit to Simulation Engine (Zustand)
    useSimulationStore.getState().addProject({
      id: `p-${Date.now()}`,
      name: mockLLMOutput.projectName,
      status: 'Active',
      tasks: mockLLMOutput.tasks.map(t => ({ ...t, status: 'Pending' }))
    });

    // 5. Exit "Thinking" State
    this.setThinking(managerId, false);
  }

  private setThinking(id: string, value: boolean) {
    this.isThinking = value;
    useSimulationStore.getState().updateAgent(id, { 
      isThinking: value,
      status: value ? 'Thinking...' : 'Idle'
    });
  }
}
