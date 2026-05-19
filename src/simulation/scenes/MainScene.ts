import Phaser from 'phaser';
import { useSimulationStore } from '../../store';
import { NavigationManager } from '../Navigation';

export class MainScene extends Phaser.Scene {
  private lastSyncTime: number = 0;
  private syncInterval: number = 100; // 100ms throttle
  private testAgent!: Phaser.GameObjects.Sprite;
  private navManager!: NavigationManager;
  private currentPath: { x: number, y: number }[] = [];
  private pathIndex: number = 0;
  private moveSpeed: number = 4;
  private debugGraphics!: Phaser.GameObjects.Graphics;

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
        return;
      }
      console.log('Floor layer created.');

      // Initialize Navigation
      const floorData = floorLayer.data.flat().map((tile: any) => tile.index || 0);
      this.navManager = new NavigationManager(floorData, map.width, map.height);
      console.log('Navigation initialized.');

      // Debug Graphics for Path
      this.debugGraphics = this.add.graphics();
      this.debugGraphics.lineStyle(2, 0xff0000, 1);

      // Start movement test: Move from Bottom-Middle (Center Corridor) to Research
      this.startMoving({ x: 40 * 32, y: 24 * 32 }, { x: 10 * 32, y: 10 * 32 });
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

  private startMoving(start: { x: number, y: number }, end: { x: number, y: number }) {
    const nodes = this.navManager.findPath(start, end);
    this.currentPath = nodes.map(n => ({ x: n.x * 32 + 16, y: n.y * 32 + 16 }));
    this.pathIndex = 0;
    
    // Draw Debug Path
    this.debugGraphics.clear();
    this.debugGraphics.lineStyle(2, 0xff0000, 1);
    if (this.currentPath.length > 1) {
      this.debugGraphics.beginPath();
      this.debugGraphics.moveTo(this.currentPath[0].x, this.currentPath[0].y);
      for (let i = 1; i < this.currentPath.length; i++) {
        this.debugGraphics.lineTo(this.currentPath[i].x, this.currentPath[i].y);
      }
      this.debugGraphics.strokePath();
    }

    if (this.currentPath.length > 0) {
      this.testAgent.setPosition(this.currentPath[0].x, this.currentPath[0].y);
    }
  }

  update(time: number, _delta: number) {
    // Movement Logic
    if (this.pathIndex < this.currentPath.length) {
      const target = this.currentPath[this.pathIndex];
      const dx = target.x - this.testAgent.x;
      const dy = target.y - this.testAgent.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) {
        this.pathIndex++;
        // If reached end, pick a new random department
        if (this.pathIndex >= this.currentPath.length) {
           const depts = [
             { x: 10, y: 10 }, // Research
             { x: 60, y: 10 }, // PM
             { x: 10, y: 40 }, // Art
             { x: 60, y: 40 }, // Programming
             { x: 40, y: 24 }  // Center Junction
           ];
           const randomDept = depts[Math.floor(Math.random() * depts.length)];
           this.startMoving({ x: this.testAgent.x, y: this.testAgent.y }, { x: randomDept.x * 32, y: randomDept.y * 32 });
        }
      } else {
        const angle = Math.atan2(dy, dx);
        this.testAgent.x += Math.cos(angle) * this.moveSpeed;
        this.testAgent.y += Math.sin(angle) * this.moveSpeed;
      }
    }

    // Throttled Zustand Sync (10Hz)
    if (time > this.lastSyncTime + this.syncInterval) {
      useSimulationStore.getState().updateAgent('agent_01', {
        location: { x: Math.round(this.testAgent.x), y: Math.round(this.testAgent.y) }
      });
      this.lastSyncTime = time;
    }
  }
}
