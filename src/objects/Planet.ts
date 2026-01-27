import Phaser from 'phaser';
import { RapierManager } from '../physics/RapierManager';
import RAPIER from '@dimforge/rapier2d-compat';
import { SeededRNG } from '../logic/SeededRNG';
import { Turret } from './Turret';
import { FXManager } from '../logic/FXManager';
import polybool from 'polybooljs';

export class Planet {
    private body: RAPIER.RigidBody;
    private visual: Phaser.GameObjects.Graphics;
    private turrets: Turret[] = [];
    private radius: number;
    private scene: Phaser.Scene;
    private color: number;

    // Polybooljs uses regions: number[][][] (list of polygons, where each polygon is list of [x,y])
    private regions: number[][][];

    public teamId: string | null = null;
    public readonly id: string = Phaser.Utils.String.UUID();

    constructor(scene: Phaser.Scene, x: number, y: number, radius: number, color: number = 0x66ccff, teamId: string | null = null) {
        this.teamId = teamId;
        this.scene = scene;
        this.radius = radius;
        this.color = color;
        const rapierManager = RapierManager.getInstance();
        if (!rapierManager.world) {
             throw new Error("Rapier World not initialized");
        }

        // Initialize Geometry as a Circle (approximated by polygon)
        const SEGMENTS = 64;
        const poly: number[][] = [];
        for (let i = 0; i < SEGMENTS; i++) {
            const angle = (i / SEGMENTS) * Math.PI * 2;
            poly.push([
                radius * Math.cos(angle),
                radius * Math.sin(angle)
            ]);
        }
        // Polybool expects regions to be an array of polygons (for islands/holes)
        this.regions = [poly];

        // Physics: Static body
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(x, y);
        this.body = rapierManager.world.createRigidBody(bodyDesc);
        (this.body as any).userData = { type: 'planet', parent: this };
        
        this.rebuildCollider();

        // Visual
        this.visual = scene.add.graphics({ x: x, y: y });
        this.draw();
    }

    private rebuildCollider() {
        const rapierManager = RapierManager.getInstance();
        if (!rapierManager.world) return;
        
        // Remove existing colliders
        const count = this.body.numColliders();
        const colliders: RAPIER.Collider[] = [];
        for(let i=0; i<count; i++) {
            colliders.push(this.body.collider(i));
        }
        colliders.forEach(c => rapierManager.world!.removeCollider(c, false));

        // Create new colliders for each region (island)
        this.regions.forEach(region => {
             if (region.length < 3) return;
             
             // Flatten for Rapier Polyline
             const vertices: Float32Array = new Float32Array(region.length * 2);
             for(let i=0; i<region.length; i++) {
                 vertices[i*2] = region[i][0];
                 vertices[i*2+1] = region[i][1];
             }
             
             // Using polyline for boundary
             const colliderDesc = RAPIER.ColliderDesc.polyline(vertices);
             rapierManager.world!.createCollider(colliderDesc, this.body);
        });
    }

    private draw() {
        this.visual.clear();
        this.visual.fillStyle(this.color);
        // this.visual.lineStyle(2, 0xffffff); // Optional outline

        this.regions.forEach(region => {
            const points = region.map(p => ({ x: p[0], y: p[1] }));
            this.visual.fillPoints(points, true, true);
        });
    }

    destroy() {
        this.visual.destroy();
        // Physics body cleanup should be handled by caller or scene cleanup
    }

    spawnTurrets(rng: SeededRNG, count: number) {
        // Simple spawn on original radius for now
        for (let i = 0; i < count; i++) {
            const angle = rng.nextRange(0, Math.PI * 2);
            const surfaceDist = this.getSurfaceDistanceAtAngle(angle);
            const turretDist = surfaceDist + 5; 
            const tx = this.body.translation().x + Math.cos(angle) * turretDist;
            const ty = this.body.translation().y + Math.sin(angle) * turretDist;
            
            this.turrets.push(new Turret(this.scene, tx, ty, angle, 10, 10, this.teamId));
        }
    }

    get position(): { x: number, y: number } {
        return this.body.translation();
    }

    get radiusValue(): number {
        return this.radius;
    }
    
    get turretsList(): Turret[] {
        return this.turrets;
    }

    addTurretAtAngle(angle: number, teamId: string | null) {
        const surfaceDist = this.getSurfaceDistanceAtAngle(angle);
        const turretDist = surfaceDist + 5; 
        const tx = this.body.translation().x + Math.cos(angle) * turretDist;
        const ty = this.body.translation().y + Math.sin(angle) * turretDist;
        
        const newTurret = new Turret(this.scene, tx, ty, angle, 10, 10, teamId);
        this.turrets.push(newTurret);
        return newTurret;
    }

    public getDistanceToSurface(worldX: number, worldY: number): number {
        const pPos = this.body.translation();
        const dx = worldX - pPos.x;
        const dy = worldY - pPos.y;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        
        if (distFromCenter === 0) return 0;

        const angle = Math.atan2(dy, dx);
        const surfaceDist = this.getSurfaceDistanceAtAngle(angle);

        return distFromCenter - surfaceDist;
    }

    private getSurfaceDistanceAtAngle(angle: number): number {
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);

        let maxSurfaceDist = 0;

        for (const region of this.regions) {
            for (let i = 0; i < region.length; i++) {
                const p1 = region[i];
                const p2 = region[(i + 1) % region.length];

                const x1 = p1[0], y1 = p1[1];
                const x2 = p2[0], y2 = p2[1];

                const dx = x2 - x1;
                const dy = y2 - y1;
                const det = dirY * dx - dirX * dy;
                
                if (Math.abs(det) < 0.000001) continue;

                const t = (y1 * dx - x1 * dy) / det;
                const u = (dirX * y1 - dirY * x1) / det;

                if (t >= 0 && u >= 0 && u <= 1) {
                    if (t > maxSurfaceDist) {
                        maxSurfaceDist = t;
                    }
                }
            }
        }

        return maxSurfaceDist === 0 ? this.radius : maxSurfaceDist;
    }

    public getControllerTeamId(): string | null {
        if (this.turrets.length === 0) return null;
        
        const firstTeam = this.turrets[0].teamId;
        if (!firstTeam) return null;

        for (let i = 1; i < this.turrets.length; i++) {
            if (this.turrets[i].teamId !== firstTeam) {
                return null;
            }
        }
        return firstTeam;
    }

    public takeDamage(worldX: number, worldY: number, radius: number) {
        // Convert world coords to local coords relative to planet center
        const pPos = this.body.translation();
        const localX = worldX - pPos.x;
        const localY = worldY - pPos.y;

        // Create impact polygon (circle)
        const SEGMENTS = 16;
        const impactPoly: number[][] = [];
        for (let i = 0; i < SEGMENTS; i++) {
            const angle = (i / SEGMENTS) * Math.PI * 2;
            impactPoly.push([
                localX + radius * Math.cos(angle),
                localY + radius * Math.sin(angle)
            ]);
        }

        // Perform subtraction
        const currentPoly = { regions: this.regions, inverted: false };
        const diffPoly = { regions: [impactPoly], inverted: false };
        const result = polybool.difference(currentPoly, diffPoly);

        this.regions = result.regions;

        // Update Physics & Visuals
        this.rebuildCollider();
        this.draw();

        // Spawn Physical Debris
        FXManager.getInstance().createDebrisBurst(worldX, worldY, this.color, 5);
    }
}
