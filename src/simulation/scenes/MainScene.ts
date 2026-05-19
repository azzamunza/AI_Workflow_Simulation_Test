import Phaser from 'phaser';
import { useSimulationStore } from '../../store';
import { NavigationManager } from '../Navigation';

export class MainScene extends Phaser.Scene {
  private lastSyncTime: number = 0;
  private syncInterval: number = 100; // 100ms throttle
  private testAgent!: Phaser.GameObjects.Sprite;
  protected navManager!: NavigationManager;

  constructor() {
    super('MainScene');
  }

  preload() {
    this.load.image('tiles', 'assets/atlas_global.png');
    this.load.tilemapTiledJSON('map', 'assets/map_office.json');
    this.load.spritesheet('atlas', 'assets/atlas_global.png', { frameWidth: 32, frameHeight: 32 });
  }

  create() {
    // Tilemap
    const map = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('office-tiles', 'tiles');
    
    if (tileset) {
      const floorLayer = map.createLayer('Floor', tileset, 0, 0);
      map.createLayer('Furniture', tileset, 0, 0);

      // Initialize Navigation
      const floorData = floorLayer?.layer.data.flat().map(tile => tile.index) || [];
      this.navManager = new NavigationManager(floorData, map.width, map.height);
    }

    // Test Agent using Atlas frame 10 (Agent color)
    const agentSprite = this.add.sprite(400, 720, 'atlas', 10);
    this.testAgent = agentSprite; 

    this.add.text(400, 690, 'Agent 01', { fontSize: '12px', color: '#fff' }).setOrigin(0.5);

    // Initial Store Sync
    useSimulationStore.getState().updateAgent('agent_01', {
      id: 'agent_01',
      name: 'Agent 01',
      role: 'Worker',
      status: 'Idle',
      location: { x: 400, y: 720 }
    });
  }

  update(time: number, delta: number) {
    // Constant 60fps movement (Phaser internal)
    this.testAgent.x += 0.5 * (delta / 16.66);
    if (this.testAgent.x > this.scale.width) this.testAgent.x = 0;

    // Throttled Zustand Sync (10Hz)
    if (time > this.lastSyncTime + this.syncInterval) {
      useSimulationStore.getState().updateAgent('agent_01', {
        location: { x: Math.round(this.testAgent.x), y: Math.round(this.testAgent.y) }
      });
      this.lastSyncTime = time;
    }
  }
}
