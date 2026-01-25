import Phaser from 'phaser';

export class FleetRenderer {
  private scene: Phaser.Scene;
  private mesh!: Phaser.GameObjects.Mesh;
  // private maxShips: number; // Unused

  constructor(scene: Phaser.Scene, _maxShips: number = 2000) {
    this.scene = scene;
    // this.maxShips = maxShips;
    this.createMesh();
  }

  private createMesh() {
    // Create a simple triangle texture for the ships if it doesn't exist
    if (!this.scene.textures.exists('ship')) {
      const graphics = this.scene.make.graphics({ x: 0, y: 0 }); // Removed invalid 'add: false'
      graphics.lineStyle(2, 0x00ff00);
      graphics.fillStyle(0x000000);
      graphics.beginPath();
      // Triangle shape
      graphics.moveTo(0, -10);
      graphics.lineTo(8, 10);
      graphics.lineTo(0, 6);
      graphics.lineTo(-8, 10);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
      graphics.generateTexture('ship', 20, 24);
    }

    // Initialize Mesh with the generated texture
    // 'triangs' or 'quads' mostly depends on what we want. Quads are easier for sprites.
    this.mesh = this.scene.add.mesh(0, 0, 'ship');
    // Important: Disable culling logic if ships can be anywhere, or manage it manually.
    // Ideally, we want to perform 'Instanced Rendering' if Phaser supports it easily via `add.mesh`
    // but standard Phaser Mesh uses vertices. 
    
    // For TRUE Instanced Rendering in modern WebGL, Phaser needs a custom pipeline or specific usage.
    // However, for < 5000 units, Phaser's built-in Blitter or just managing a Mesh with Quads is super fast.
    // Let's use a dynamic Mesh where we update vertices.
    
    // actually, let's stick to standard `Mesh` acting as a batch renderer for now.
    // Detailed implementation: We need 2 triangles (1 quad) per ship.
    // maxShips * 6 vertices.
    
    // Pre-allocate vertices?
    // In Phaser 3.60+, `Phaser.GameObjects.Mesh` is quite flexible.
  }

  /**
   * Updates the visual representation of the fleet based on physics bodies.
   * @param bodiesData Array of { x, y, rotation }
   */
  public update(bodiesData: { x: number, y: number, rotation: number, type?: string }[]) {
    this.mesh.clear();

    const w = 10; // Half width
    const h = 12; // Half height

    // We will push vertices manually for performance
    // A quad needs 2 triangles: 0-1-2 and 2-3-0 (index order usually)
    // Or just 6 vertices if unindexed.
    
    // Vertices relative to center (0,0)
    // TL: -w, -h
    // TR:  w, -h
    // BL: -w,  h
    // BR:  w,  h
    
    // UVs standard 0..1
    
    bodiesData.forEach(body => {
       // Filter out non-ships
       // If type is present and NOT 'ship', skip it.
       if (body.type && body.type !== 'ship') return;

       // Simple 2D Rotation matrix app
       const cos = Math.cos(body.rotation);
       const sin = Math.sin(body.rotation);
       
       const transform = (lx: number, ly: number) => ({
           x: body.x + (lx * cos - ly * sin),
           y: body.y + (lx * sin + ly * cos)
       });

       const pTL = transform(-w, -h);
       const pTR = transform(w, -h);
       const pBL = transform(-w, h);
       const pBR = transform(w, h);
       
       // Add Quad (2 triangles)
       // format: x, y, u, v, color(white), alpha
       const color = 0xffffff;
       const alpha = 1;

       // Tri 1: TL, BL, TR
       this.mesh.addVertex(pTL.x, pTL.y, 0, 0, color, alpha);
       this.mesh.addVertex(pBL.x, pBL.y, 0, 1, color, alpha);
       this.mesh.addVertex(pTR.x, pTR.y, 1, 0, color, alpha);

       // Tri 2: TR, BL, BR
       this.mesh.addVertex(pTR.x, pTR.y, 1, 0, color, alpha);
       this.mesh.addVertex(pBL.x, pBL.y, 0, 1, color, alpha);
       this.mesh.addVertex(pBR.x, pBR.y, 1, 1, color, alpha);
    });
  }
}
