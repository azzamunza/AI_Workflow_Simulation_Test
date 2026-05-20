export interface NavNode {
  id: string;
  x: number;
  y: number;
  neighbors: string[];
}

export class NavigationManager {
  private nodes: Map<string, NavNode> = new Map();

  constructor(tileData: number[], width: number, height: number, furnitureData: number[]) {
    this.bakeGraph(tileData, width, height, furnitureData);
  }

  private bakeGraph(tileData: number[], width: number, height: number, furnitureData: number[]) {
    // Include 0 (Outside/Empty), 1-8 (Floor/Rooms), 10-21 (Extended Rooms)
    // EXCLUDE 9 (Walls)
    const unwalkableGids = [9];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const gid = tileData[y * width + x];
        const furnitureGid = furnitureData[y * width + x];
        
        // Walkable if it's NOT a wall and NOT blocked by furniture (GID 9)
        // We allow walking through furniture GID 10 (desks) for pathfinding purposes if needed,
        // or we can stick to furnitureGid === 0 for strict collision.
        // Let's use furnitureGid !== 9 to allow walking over non-wall items.
        if (!unwalkableGids.includes(gid) && furnitureGid !== 9) {
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
    const startX = Math.floor(start.x / 32);
    const startY = Math.floor(start.y / 32);
    const endX = Math.floor(end.x / 32);
    const endY = Math.floor(end.y / 32);

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
