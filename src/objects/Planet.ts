import Phaser from 'phaser';
import { RapierManager } from '../physics/RapierManager';
import RAPIER from '@dimforge/rapier2d-compat';
import { SeededRNG } from '../logic/SeededRNG';
import { Turret } from './Turret';
import { FXManager } from '../logic/FXManager';
import polybool from 'polybooljs';
import earcut from 'earcut';

export class Planet {
    private body: RAPIER.RigidBody;
    private visual: Phaser.GameObjects.Graphics;
    private turrets: Turret[] = [];
    private radius: number;
    private scene: Phaser.Scene;
    private color: number;

    // Polybooljs uses regions: number[][][] (list of polygons, where each polygon is list of [x,y])
    private regions: number[][][] = [];

    public teamId: string | null = null;
    public readonly id: string = Phaser.Utils.String.UUID();

    constructor(scene: Phaser.Scene, x: number, y: number, radius: number, color: number = 0x66ccff, teamId: string | null = null, seed: number = 0) {
        this.teamId = teamId;
        this.scene = scene;
        this.radius = radius;
        this.color = color;
        const rapierManager = RapierManager.getInstance();
        if (!rapierManager.world) {
             throw new Error("Rapier World not initialized");
        }

        // Initialize Terrain
        this.generateTerrain(seed);

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


    private generateTerrain(seed: number) {
        // Simple seeded RNG wrapper if needed, or just use the SeededRNG
        const rng = new SeededRNG(seed);
        
        // 1. Base Circle
        const SEGMENTS = 128; // Increased for smoother base
        const poly: number[][] = [];
        for (let i = 0; i < SEGMENTS; i++) {
            const angle = (i / SEGMENTS) * Math.PI * 2;
            poly.push([
                this.radius * Math.cos(angle),
                this.radius * Math.sin(angle)
            ]);
        }
        this.regions = [poly];

        // Track angular usage to prevent overlap: [start, end] in radians
        // We normalize to 0..2PI
        const reservedRanges: {start: number, end: number}[] = [];

        const isRangeFree = (start: number, end: number): boolean => {
             // Handle wrapping for the check: normalize everything to 0..2PI
             // If a range wraps (start > end), treat as two ranges: [start, 2PI] and [0, end]
             
             const rangesToCheck: {s: number, e: number}[] = [];
             if (start > end) {
                 rangesToCheck.push({s: start, e: Math.PI * 2});
                 rangesToCheck.push({s: 0, e: end});
             } else {
                 rangesToCheck.push({s: start, e: end});
             }
             
             for (const check of rangesToCheck) {
                 for (const reserved of reservedRanges) {
                     // Check intersection
                     // Simple range intersection: (StartA <= EndB) and (EndA >= StartB)
                     // But we must handle the reserved wrapping too.
                     // Easier strategy: Expand reserved ranges into non-wrapping list for comparison
                     
                     const reservedExpanded: {s: number, e: number}[] = [];
                     if (reserved.start > reserved.end) {
                         reservedExpanded.push({s: reserved.start, e: Math.PI * 2});
                         reservedExpanded.push({s: 0, e: reserved.end});
                     } else {
                         reservedExpanded.push({s: reserved.start, e: reserved.end});
                     }
                     
                     for (const r of reservedExpanded) {
                         if (Math.max(check.s, r.s) < Math.min(check.e, r.e)) {
                             return false; // Overlap
                         }
                     }
                 }
             }
             return true;
        };

        const reserveRange = (start: number, end: number) => {
            // Normalize
            start = (start % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
            end = (end % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
            reservedRanges.push({ start, end });
        };


        // 2. Craters (Jagged)
        if (rng.nextFloat() < 0.7) {
            const craterCount = rng.nextInt(1, 4); 
            let placed = 0;
            let attempts = 0;
            while(placed < craterCount && attempts < 20) {
                attempts++;
                const angle = rng.nextRange(0, Math.PI * 2);
                const baseSize = rng.nextRange(this.radius * 0.15, this.radius * 0.35);
                
                // Approximate angular width of crater
                // arc = s / r
                const halfArc = (baseSize * 1.2) / this.radius; // 1.2 safety factor
                const startAngle = angle - halfArc;
                const endAngle = angle + halfArc;
                
                if (!isRangeFree((startAngle % (Math.PI*2) + Math.PI*2)%(Math.PI*2), (endAngle % (Math.PI*2) + Math.PI*2)%(Math.PI*2))) {
                    continue;
                }
                
                reserveRange(startAngle, endAngle);
                placed++;

                // Position on rim
                const cx = Math.cos(angle) * this.radius;
                const cy = Math.sin(angle) * this.radius;
                
                // Create crater polygon with noise
                const C_SEGS = 32;
                const cPoly: number[][] = [];
                for(let j=0; j<C_SEGS; j++) {
                    const a = (j/C_SEGS) * Math.PI * 2;
                    const noise = rng.nextRange(-baseSize * 0.2, baseSize * 0.2); 
                    const r = baseSize + noise;

                    cPoly.push([
                        cx + r * Math.cos(a),
                        cy + r * Math.sin(a)
                    ]);
                }
                
                const current = { regions: this.regions, inverted: false };
                const diff = { regions: [cPoly], inverted: false };
                this.regions = polybool.difference(current, diff).regions;
            }
        }

        // 3. Mountains (Jagged)
        if (rng.nextFloat() < 0.6) {
            const mountainCount = rng.nextInt(1, 4);
            let placed = 0;
            let attempts = 0;
            while (placed < mountainCount && attempts < 20) {
                attempts++;
                const centerAngle = rng.nextRange(0, Math.PI * 2);
                const widthArc = rng.nextRange(0.4, 0.8);
                
                const startAngle = centerAngle - widthArc / 2;
                const endAngle = centerAngle + widthArc / 2;
                
                 if (!isRangeFree((startAngle % (Math.PI*2) + Math.PI*2)%(Math.PI*2), (endAngle % (Math.PI*2) + Math.PI*2)%(Math.PI*2))) {
                    continue;
                }
                
                reserveRange(startAngle, endAngle);
                placed++;

                const peakHeight = rng.nextRange(this.radius * 0.2, this.radius * 0.4);
                
                // Base points (deeply inset to ensure solid anchor to planet)
                const radInset = this.radius * 0.8;
                
                const b1x = Math.cos(startAngle) * radInset;
                const b1y = Math.sin(startAngle) * radInset;
                
                const b2x = Math.cos(endAngle) * radInset;
                const b2y = Math.sin(endAngle) * radInset;
                
                const mPoly: number[][] = [];
                mPoly.push([b1x, b1y]);

                // Generate jagged surface points
                const STEPS = 16;
                for (let s = 0; s <= STEPS; s++) {
                    const t = s / STEPS;
                    const curAngle = startAngle + t * (endAngle - startAngle);
                    
                    let shapeFactor = 0;
                    if (t < 0.5) shapeFactor = t * 2;
                    else shapeFactor = (1 - t) * 2;
                    
                    const noise = rng.nextRange(-peakHeight * 0.2, peakHeight * 0.2);
                    
                    const h = (peakHeight * shapeFactor) + noise;
                    const r = this.radius + Math.max(0, h);

                    mPoly.push([
                        Math.cos(curAngle) * r,
                        Math.sin(curAngle) * r
                    ]);
                }

                mPoly.push([b2x, b2y]);
                
                const current = { regions: this.regions, inverted: false };
                const union = { regions: [mPoly], inverted: false };
                this.regions = polybool.union(current, union).regions;
            }
        }
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
             
             // Earcut expects flat array [x0, y0, x1, y1, ...]
             const flatVertices: number[] = [];
             region.forEach(p => {
                 flatVertices.push(p[0], p[1]);
             });

             // Triangulate
             const indices = earcut(flatVertices);
             
             // Manually create a collider for each triangle
             for (let i = 0; i < indices.length; i += 3) {
                 const idx1 = indices[i];
                 const idx2 = indices[i+1];
                 const idx3 = indices[i+2];
                 
                 const p1 = { x: flatVertices[idx1 * 2], y: flatVertices[idx1 * 2 + 1] };
                 const p2 = { x: flatVertices[idx2 * 2], y: flatVertices[idx2 * 2 + 1] };
                 const p3 = { x: flatVertices[idx3 * 2], y: flatVertices[idx3 * 2 + 1] };
                 
                 // Rapier triangleCollider
                 const triDesc = RAPIER.ColliderDesc.triangle(p1, p2, p3);
                 triDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
                 rapierManager.world!.createCollider(triDesc, this.body);
             }
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
        // Minimum distance between turrets (arc length)
        const MIN_DIST = 35; 
        const minAngle = MIN_DIST / this.radius;
        const occupiedAngles: number[] = [];

        for (let i = 0; i < count; i++) {
            let angle = 0;
            let valid = false;
            let attempts = 0;

            while (!valid && attempts < 20) {
                attempts++;
                angle = rng.nextRange(0, Math.PI * 2);
                
                // Check against existing
                valid = true;
                for (const oa of occupiedAngles) {
                    // Angular distance
                    let diff = Math.abs(angle - oa);
                    if (diff > Math.PI) diff = 2 * Math.PI - diff; // Handle wrap-around
                    
                    if (diff < minAngle) {
                        valid = false;
                        break;
                    }
                }
            }

            if (valid) {
                occupiedAngles.push(angle);
                
                const surfaceDist = this.getSurfaceDistanceAtAngle(angle);
                const turretDist = surfaceDist + 5; 
                const tx = this.body.translation().x + Math.cos(angle) * turretDist;
                const ty = this.body.translation().y + Math.sin(angle) * turretDist;
                
                this.turrets.push(new Turret(this.scene, tx, ty, angle, 10, 10, this.teamId));
            } else {
                console.warn(`Could not find valid position for turret ${i} on planet ${this.id}`);
            }
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
        // Check if there is already a turret nearby
        const MIN_DIST = 25; // Pixel distance buffer for checking existing (approx turret width + buffer)
        
        let existing: Turret | null = null;
        for (const t of this.turrets) {
             const tAngle = Math.atan2(t.position.y - this.body.translation().y, t.position.x - this.body.translation().x);
             let diff = Math.abs(angle - tAngle);
             if (diff > Math.PI) diff = 2 * Math.PI - diff;
             
             // Arc length approx
             const dist = diff * this.radius;
             
             if (dist < MIN_DIST && t.teamId === teamId) {
                 existing = t;
                 break;
             }
        }
        
        if (existing) {
             // Perform Spontaneous Fusion (Colonizer merges into existing)
             // We pretend the colonizer was a lvl 1 turret
             // Increase stats
             existing.maxHealth += 100;
             existing.health += 100;
             existing.maxActionPoints += 10;
             existing.actionPoints += 10;
             
             existing.visual.setTint(0x00ffff);
             existing.visual.setScale(existing.visual.scaleX * 1.2, existing.visual.scaleY * 1.2);
             
             import('../logic/FXManager').then(({ FXManager }) => {
                FXManager.getInstance().createFloatingText(existing!.position.x, existing!.position.y, "FUSION!", 0x00ffff);
             });

             existing.updateHealthBar();
             return existing;
        }

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

        return maxSurfaceDist;
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

        // Check for undermined turrets
        this.turrets.forEach(turret => {
            if (!turret.isFalling) {
                const dist = this.getDistanceToSurface(turret.position.x, turret.position.y);
                if (dist > 5) {
                    turret.setFalling(true);
                }
            }
        });
    }
}
