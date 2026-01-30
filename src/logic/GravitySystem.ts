
import { Planet } from '../objects/Planet';

export interface GravityTarget {
    position: { x: number, y: number };
    applyForce(x: number, y: number): void;
    getMass(): number;
    active?: boolean;
}

export class GravitySystem {
    // Gravitational constant - Tune this for surface gravity feel
    // With Mass = R^2, Surface Force = G * R^2 / R^2 = G.
    // So G is directly the acceleration at surface (in pixels/step^2 approx).
    public static readonly G = 0.5; 
    public static readonly INFLUENCE_MULTIPLIER = 5.0;

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
                
                // Optimization: Influence Check
                const influenceDist = planet.radiusValue * GravitySystem.INFLUENCE_MULTIPLIER;
                if (distSq > influenceDist * influenceDist) continue;

                const dist = Math.sqrt(distSq);

                // Identify mass (Use Area: R^2)
                const planetMass = planet.radiusValue * planet.radiusValue;

                // F = G * (m1 * m2) / r^2
                // Clamp distance to avoid singularity
                const clampedDist = Math.max(dist, planet.radiusValue * 0.3); 
                const clampedDistSq = clampedDist * clampedDist;

                let forceMagnitude = (GravitySystem.G * planetMass) / clampedDistSq;
                
                // Scale by target mass
                forceMagnitude *= targetMass;

                // Normalize direction and apply force
                const fx = (dx / dist) * forceMagnitude;
                const fy = (dy / dist) * forceMagnitude;

                target.applyForce(fx, fy);
            }
        }
    }
}


