import Phaser from 'phaser';
import { RapierManager } from '../physics/RapierManager';
import RAPIER from '@dimforge/rapier2d-compat';
import { ProjectileType, PROJECTILE_DATA } from './ProjectileTypes';
import { INTERACTION_PROJECTILE } from '../physics/PhysicsGroups';

export class Projectile extends Phaser.GameObjects.Sprite {
    private bodyId: RAPIER.RigidBody;
    private rapierManager: RapierManager;
    private world: RAPIER.World;
    public damage: number;

    constructor(
        scene: Phaser.Scene, 
        x: number, 
        y: number, 
        angle: number, 
        velocity: number = 20, 
        world?: RAPIER.World, 
        public projectileType: ProjectileType = ProjectileType.BASIC,
        public teamId: string | null = null
    ) {
        super(scene, x, y, 'projectile'); 

        const stats = PROJECTILE_DATA[projectileType];
        this.damage = stats.damage;
        
        // If no texture is loaded, we can just use a shape visibly or rely on the scene to have a texture.
        // For safety, let's create a texture if it doesn't exist or just use a circle.
        // Texture is expected to be created by MainScene
        // if (!scene.textures.exists('projectile')) { ... }

        this.setTexture('projectile');
        
        scene.add.existing(this);
        this.rapierManager = RapierManager.getInstance();

        // Allow passing a specific world (for prediction)
        this.world = world || this.rapierManager.world!;
        
        if (!this.world) {
            throw new Error("Rapier World not initialized");
        }

        // Physics: Dynamic body
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(x, y)
            .setLinvel(Math.cos(angle) * velocity, Math.sin(angle) * velocity)
            .setCcdEnabled(true); // Continuous collision detection for fast objects



        this.bodyId = this.world.createRigidBody(bodyDesc);
        (this.bodyId as any).userData = { type: 'projectile', visual: this };

        const colliderDesc = RAPIER.ColliderDesc.ball(5.0);
        // Enable collisions
        colliderDesc.setRestitution(0.8);
        colliderDesc.setFriction(0.5);
        // Volume (Area) = PI * 5^2 = ~78.54
        // We want Mass = 1.0 to match AI assumptions and Logic
        // Density = Mass / Volume
        colliderDesc.setDensity(1.0 / (Math.PI * 25));
        colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        
        colliderDesc.setCollisionGroups(INTERACTION_PROJECTILE);

        this.world.createCollider(colliderDesc, this.bodyId);
    }

    update(planets: import('./Planet').Planet[] = []) {
        if (!this.bodyId.isValid()) return;
        
        const translation = this.bodyId.translation();
        this.setPosition(translation.x, translation.y);
        
        // Colonizer Landing Logic
        // Colonizer Landing Logic
        if (this.projectileType === ProjectileType.COLONIZER && planets.length > 0) {
            // Find nearest planet
            let nearest: import('./Planet').Planet | null = null;
            let minDist = Infinity;
            
            for (const p of planets) {
                const surfaceDist = p.getDistanceToSurface(translation.x, translation.y);
                if (surfaceDist < minDist) {
                    minDist = surfaceDist;
                    nearest = p;
                }
            }

            // Smart Landing System
            if (nearest) {
                const vel = this.bodyId.linvel();
                const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
                const moveAngle = Math.atan2(vel.y, vel.x);

                // 1. Calculate Closest Point of Approach (CPA) to see if we are on a collision course
                // Vector to planet center
                const toPlanetX = nearest.position.x - translation.x;
                const toPlanetY = nearest.position.y - translation.y;
                
                // Project 'toPlanet' onto velocity direction
                // Unit velocity
                const vx = vel.x / speed;
                const vy = vel.y / speed;
                
                // Dot product: length of projection
                const dot = toPlanetX * vx + toPlanetY * vy;
                
                // Closest point on trajectory line
                const closestX = translation.x + vx * dot;
                const closestY = translation.y + vy * dot;
                
                // Distance from planet center to this closest point
                const distToTrajectory = Phaser.Math.Distance.Between(closestX, closestY, nearest.position.x, nearest.position.y);
                
                // Are we colliding? (Trajectory passes within radius)
                // We add a small buffer (e.g. 10px) to be sure
                const isCollisionCourse = distToTrajectory < (nearest.radiusValue + 10) && dot > 0; // dot > 0 means planet is in front, not behind

                // 2. Levitation / Soft Landing (< 15px)
                if (isCollisionCourse && minDist < 15) {
                    // Anti-gravity levitation to prevent smashing
                    // Gravity is approx 10-20? We want to counteract it plus slow down.
                    const hoverForce = 0.8 * this.bodyId.mass();
                    
                    // Apply force AWAY from planet center
                    const angleFromPlanet = Math.atan2(translation.y - nearest.position.y, translation.x - nearest.position.x);
                    const hx = Math.cos(angleFromPlanet) * hoverForce;
                    const hy = Math.sin(angleFromPlanet) * hoverForce;
                    
                    this.bodyId.applyImpulse({ x: hx, y: hy }, true);
                    
                    // Also damp velocity if too fast
                    if (speed > 5) {
                         const dampX = -vel.x * 0.1 * this.bodyId.mass();
                         const dampY = -vel.y * 0.1 * this.bodyId.mass();
                         this.bodyId.applyImpulse({ x: dampX, y: dampY }, true);
                    }
                }
                // 3. Suicide Burn (< 60px)
                else if (isCollisionCourse && minDist < 60) {
                     // Only brake if going fast
                     const targetSpeed = (minDist / 60) * 30 + 5; // Scale speed down
                     
                     if (speed > targetSpeed) {
                         // Retro-rockets!
                         const brakeForce = 2.0 * this.bodyId.mass(); // Strong braking
                         const brakeX = -vx * brakeForce;
                         const brakeY = -vy * brakeForce;
                         
                         this.bodyId.applyImpulse({ x: brakeX, y: brakeY }, true);
                         
                         // Visuals (Exhaust forward)
                         import('../logic/FXManager').then(({ FXManager }) => {
                              const offset = 8;
                              const emitX = translation.x + Math.cos(moveAngle) * offset;
                              const emitY = translation.y + Math.sin(moveAngle) * offset;
                              FXManager.getInstance().createThrustEffect(emitX, emitY, moveAngle + Math.PI);
                         });
                     }
                }
                // Else: Slingshot! Do nothing.
            }
        }

        // Cleanup if out of bounds (simple check)
        if (translation.x < -2000 || translation.x > 4000 || translation.y < -2000 || translation.y > 4000) {
           this.destroy();
        }
    }
    
    destroy(fromScene?: boolean) {
        if (this.world && this.bodyId.isValid()) {
            this.world.removeRigidBody(this.bodyId);
        }
        super.destroy(fromScene);
    }

    applyForce(x: number, y: number) {
        if (this.bodyId.isValid()) {
            this.bodyId.addForce({ x, y }, true);
        }
    }

    getMass(): number {
        if (this.bodyId.isValid()) {
            return this.bodyId.mass();
        }
        return 1;
    }

    get position(): { x: number, y: number } {
        if (this.bodyId.isValid()) {
            return this.bodyId.translation();
        }
        return { x: this.x, y: this.y };
    }
}
