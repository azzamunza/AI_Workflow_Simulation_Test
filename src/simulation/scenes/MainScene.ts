import Phaser from 'phaser';
import { useSimulationStore } from '../../store';
import { type Task, type Project, type Blade } from '../../store';
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
    "Research & Intelligence": { x: 57.3 * 32, y: 20.1 * 32 },
    "Software & Systems Development": { x: 34.5 * 32, y: 18.9 * 32 },
    "Executive Management": { x: 21.0 * 32, y: 18.9 * 32 },
    "Data Analysis & Decision Systems": { x: 32.7 * 32, y: 4.6 * 32 },
    "Security, Compliance & Risk": { x: 38.8 * 32, y: 4.6 * 32 },
    "Automation & Tool Operations": { x: 57.3 * 32, y: 3.3 * 32 },
    "3D Visualisation & Simulation": { x: 11.5 * 32, y: 4.6 * 32 },
    "Memory, Knowledge & Training": { x: 20.5 * 32, y: 4.6 * 32 },
    "Reception": { x: 3.5 * 32, y: 11.5 * 32 },
    "Meeting": { x: 12.0 * 32, y: 17.5 * 32 }
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
    const furnitureLayer = map.createLayer('Furniture', tileset, 0, 0)!;
    
    const floorLayer = map.getLayer('Floor')!;
    const floorData: number[] = [];
    floorLayer.data.forEach(row => {
      row.forEach(tile => {
        floorData.push(tile ? tile.index : 0);
      });
    });

    const furnitureData: number[] = [];
    furnitureLayer.layer.data.forEach(row => {
      row.forEach(tile => {
        furnitureData.push(tile ? tile.index : 0);
      });
    });

    this.navManager = new NavigationManager(floorData, map.width, map.height, furnitureData);

    this.taskGraphics = this.add.graphics().setDepth(20);
    this.debugGraphics = this.add.graphics().setDepth(100).lineStyle(2, 0xff0000, 0.5);

    ProjectManager.getInstance().initializeAgents();
    this.syncAgentsWithStore();
  }

  private syncAgentsWithStore() {
    const storeAgents = useSimulationStore.getState().agents;
    Object.values(storeAgents).forEach(agent => {
      if (!this.agents.has(agent.id)) {
        const sprite = this.add.sprite(agent.location.x, agent.location.y, 'atlas', 10).setDepth(10);
        const label = this.add.text(agent.location.x, agent.location.y - 30, agent.name, { fontSize: '12px', color: '#fff' }).setOrigin(0.5).setDepth(11);
        const thinking = this.add.text(agent.location.x, agent.location.y - 40, '...', { fontSize: '20px', color: '#ffff00', fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0).setDepth(12);
        
        if ((agent.role === 'Manager' || agent.role === 'Sub-Agent') && agent.location.x === 0) {
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
    this.renderDebugPaths();

    ProjectManager.getInstance().step();

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

    // Agent Avoidance Force
    this.applySeparation(id, sprite);

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

  private applySeparation(id: string, sprite: Phaser.GameObjects.Sprite) {
    const separationDist = 32;
    this.agents.forEach((other, otherId) => {
      if (id === otherId) return;
      const dx = sprite.x - other.sprite.x;
      const dy = sprite.y - other.sprite.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < separationDist * separationDist) {
        const dist = Math.sqrt(distSq);
        if (dist === 0) return;
        // Shift left/away force
        const force = (separationDist - dist) / separationDist;
        sprite.x += (dx / dist) * force * 2;
        sprite.y += (dy / dist) * force * 2;
      }
    });
  }

  private renderDebugPaths() {
    this.debugGraphics.clear();
    this.debugGraphics.lineStyle(2, 0xff0000, 0.5);
    this.agentPaths.forEach((pathObj) => {
      if (pathObj.path.length > 1) {
        this.debugGraphics.beginPath();
        this.debugGraphics.moveTo(pathObj.path[0].x, pathObj.path[0].y);
        for (let i = 1; i < pathObj.path.length; i++) {
          this.debugGraphics.lineTo(pathObj.path[i].x, pathObj.path[i].y);
        }
        this.debugGraphics.strokePath();
      }
    });
  }

  private renderTasks() {
    this.taskGraphics.clear();
    const store = useSimulationStore.getState();
    const projects = store.projects;
    const storeAgents = store.agents;
    
    projects.forEach((project: Project) => {
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

        if (task.blades) {
          task.blades.forEach((blade: Blade) => {
            const bladeCarrier = Object.values(storeAgents).find(a => a.carryingBladeId === blade.id);
            if (bladeCarrier) {
                const agentObj = this.agents.get(bladeCarrier.id);
                if (agentObj) {
                  this.taskGraphics.fillStyle(0x00ccff, 1);
                  this.taskGraphics.fillRect(agentObj.sprite.x - 10, agentObj.sprite.y - 5, 20, 5);
                  return;
                }
            }
            
            if (blade.status === 'Review') {
                const reviewSpot = ProjectManager.getInstance().getDeptReviewLocation(task.dept);
                this.taskGraphics.fillStyle(0x00ccff, 0.7);
                this.taskGraphics.fillRect(reviewSpot.x - 10, reviewSpot.y - 5, 20, 5);
            }
          });
        }

        if (task.status === 'Complete') return;

        const centroid = this.departmentCentroids[task.dept];
        if (centroid) {
           if (task.status === 'In-Dept' && task.blades) {
              const pendingBlades = task.blades.filter(b => b.status === 'Pending').length;
              if (pendingBlades > 0) {
                 this.taskGraphics.fillStyle(0xffffff, 1);
                 const h = pendingBlades * 8;
                 this.taskGraphics.fillRect(centroid.x + 40, centroid.y + 16 - h/2, 20, h);
              }
           }
           if (task.status === 'Reception') {
              this.taskGraphics.fillStyle(0xffffff, 1);
              this.taskGraphics.fillRect(3.5 * 32 + 16 - 10, 11.5 * 32 + 16 - 10, 20, 20);
           }
           if (task.status === 'Meeting') {
              this.taskGraphics.fillStyle(0xffffff, 1);
              this.taskGraphics.fillRect(12.0 * 32 + 16 - 10, 17.5 * 32 + 16 - 10, 20, 20);
           }
        }
      });
    });
  }
}
