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
    
    // Spawn Workers for Departments
    const depts = ["Art", "Programming", "QA", "Research"];
    depts.forEach((dept, i) => {
      store.updateAgent(`worker-${dept}`, {
        id: `worker-${dept}`,
        name: `${dept} Worker`,
        role: 'Worker',
        status: 'Waiting for Task',
        location: { x: 0, y: 0 }, // Will be set by Phaser
        isThinking: false
      });
    });

    // Spawn 1 Courier for Logistics
    store.updateAgent('courier-01', {
      id: 'courier-01',
      name: 'Courier 01',
      role: 'Courier',
      status: 'Idle',
      location: { x: 0, y: 0 },
      isThinking: false
    });
  }

  /**
   * Simulates an async LLM call via Cloudflare Workers
   */
  public async planProject(projectName: string, managerId: string) {
    if (this.isThinking) return;
    this.setThinking(managerId, true);

    const delay = 2000 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, delay));

    const mockLLMOutput = {
      action: "create_project",
      projectName: projectName,
      tasks: [
        { id: "t1", name: "Concept Design", dept: "Art" },
        { id: "t2", name: "Basic Logic", dept: "Programming" },
        { id: "t3", name: "Initial QA", dept: "QA" }
      ]
    };

    useSimulationStore.getState().addProject({
      id: `p-${Date.now()}`,
      name: mockLLMOutput.projectName,
      status: 'Active',
      tasks: mockLLMOutput.tasks.map(t => ({ ...t, status: 'Pending' }))
    });

    this.setThinking(managerId, false);
    
    // Start the logistics loop
    this.processNextLogisticsStep();
  }

  private processNextLogisticsStep() {
    const store = useSimulationStore.getState();
    const projects = store.projects;
    if (projects.length === 0) return;

    const project = projects[0];
    const pendingTask = project.tasks.find(t => t.status === 'Pending');

    if (pendingTask) {
      // 1. Assign Courier to take task to Dept Inbox
      console.log(`[AI Orchestrator] Courier delivering ${pendingTask.name} to ${pendingTask.dept}`);
      store.updateAgent('courier-01', {
        status: `Delivering ${pendingTask.name}`,
        carryingTaskId: pendingTask.id,
        targetLocation: { dept: pendingTask.dept, spot: 'inbox' } as any
      });

      // 2. Mark task as in-progress (physically moving)
      store.updateTask(project.id, pendingTask.id, 'In-Progress');
    }

    setTimeout(() => this.processNextLogisticsStep(), 10000);
  }

  private setThinking(id: string, value: boolean) {
    this.isThinking = value;
    useSimulationStore.getState().updateAgent(id, { 
      isThinking: value,
      status: value ? 'Thinking...' : 'Idle'
    });
  }
}
