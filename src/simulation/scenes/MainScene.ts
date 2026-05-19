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
    console.log('Preloading assets...');
    this.load.image('tiles', './assets/atlas_global.png');
    this.load.tilemapTiledJSON('map', './assets/map_office.json');
    this.load.spritesheet('atlas', './assets/atlas_global.png', { frameWidth: 32, frameHeight: 32 });

    this.load.on('loaderror', (fileObj: any) => {
      console.error('Error loading asset:', fileObj.key, fileObj.src);
    });
  }

  create() {
    console.log('Creating scene...');
    
    // Check if map data exists in cache
    if (!this.cache.tilemap.has('map')) {
      console.error('Tilemap "map" not found in cache!');
      return;
    }

    // Tilemap
    const map = this.make.tilemap({ key: 'map' });
    console.log('Tilemap object created:', map.width, 'x', map.height);

    // Ensure tileset image is in cache
    if (!this.textures.exists('tiles')) {
      console.error('Texture "tiles" not found in cache!');
      return;
    }

    const tileset = map.addTilesetImage('office-tiles', 'tiles');
    console.log('Tileset added:', tileset?.name);
    
    if (tileset) {
      map.createLayer('Floor', tileset, 0, 0);
      map.createLayer('Furniture', tileset, 0, 0);

      const floorLayer = map.getLayer('Floor');
      if (!floorLayer) {
        console.error('Floor layer not found in JSON!');
      } else {
        console.log('Floor layer created.');
      }

      // Initialize Navigation
      // flat() might be tricky on nested Tiled arrays, but standard is fine
      const floorData = floorLayer?.layer.data.flat().map(tile => tile.index) || [];
      this.navManager = new NavigationManager(floorData, map.width, map.height);
      console.log('Navigation initialized.');
    } else {
      console.error('Failed to link tileset "office-tiles" to image "tiles". Check tileset name in JSON.');
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
