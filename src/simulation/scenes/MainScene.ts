import Phaser from 'phaser';
import { useSimulationStore, Task } from '../../store';
import { NavigationManager } from '../Navigation';
import { ProjectManager } from '../Orchestrator';

export class MainScene extends Phaser.Scene {
  private lastSyncTime: number = 0;
  private syncInterval: number = 100;
  private agents: Map<string, { sprite: Phaser.GameObjects.Sprite, label: Phaser.GameObjects.Text, thinking: Phaser.GameObjects.Text }> = new Map();
  private navManager!: NavigationManager;
  private taskGraphics!: Phaser.GameObjects.Graphics;
  protected debugGraphics!: Phaser.GameObjects.Graphics;

  private departmentCentroids: Record<string, { x: number, y: number }> = {
    "Research": { x: 5 * 32, y: 5 * 32 },
    "PM": { x: 55 * 32, y: 5 * 32 },
    "Art": { x: 5 * 32, y: 35 * 32 },
    "Programming": { x: 55 * 32, y: 35 * 32 },
    "AI Ops": { x: 25 * 32, y: 5 * 32 },
    "QA": { x: 25 * 32, y: 35 * 32 },
    "Planning": { x: 45 * 32, y: 35 * 32 },
    "Reception": { x: 6 * 32, y: 23 * 32 },
    "Meeting": { x: 40 * 32, y: 15 * 32 }
  };

  private agentPaths: Map<string, { path: { x: number, y: number }[], index: number }> = new Map();

  constructor() {
    super('MainScene');
  }

  preload() {
    this.load.image('tiles', './assets/atlas_global.png');
    this.load.tilemapTiledJSON('map', './assets/map_office.json');
    this.load.spritesheet('atlas', './assets/atlas_global.png', { frameWidth: 32, frameHeight: 32 });
  }

  create() {
    const map = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('office-tiles', 'tiles')!;
    map.createLayer('Floor', tileset, 0, 0);
    map.createLayer('Furniture', tileset, 0, 0);
    
    const floorLayer = map.getLayer('Floor')!;
    const floorData = floorLayer.data.flat().map((tile: any) => tile.index || 0);
    this.navManager = new NavigationManager(floorData, map.width, map.height);

    this.taskGraphics = this.add.graphics().setDepth(20);
    this.debugGraphics = this.add.graphics().setDepth(100).lineStyle(2, 0xff0000, 0.5);

    ProjectManager.getInstance().initializeAgents();
    this.syncAgentsWithStore();

    // Trigger initial project simulation
    setTimeout(() => {
       useSimulationStore.getState().updateAgent('client', { status: 'At Desk', targetLocation: undefined });
    }, 5000);
  }

  private syncAgentsWithStore() {
    const storeAgents = useSimulationStore.getState().agents;
    Object.values(storeAgents).forEach(agent => {
      if (!this.agents.has(agent.id)) {
        const sprite = this.add.sprite(agent.location.x, agent.location.y, 'atlas', 10).setDepth(10);
        const label = this.add.text(agent.location.x, agent.location.y - 30, agent.name, { fontSize: '12px', color: '#fff' }).setOrigin(0.5).setDepth(11);
        const thinking = this.add.text(agent.location.x, agent.location.y - 40, '...', { fontSize: '20px', color: '#ffff00', fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0).setDepth(12);
        
        // Initial setup for Dept agents
        if (agent.role === 'Manager' || agent.role === 'Sub-Agent') {
           const pos = this.departmentCentroids[agent.dept || ""];
           if (pos) {
             sprite.setPosition(pos.x + 64, pos.y + 64);
           }
        }

        this.agents.set(agent.id, { sprite, label, thinking });
      }
    });
  }

  update(time: number, _delta: number) {
    this.syncAgentsWithStore();
    this.renderTasks();

    const storeAgents = useSimulationStore.getState().agents;
    this.agents.forEach((obj, id) => {
      const data = storeAgents[id];
      if (!data) return;

      if (data.isThinking) {
        obj.thinking.setAlpha(1);
        obj.thinking.setPosition(obj.sprite.x, obj.sprite.y - 40);
        obj.thinking.setScale(1 + Math.sin(time / 200) * 0.2);
      } else {
        obj.thinking.setAlpha(0);
      }

      this.handleAgentMovement(id, obj.sprite, data);
      obj.label.setPosition(obj.sprite.x, obj.sprite.y - 30);
    });

    if (time > this.lastSyncTime + this.syncInterval) {
      this.agents.forEach((obj, id) => {
        useSimulationStore.getState().updateAgent(id, {
          location: { x: Math.round(obj.sprite.x), y: Math.round(obj.sprite.y) }
        });
      });
      this.lastSyncTime = time;
    }
  }

  private handleAgentMovement(id: string, sprite: Phaser.GameObjects.Sprite, data: any) {
    if (data.isThinking) return;

    if (data.targetLocation) {
      let pathObj = this.agentPaths.get(id);
      const targetX = data.targetLocation.x;
      const targetY = data.targetLocation.y;

      if (!pathObj || (pathObj.path.length > 0 && (pathObj.path[pathObj.path.length-1].x !== targetX || pathObj.path[pathObj.path.length-1].y !== targetY))) {
        const nodes = this.navManager.findPath({x: sprite.x, y: sprite.y}, {x: targetX, y: targetY});
        if (nodes.length > 0) {
          this.agentPaths.set(id, { path: nodes.map(n => ({x: n.x * 32 + 16, y: n.y * 32 + 16})), index: 0 });
          pathObj = this.agentPaths.get(id);
        }
      }

      if (pathObj && pathObj.index < pathObj.path.length) {
        const target = pathObj.path[pathObj.index];
        const dx = target.x - sprite.x;
        const dy = target.y - sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 4) {
          pathObj.index++;
          if (pathObj.index >= pathObj.path.length) {
            useSimulationStore.getState().updateAgent(id, { targetLocation: undefined });
          }
        } else {
          const angle = Math.atan2(dy, dx);
          sprite.x += Math.cos(angle) * 4;
          sprite.y += Math.sin(angle) * 4;
        }
      }
    }
  }

  private renderTasks() {
    this.taskGraphics.clear();
    const projects = useSimulationStore.getState().projects;
    const storeAgents = useSimulationStore.getState().agents;
    
    projects.forEach(project => {
      project.tasks.forEach((task: Task) => {
        const carrier = Object.values(storeAgents).find(a => a.carryingTaskId === task.id);
        if (carrier) {
          const agentObj = this.agents.get(carrier.id);
          if (agentObj) {
            this.taskGraphics.fillStyle(0xffffff, 1);
            this.taskGraphics.fillRect(agentObj.sprite.x - 10, agentObj.sprite.y - 10, 20, 20);
            return;
          }
        }

        if (task.status === 'Complete') return;

        // Render at Dept Tables
        const centroid = this.departmentCentroids[task.dept];
        if (centroid && task.status === 'In-Dept') {
           this.taskGraphics.fillStyle(0xffffff, 1);
           this.taskGraphics.fillRect(centroid.x + 40, centroid.y + 16, 20, 20);
        }
      });
    });
  }
}
