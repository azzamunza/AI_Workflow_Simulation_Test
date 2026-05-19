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
    // Walkable GIDs: 1=Corridor, 2-8=Depts, 10=Desk(some parts)
    // Wall GID 9 is strictly blocked
    const walkableGids = [1, 2, 3, 4, 5, 6, 7, 8];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const gid = tileData[y * width + x];
        if (walkableGids.includes(gid)) {
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
    const startX = Math.round(start.x / 32);
    const startY = Math.round(start.y / 32);
    const endX = Math.round(end.x / 32);
    const endY = Math.round(end.y / 32);

    const startId = `${startX},${startY}`;
    const endId = `${endX},${endY}`;

    // Debugging: Log the first 5 walkable nodes if lookup fails
    if (!this.nodes.has(startId)) {
       const keys = Array.from(this.nodes.keys()).slice(0, 5);
       console.warn(`Start node ${startId} not found. Sample walkable nodes: ${keys.join(' | ')}`);
       
       // FAILSAFE: Find nearest node
       let nearestId = "";
       let minDist = Infinity;
       for (const node of this.nodes.values()) {
         const d = Math.pow(node.x - startX, 2) + Math.pow(node.y - startY, 2);
         if (d < minDist) {
           minDist = d;
           nearestId = node.id;
         }
       }
       if (nearestId) return this.findPath({x: this.nodes.get(nearestId)!.x * 32, y: this.nodes.get(nearestId)!.y * 32}, end);
       return [];
    }
    if (!this.nodes.has(endId)) {
       console.warn(`End node ${endId} not in walkable nodes!`);
       return [];
    }

    // Simple BFS for pathfinding
    const queue: string[] = [startId];
    const visited = new Map<string, string | null>();
    visited.set(startId, null);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (currentId === endId) break;

      const node = this.nodes.get(currentId)!;
      for (const neighborId of node.neighbors) {
        if (!visited.has(neighborId)) {
          visited.set(neighborId, currentId);
          queue.push(neighborId);
        }
      }
    }

    // Reconstruct path
    const path: NavNode[] = [];
    if (startId === endId) return [this.nodes.get(startId)!];
    
    let current: string | null = endId;
    if (!visited.has(endId)) {
      console.warn(`No path found from ${startId} to ${endId}`);
      return [];
    }

    while (current !== null) {
      path.unshift(this.nodes.get(current)!);
      current = visited.get(current)!;
    }

    return path;
  }
}
