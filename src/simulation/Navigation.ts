export interface NavNode {
  id: string;
  x: number;
  y: number;
  neighbors: string[];
}

export class NavigationManager {
  private nodes: Map<string, NavNode> = new Map();

  constructor(tileData: number[], width: number, height: number) {
    this.bakeGraph(tileData, width, height);
  }

  private bakeGraph(tileData: number[], width: number, height: number) {
    // 1. Identify "Interest Points" (Intersections and Doorways)
    // For this simple version, every walkable tile is a potential node
    // but we only keep ones that are junctions or ends.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const gid = tileData[y * width + x];
        if (gid === 1) { // Corridor
          const id = `${x},${y}`;
          this.nodes.set(id, { id, x, y, neighbors: [] });
        }
      }
    }

    // 2. Connect adjacent nodes
    for (const node of this.nodes.values()) {
      const neighbors = [
        { x: node.x + 1, y: node.y },
        { x: node.x - 1, y: node.y },
        { x: node.x, y: node.y + 1 },
        { x: node.x, y: node.y - 1 }
      ];

      for (const n of neighbors) {
        const nId = `${n.x},${n.y}`;
        if (this.nodes.has(nId)) {
          node.neighbors.push(nId);
        }
      }
    }
  }

  public findPath(start: { x: number, y: number }, end: { x: number, y: number }): NavNode[] {
    // Simple BFS/A* on the baked graph
    // For Phase 2, we return a simple linear path for now
    return []; 
  }
}
