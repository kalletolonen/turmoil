import RAPIER from '@dimforge/rapier2d-compat';
import { GravitySystem } from '../logic/GravitySystem';
import { Planet } from '../objects/Planet';

export class PhysicsSimulator {
    private world: RAPIER.World;
    private ghostBody: RAPIER.RigidBody | null = null;

    private planetBodies: Map<string, RAPIER.RigidBody> = new Map();

    constructor() {
        // No global gravity, we apply it manually just like the game
        this.world = new RAPIER.World({ x: 0, y: 0 });
    }

    /**
     * Syncs the simulation world with the current game state.
     * Should be called before running a batch of simulations if planets have changed.
     */
    public syncPlanets(planets: Planet[]) {
        // ideally we only add planets once, but for now we can clear and rebuild 
        // or check consistency. Since planets are static in this game (mostly), 
        // we can just check if we have them.
        
        // efficient sync:
        // 1. Remove bodies not in list
        // 2. Add/Update bodies
        
        // For this specific game, planets don't move or die yet, so we can just init once
        // or simple clear/rebuild if we want to be robust. 
        // Let's do clear/rebuild to be safe for now, optimization later if needed.
        
        this.planetBodies.forEach(body => {
            this.world.removeRigidBody(body);
        });
        this.planetBodies.clear();

        planets.forEach(p => {
            const bodyDesc = RAPIER.RigidBodyDesc.fixed()
                .setTranslation(p.position.x, p.position.y);
            const body = this.world.createRigidBody(bodyDesc);
            
            const colliderDesc = RAPIER.ColliderDesc.ball(p.radiusValue);
            this.world.createCollider(colliderDesc, body);
            
            this.planetBodies.set(p.id, body);
        });
    }

    /**
     * Simulates a shot and returns the result.
     * Uses a single reusable ghost body to save allocations.
     */
    public simulateShot(
        startPos: { x: number, y: number },
        velocity: { x: number, y: number },
        planets: Planet[],
        target: { x: number, y: number },
        targetRadius: number,
        myTeamId: string,
        maxSteps: number = 300 // ~5 seconds at 60fps
    ): { hit: boolean, closestDist: number, hitFriendly: boolean } {

        // 1. Setup Ghost Body
        if (this.ghostBody) {
            this.world.removeRigidBody(this.ghostBody);
        }

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(startPos.x, startPos.y)
            .setLinvel(velocity.x, velocity.y)
            .setCcdEnabled(true); // Critical for fast projectiles
            
        this.ghostBody = this.world.createRigidBody(bodyDesc);
        
        // Match Projectile.ts collider props
        const colliderDesc = RAPIER.ColliderDesc.ball(5.0);
        colliderDesc.setRestitution(0.8);
        colliderDesc.setFriction(0.5);
        // Mass = 1.0 logic
        colliderDesc.setDensity(1.0 / (Math.PI * 25));
        
        this.world.createCollider(colliderDesc, this.ghostBody);

        let closestDist = Infinity;
        let hit = false;
        let hitFriendly = false;
        const projectileRadius = 5;

        // 2. Step Loop
        for (let i = 0; i < maxSteps; i++) {
            // A. Apply Gravity (Manual Force)
            // We replicate GravitySystem logic exactly
            const projPos = this.ghostBody.translation();

            for (const planet of planets) {
                // We use the game planets data for gravity calculation 
                // because our physics world planets are just for collision.
                // This ensures forces match exactly.
                
                const dx = planet.position.x - projPos.x;
                const dy = planet.position.y - projPos.y;
                const distSq = dx * dx + dy * dy;
                const dist = Math.sqrt(distSq);

                const mass = planet.radiusValue * 10;
                const clampedDist = Math.max(dist, planet.radiusValue * 0.3);
                const clampedDistSq = clampedDist * clampedDist;

                const forceMagnitude = (GravitySystem.G * mass) / clampedDistSq;
                
                const fx = (dx / dist) * forceMagnitude;
                const fy = (dy / dist) * forceMagnitude;

                this.ghostBody.addForce({ x: fx, y: fy }, true);
            }

            // B. Step World
            this.world.step();

            // C. Check State
            const pos = this.ghostBody.translation();
            
            // Check Target Hit (Euclidean distance for optimization)
            const tdx = target.x - pos.x;
            const tdy = target.y - pos.y;
            const tDist = Math.sqrt(tdx*tdx + tdy*tdy);
            
            if (tDist < targetRadius + projectileRadius) {
                hit = true;
                closestDist = 0;
                break;
            }
            if (tDist < closestDist) {
                closestDist = tDist;
            }

            // Check Planet Collision (using Rapier's collision detection would be better, 
            // but manual check is faster for simple "did we hit anything" without event queues)
            // Actually, querying the physics engine for contacts is clean.
            // But strict manual check is fine too and matches the "simulateShot" logic we had before.
            // Let's stick to manual check for parity with the old pure-math sim, 
            // BUT relying on Rapier for the movement. 
            // Actually, if we use Rapier, we should trust it for collisions.
            
            // For now, let's just check distance to planets manually to be extremely fast & consistent
            // with how we check targets.
            
            for (const p of planets) {
                const pdx = p.position.x - pos.x;
                const pdy = p.position.y - pos.y;
                const pDist = Math.sqrt(pdx*pdx + pdy*pdy);
                
                if (pDist < p.radiusValue + projectileRadius) {
                     // Hit a planet
                     const distToTarget = Math.sqrt((p.position.x - target.x)**2 + (p.position.y - target.y)**2);
                     if (distToTarget < 5) {
                         // Hit target planet (if we allow targeting planets directly)
                         // But usually we target turrets. 
                         // For this check, if we hit *any* planet that isn't the target location...
                         // But wait, user might be targeting a turret ON a planet.
                         
                         // If the target is basically ON this planet, it counts as a hit?
                         // The AI logic for "target" is usually a turret position.
                         
                         // Let's rely on the "tDist" check above for success.
                         // If we hit a planet and we HAVEN'T hit the target yet, 
                         // it's an obstacle hit.
                         
                         const controller = p.getControllerTeamId();
                         if (controller === myTeamId) {
                             hitFriendly = true;
                         }
                         
                         // We hit an obstacle. Stop.
                         // Since we check tDist first, if we were close enough to target, hit would be true.
                         return { hit, closestDist, hitFriendly };
                     }
                }
            }
        }

        return { hit, closestDist, hitFriendly };
    }
}
