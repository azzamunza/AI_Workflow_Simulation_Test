import Phaser from 'phaser';
import { useSimulationStore } from '../../store';
import { NavigationManager } from '../Navigation';
import { ProjectManager } from '../Orchestrator';

export class MainScene extends Phaser.Scene {
  private lastSyncTime: number = 0;
  private syncInterval: number = 100;
  private agents: Map<string, { sprite: Phaser.GameObjects.Sprite, label: Phaser.GameObjects.Text, thinking: Phaser.GameObjects.Text }> = new Map();
  private navManager!: NavigationManager;
  private taskGraphics!: Phaser.GameObjects.Graphics;
  private bottleneckGraphics!: Phaser.GameObjects.Graphics;
  protected debugGraphics!: Phaser.GameObjects.Graphics;

  private departmentCentroids: Record<string, { x: number, y: number }> = {
    "Research": { x: 5 * 32, y: 5 * 32 },
    "PM": { x: 55 * 32, y: 5 * 32 },
    "Art": { x: 5 * 32, y: 35 * 32 },
    "Programming": { x: 55 * 32, y: 35 * 32 },
    "AI Ops": { x: 25 * 32, y: 5 * 32 },
    "QA": { x: 25 * 32, y: 35 * 32 },
    "Planning": { x: 45 * 32, y: 35 * 32 }
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
    const tileset = map.addTilesetImage('office-tiles', 'tiles');
    if (tileset) {
      map.createLayer('Floor', tileset, 0, 0);
      map.createLayer('Furniture', tileset, 0, 0);
      const floorLayer = map.getLayer('Floor')!;
      const floorData = floorLayer.data.flat().map((tile: any) => tile.index || 0);
      this.navManager = new NavigationManager(floorData, map.width, map.height);
    }

    this.taskGraphics = this.add.graphics().setDepth(20);
    this.bottleneckGraphics = this.add.graphics().setDepth(15);
    this.debugGraphics = this.add.graphics().setDepth(100).lineStyle(2, 0xff0000, 0.5);

    // Init Logic
    ProjectManager.getInstance().initializeAgents();
    
    // Create Initial PM
    this.syncAgentsWithStore();

    // Planning
    ProjectManager.getInstance().planProject("BlueBush Web App", "worker-Research");
  }

  private syncAgentsWithStore() {
    const storeAgents = useSimulationStore.getState().agents;
    Object.values(storeAgents).forEach(agent => {
      if (!this.agents.has(agent.id)) {
        const sprite = this.add.sprite(416, 736, 'atlas', 10).setDepth(10);
        const label = this.add.text(416, 700, agent.name, { fontSize: '12px', color: '#fff' }).setOrigin(0.5).setDepth(11);
        const thinking = this.add.text(416, 680, '...', { fontSize: '20px', color: '#ffff00', fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0).setDepth(12);
        
        // Initial Position for Workers
        if (agent.role === 'Worker') {
           const dept = agent.id.split('-')[1];
           const pos = this.departmentCentroids[dept];
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

      // Thinking Animation
      if (data.isThinking) {
        obj.thinking.setAlpha(1);
        obj.thinking.setPosition(obj.sprite.x, obj.sprite.y - 40);
        obj.thinking.setScale(1 + Math.sin(time / 200) * 0.2);
      } else {
        obj.thinking.setAlpha(0);
      }

      // Movement
      this.handleAgentMovement(id, obj.sprite, data);

      // Update Label
      obj.label.setPosition(obj.sprite.x, obj.sprite.y - 30);
    });

    // Throttled Sync
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

    // Check for new target
    let pathObj = this.agentPaths.get(id);
    if (data.targetLocation) {
       const targetX = data.targetLocation.x;
       const targetY = data.targetLocation.y;

       // If path doesn't exist or target changed
       if (!pathObj || (pathObj.path.length > 0 && (pathObj.path[pathObj.path.length-1].x !== targetX || pathObj.path[pathObj.path.length-1].y !== targetY))) {
         const nodes = this.navManager.findPath({x: sprite.x, y: sprite.y}, {x: targetX, y: targetY});
         if (nodes.length > 0) {
            this.agentPaths.set(id, { path: nodes.map(n => ({x: n.x * 32 + 16, y: n.y * 32 + 16})), index: 0 });
            pathObj = this.agentPaths.get(id);
         }
       }
    }

    if (pathObj && pathObj.index < pathObj.path.length) {
      const target = pathObj.path[pathObj.index];
      const dx = target.x - sprite.x;
      const dy = target.y - sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) {
        pathObj.index++;
      } else {
        const angle = Math.atan2(dy, dx);
        sprite.x += Math.cos(angle) * 4;
        sprite.y += Math.sin(angle) * 4;
      }
    }
  }

  private renderTasks() {
    this.taskGraphics.clear();
    this.bottleneckGraphics.clear();
    const projects = useSimulationStore.getState().projects;
    const storeAgents = useSimulationStore.getState().agents;
    
    projects.forEach(project => {
      project.tasks.forEach((task, index) => {
        // If task is being carried, render it on the agent
        const carrier = Object.values(storeAgents).find(a => a.carryingTaskId === task.id);
        if (carrier) {
          const agentObj = this.agents.get(carrier.id);
          if (agentObj) {
            this.drawTaskBox(agentObj.sprite.x, agentObj.sprite.y - 10, task.status);
            return;
          }
        }

        if (task.status === 'Complete') return;

        const centroid = this.departmentCentroids[task.dept];
        if (!centroid) return;
        const x = centroid.x + (index % 3) * 40 + 16;
        const y = centroid.y + Math.floor(index / 3) * 40 + 16;
        this.drawTaskBox(x, y, task.status);
      });
    });
  }

  private drawTaskBox(x: number, y: number, status: string) {
    if (status === 'Stubbed') {
      this.drawDashedRect(x, y, 20, 20, 0xffff00);
    } else {
      this.taskGraphics.fillStyle(0xffffff, 1);
      this.taskGraphics.fillRect(x - 10, y - 10, 20, 20);
      this.taskGraphics.lineStyle(1, 0x000000, 1);
      this.taskGraphics.strokeRect(x - 10, y - 10, 20, 20);
    }
  }

  private drawDashedRect(x: number, y: number, w: number, h: number, color: number) {
    const dashLength = 4;
    this.taskGraphics.lineStyle(2, color, 1);
    const left = x - w/2;
    const top = y - h/2;
    for (let i = 0; i < w; i += dashLength * 2) {
      this.taskGraphics.lineBetween(left + i, top, left + i + dashLength, top);
      this.taskGraphics.lineBetween(left + i, top + h, left + i + dashLength, top + h);
    }
    for (let i = 0; i < h; i += dashLength * 2) {
      this.taskGraphics.lineBetween(left, top + i, left, top + i + dashLength);
      this.taskGraphics.lineBetween(left + w, top + i, left + w, top + i + dashLength);
    }
  }
}
