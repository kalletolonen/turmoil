import Phaser from 'phaser';
import { ProjectileType, PROJECTILE_DATA } from './ProjectileTypes';
import { GravitySystem } from '../logic/GravitySystem';
import { FXManager } from '../logic/FXManager';

export class Projectile extends Phaser.GameObjects.Sprite {
    public damage: number;
    public processed: boolean = false;
    
    // Math-based movement properties
    private velX: number;
    private velY: number;
    private readonly PROJECTILE_RADIUS = 5;
    private readonly PROJECTILE_MASS = 1.0;

    constructor(
        scene: Phaser.Scene, 
        x: number, 
        y: number, 
        angle: number, 
        velocity: number = 20, 
        _world?: any, // Keep signature for compatibility but unused
        public projectileType: ProjectileType = ProjectileType.BASIC,
        public teamId: string | null = null
    ) {
        super(scene, x, y, 'projectile'); 

        const stats = PROJECTILE_DATA[projectileType];
        this.damage = stats.damage;
        
        this.setTexture('projectile');
        scene.add.existing(this);
        
        // Store velocity directly (in pixels per frame)
        this.velX = Math.cos(angle) * velocity;
        this.velY = Math.sin(angle) * velocity;
        
        // Set initial position
        this.setPosition(x, y);
    }

    update(planets: import('./Planet').Planet[] = [], projectiles: Projectile[] = []) {
        // Apply gravity forces (matching TrajectorySystem and GravitySystem)
        let forceX = 0;
        let forceY = 0;
        

        for (const planet of planets) {
            const dx = planet.position.x - this.x;
            const dy = planet.position.y - this.y;
            const distSq = dx * dx + dy * dy;
            
            // Optimization: Influence check
            const influenceDist = planet.radiusValue * GravitySystem.INFLUENCE_MULTIPLIER;
            if (distSq > influenceDist * influenceDist) continue;
            
            const dist = Math.sqrt(distSq);
            
            // Check collision with Turrets
            const TURRET_HIT_RADIUS_SQ = 15 * 15;
            for (const turret of planet.turretsList) {
                const tDx = turret.position.x - this.x;
                const tDy = turret.position.y - this.y;
                const tDistSq = tDx*tDx + tDy*tDy;
                
                if (tDistSq < TURRET_HIT_RADIUS_SQ) {
                     this.handleTurretHit(planets);
                     return;
                }
            }

            // Check collision with planet surface
            // 1. Broad phase: Point check
            if (dist < planet.radiusValue + this.PROJECTILE_RADIUS) {
                 const distToSurface = planet.getDistanceToSurface(this.x, this.y);
                 if (distToSurface <= this.PROJECTILE_RADIUS) {
                    this.handlePlanetCollision(planet, planets);
                    return;
                 }
            }
            
            // 2. Continuous Collision Detection (Raycast) for high speeds
            // Check if line from previous position to current position intersects planet radius
            // We use previous frame position (implied by subtracting velocity, or tracking if accurate)
            // Ideally we track prevX/prevY, but estimating from velocity is "good enough" for this frame
            // actually we calculate next position at end of loop, so 'this.x' is current.
            // We need to check the MOVING segment.
            
            // Wait, we loop planets BEFORE moving. So 'this.x' is OLD position.
            // But we compute forces to get NEW velocity, then move.
            // The logic below calculates forces.
            // The movement happens at end of update.
            // So we should do collision check AFTER movement?
            // OR checks "swept" volume. 
            
            // Current code checks static position 'this.x' against planet.
            // If we move update logic to start of frame, we can use old/new.
            
            // Let's defer this check to AFTER movement loop below?
            // Or better: keep force logic here, moving logic at bottom, then check collision?
            // No, standard is: Update Velocity -> Update Position -> Check Collision.
            
            // Current order:
            // 1. Check Collision (at current X)
            // 2. Calculate Forces
            // 3. Update Velocity
            // 4. Update Position
            
            // Issue: If we move INTO a planet, we won't detect it until NEXT frame.
            // If we move THROUGH a planet (start outside, end outside), next frame misses it too.
            
            // Fix: Move collision check to AFTER position update.
            // AND use raycast from oldPos to newPos.
            
            // Let's refactor the loop.
            // 1. Calculate all forces FIRST.
            // 2. Move.
            // 3. Check collisions (Raycast).
        }
        
        // 1. Calculate Forces
        for (const planet of planets) {
            const dx = planet.position.x - this.x;
            const dy = planet.position.y - this.y;
            const distSq = dx * dx + dy * dy;
            
            // Optimization: Influence check
            const influenceDist = planet.radiusValue * GravitySystem.INFLUENCE_MULTIPLIER;
            if (distSq > influenceDist * influenceDist) continue;
            
            const dist = Math.sqrt(distSq);
            
            const planetMass = planet.radiusValue * planet.radiusValue;
            const clampedDist = Math.max(dist, planet.radiusValue * 0.3);
            const clampedDistSq = clampedDist * clampedDist;
            
            let forceMagnitude = (GravitySystem.G * planetMass) / clampedDistSq;
            forceMagnitude *= this.PROJECTILE_MASS;
            
            forceX += (dx / dist) * forceMagnitude;
            forceY += (dy / dist) * forceMagnitude;
        }

        // 2. Integrate Physics
        const accelX = forceX / this.PROJECTILE_MASS;
        const accelY = forceY / this.PROJECTILE_MASS;
        
        this.velX += accelX;
        this.velY += accelY;
        
        const prevX = this.x;
        const prevY = this.y;
        
        this.x += this.velX;
        this.y += this.velY;
        this.setPosition(this.x, this.y);

        // 3. Collision Detection (CCD)
        const checkLineCircleIntersect = (x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number): boolean => {
             const dx = x2 - x1;
             const dy = y2 - y1;
             const fx = x1 - cx;
             const fy = y1 - cy;
             const a = dx*dx + dy*dy;
             const b = 2*(fx*dx + fy*dy);
             const c = (fx*fx + fy*fy) - r*r;
             let discriminant = b*b - 4*a*c;
             if (discriminant < 0) return false;
             discriminant = Math.sqrt(discriminant);
             const t1 = (-b - discriminant) / (2*a);
             const t2 = (-b + discriminant) / (2*a);
             return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
        };

        for (const planet of planets) {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, planet.position.x, planet.position.y);

            // Turrets
            const TURRET_HIT_RADIUS_SQ = 15 * 15;
            for (const turret of planet.turretsList) {
                const tDistSq = Phaser.Math.Distance.Squared(this.x, this.y, turret.position.x, turret.position.y);
                if (tDistSq < TURRET_HIT_RADIUS_SQ) {
                     this.handleTurretHit(planets);
                     return;
                }
            }
            
            // Planet Surface (CCD)
            // effective radius for raycast (slightly forgiving)
            const hitRadius = planet.radiusValue + this.PROJECTILE_RADIUS;
            
            // A. Point Check (Existing logic)
            if (dist < hitRadius) {
                 const distToSurface = planet.getDistanceToSurface(this.x, this.y);
                 if (distToSurface <= this.PROJECTILE_RADIUS) {
                    this.handlePlanetCollision(planet, planets);
                    return;
                 }
            }

            // B. Raycast Check (Tunneling prevention)
            // If we crossed the bounding sphere, we check sub-steps to see if we hit ACTUAL terrain.
            // This prevents "Phantom Surface" hits at the bounding radius (craters).
            if (dist < hitRadius + 50) { 
                if (checkLineCircleIntersect(prevX, prevY, this.x, this.y, planet.position.x, planet.position.y, hitRadius)) {
                    // We crossed the bounding sphere. Now verify terrain collision.
                    // Sub-step from prev to current
                    const STEPS = 5;
                    for (let i = 1; i <= STEPS; i++) {
                        const t = i / STEPS;
                        const subX = prevX + (this.x - prevX) * t;
                        const subY = prevY + (this.y - prevY) * t;
                        
                        const subDistToSurface = planet.getDistanceToSurface(subX, subY);
                        if (subDistToSurface <= this.PROJECTILE_RADIUS) {
                             // Hit actual ground during travel
                             this.x = subX; // Snap to hit position (optional, but good for accuracy)
                             this.y = subY;
                             this.handlePlanetCollision(planet, planets);
                             return;
                        }
                    }
                }
            }
        }

        // General Mid-Air Collision (All Projectiles)
        // Check if we hit any enemy projectile directly
        const COLLISION_RADIUS = 10; // Direct hit radius
        for (const other of projectiles) {
            if (other === this) continue;
            if (!other.body && !other.scene) continue; // Skip destroyed
            if (this.teamId && other.teamId && this.teamId === other.teamId) continue; // No friendly fire

            const distSq = Phaser.Math.Distance.Squared(this.x, this.y, other.x, other.y);
            if (distSq < COLLISION_RADIUS * COLLISION_RADIUS) {
                // Mutual Destruction
                FXManager.getInstance().createExplosion(this.x, this.y, 0xffaa00, 20); // Small explosion
                
                other.destroy();
                if (this.scene) (this.scene as any).removeProjectile(other);
                
                this.destroy();
                if (this.scene) (this.scene as any).removeProjectile(this);
                return;
            }
        }

        // Defender Logic - intercept enemy projectiles
        if (this.projectileType === ProjectileType.DEFENDER) {
            const stats = PROJECTILE_DATA[this.projectileType];
            const radius = stats.explosionRadius;
            
            // Find enemy projectiles in range
            const targets = projectiles.filter(p => {
                if (p === this) return false;
                
                // Check team (intercept enemies)
                if (this.teamId && p.teamId && this.teamId === p.teamId) return false;
                
                const dist = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
                return dist <= radius;
            });

            if (targets.length > 0) {
                 // Explode
                 FXManager.getInstance().createExplosion(this.x, this.y, stats.color, radius);

                 // Destroy targets
                 targets.forEach(t => {
                     t.destroy();
                     if (this.scene) (this.scene as any).removeProjectile(t);
                 });

                 // Destroy self
                 this.destroy();
                 if (this.scene) (this.scene as any).removeProjectile(this);
                 return;
            }
        }
        
        // Colonizer Landing Logic
        if (this.projectileType === ProjectileType.COLONIZER && planets.length > 0) {
            // Find nearest planet
            let nearest: import('./Planet').Planet | null = null;
            let minDist = Infinity;
            
            for (const p of planets) {
                const surfaceDist = p.getDistanceToSurface(this.x, this.y);
                if (surfaceDist < minDist) {
                    minDist = surfaceDist;
                    nearest = p;
                }
            }

            // Smart Landing System
            if (nearest) {
                const speed = Math.sqrt(this.velX * this.velX + this.velY * this.velY);
                const moveAngle = Math.atan2(this.velY, this.velX);

                // Calculate Closest Point of Approach
                const toPlanetX = nearest.position.x - this.x;
                const toPlanetY = nearest.position.y - this.y;
                
                // Unit velocity
                const vx = this.velX / speed;
                const vy = this.velY / speed;
                
                // Dot product: length of projection
                const dot = toPlanetX * vx + toPlanetY * vy;
                
                // Closest point on trajectory line
                const closestX = this.x + vx * dot;
                const closestY = this.y + vy * dot;
                
                // Distance from planet center to this closest point
                const distToTrajectory = Phaser.Math.Distance.Between(closestX, closestY, nearest.position.x, nearest.position.y);
                
                // Are we on collision course?
                const isCollisionCourse = distToTrajectory < (nearest.radiusValue + 10) && dot > 0;

                // Levitation / Soft Landing (< 15px)
                if (isCollisionCourse && minDist < 15) {
                    if (speed > 4) {
                        // Anti-gravity levitation
                        const hoverForce = 0.8;
                        
                        // Apply force AWAY from planet center
                        const angleFromPlanet = Math.atan2(this.y - nearest.position.y, this.x - nearest.position.x);
                        const hx = Math.cos(angleFromPlanet) * hoverForce;
                        const hy = Math.sin(angleFromPlanet) * hoverForce;
                        
                        this.velX += hx;
                        this.velY += hy;
                        
                        // Damp velocity
                        this.velX *= 0.9;
                        this.velY *= 0.9;
                    }
                }
                // Suicide Burn (< 60px)
                else if (isCollisionCourse && minDist < 60) {
                     const targetSpeed = (minDist / 60) * 30 + 5;
                     
                     if (speed > targetSpeed) {
                         // Retro-rockets!
                         const brakeForce = 2.0;
                         const brakeX = -vx * brakeForce;
                         const brakeY = -vy * brakeForce;
                         
                         this.velX += brakeX;
                         this.velY += brakeY;
                         
                         // Visuals (Exhaust forward)
                          const offset = 8;
                          const emitX = this.x + Math.cos(moveAngle) * offset;
                          const emitY = this.y + Math.sin(moveAngle) * offset;
                          FXManager.getInstance().createThrustEffect(emitX, emitY, moveAngle + Math.PI);
                     }
                }
            }
        }

        // Cleanup if out of bounds
        if (this.x < -2000 || this.x > 4000 || this.y < -2000 || this.y > 4000) {
           this.destroy();
           if (this.scene) (this.scene as any).removeProjectile(this);
           return;
        }
    }
    
    private handleTurretHit(planets: import('./Planet').Planet[]) {
        if (this.processed) return;
        this.processed = true;

        const stats = PROJECTILE_DATA[this.projectileType];
        
        // Explode at Projectile position
        FXManager.getInstance().createExplosion(this.x, this.y, stats.color, stats.explosionRadius);
        
        // Deal damage
        if (this.scene) {
             const cm = (this.scene as any).combatManager;
             if (cm) {
                 // Correct signature: x, y, radius, maxDamage, planets, pushForce
                 cm.applyRadialDamage(
                    this.x, 
                    this.y, 
                    stats.explosionRadius, 
                    this.damage,
                    planets,
                    stats.pushForce
                );
             }
        }
        
        this.destroy();
        if (this.scene) (this.scene as any).removeProjectile(this);
    }

    private handlePlanetCollision(planet: import('./Planet').Planet, planets: import('./Planet').Planet[]) {
        // Guard against double-processing
        if (this.processed) return;
        this.processed = true;
        
        const stats = PROJECTILE_DATA[this.projectileType];
        
        // Capture scene and position before potential destruction
        const scene = this.scene;
        const x = this.x;
        const y = this.y;
        
        if (!scene) return; // Should not happen but safety check
        
        // Colonizer landing
        if (this.projectileType === ProjectileType.COLONIZER) {
            // Calculate angle for turret placement
            const angle = Math.atan2(y - planet.position.y, x - planet.position.x);
            planet.addTurretAtAngle(angle, this.teamId);
            
            // Landing effect
            FXManager.getInstance().createExplosion(x, y, stats.color, stats.explosionRadius);
            
            this.destroy();
            if (scene) (scene as any).removeProjectile(this);
            return;
        }
        
        // Regular projectile collision
        
        // Create explosion effect
        FXManager.getInstance().createExplosion(x, y, stats.color, stats.explosionRadius);
        
        // Deal damage to planet (takeDamage signature: worldX, worldY, radius)
        if (this.damage > 0) {
            planet.takeDamage(x, y, stats.explosionRadius);
        }
        
        // Apply radial damage to turrets
        const combatManager = (scene as any).combatManager;
        if (combatManager) {
            // Use passed planets array and pushForce
            combatManager.applyRadialDamage(
                x, 
                y, 
                stats.explosionRadius, 
                this.damage, 
                planets,
                stats.pushForce
            );
        }
        
        // Destroy projectile
        this.destroy();
        if (scene) (scene as any).removeProjectile(this);
    }
    
    destroy(fromScene?: boolean) {
        super.destroy(fromScene);
    }

    applyForce(x: number, y: number) {
        // Convert force to acceleration and apply to velocity
        const accelX = x / this.PROJECTILE_MASS;
        const accelY = y / this.PROJECTILE_MASS;
        this.velX += accelX;
        this.velY += accelY;
    }

    getMass(): number {
        return this.PROJECTILE_MASS;
    }

    get position(): { x: number, y: number } {
        return { x: this.x, y: this.y };
    }
}
