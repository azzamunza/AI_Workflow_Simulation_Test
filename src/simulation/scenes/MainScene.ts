import Phaser from 'phaser';
import { useSimulationStore } from '../../store';

export class MainScene extends Phaser.Scene {
  private lastSyncTime: number = 0;
  private syncInterval: number = 100; // 100ms throttle
  private testAgent!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('MainScene');
  }

  preload() {
    // Phase 1: No assets yet, using simple shapes
  }

  create() {
    const { width, height } = this.scale;
    
    // Grid background
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x333333, 0.5);
    for (let x = 0; x < width; x += 32) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, height);
    }
    for (let y = 0; y < height; y += 32) {
      graphics.moveTo(0, y);
      graphics.lineTo(width, y);
    }
    graphics.strokePath();

    // Test Agent
    this.testAgent = this.add.rectangle(100, 100, 24, 24, 0x00ff00);
    this.add.text(100, 70, 'Agent 01', { fontSize: '12px', color: '#fff' }).setOrigin(0.5);

    // Initial Store Sync
    useSimulationStore.getState().updateAgent('agent_01', {
      id: 'agent_01',
      name: 'Agent 01',
      role: 'Worker',
      status: 'Idle',
      location: { x: 100, y: 100 }
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
