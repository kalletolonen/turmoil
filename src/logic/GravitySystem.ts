
import { Planet } from '../objects/Planet';

export interface GravityTarget {
    position: { x: number, y: number };
    applyForce(x: number, y: number): void;
    getMass(): number;
    active?: boolean;
}

export class GravitySystem {
    // Gravitational constant - tune this for gameplay feel
    public static readonly G = 10; 

    /**
     * Applies gravitational forces from planets to targets (Projectiles, Turrets).
     * @param targets List of active physics objects
     * @param planets List of active planets
     */
    public static applyGravity(targets: GravityTarget[], planets: Planet[]): void {
        for (const target of targets) {
            if (target.active === false) continue; // Explicit check for false, undefined is fine

            const targetPos = target.position;
            const targetMass = target.getMass();
            
            for (const planet of planets) {
                const planetPos = planet.position;
                
                // Calculate distance vector
                const dx = planetPos.x - targetPos.x;
                const dy = planetPos.y - targetPos.y;
                const distSq = dx * dx + dy * dy;
                const dist = Math.sqrt(distSq);

                // Identify mass (use radius for now as proxy for mass)
                const planetMass = planet.radiusValue * 10; // Simple scaler

                // F = G * (m1 * m2) / r^2
                // We assume target mass is 1 for simplicity of force application
                // Clamp distance to avoid singularity/extreme forces at center
                const clampedDist = Math.max(dist, planet.radiusValue * 0.3); 
                const clampedDistSq = clampedDist * clampedDist;

                let forceMagnitude = (GravitySystem.G * planetMass) / clampedDistSq;
                
                // Scale by target mass so heavy objects fall at same speed (F = ma => a = F/m => we want constant a, so F must scale by m)
                forceMagnitude *= targetMass;

                // Normalize direction and apply force
                const fx = (dx / dist) * forceMagnitude;
                const fy = (dy / dist) * forceMagnitude;

                target.applyForce(fx, fy);
            }
        }
    }
}


