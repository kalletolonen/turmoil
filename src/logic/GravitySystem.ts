import { Projectile } from '../objects/Projectile';
import { Planet } from '../objects/Planet';

export class GravitySystem {
    // Gravitational constant - tune this for gameplay feel
    public static readonly G = 10; 

    /**
     * Applies gravitational forces from planets to projectiles.
     * @param projectiles List of active projectiles
     * @param planets List of active planets
     */
    public static applyGravity(projectiles: Projectile[], planets: Planet[]): void {
        for (const projectile of projectiles) {
            if (!projectile.active) continue;

            const projPos = projectile.position;
            
            for (const planet of planets) {
                const planetPos = planet.position;
                
                // Calculate distance vector
                const dx = planetPos.x - projPos.x;
                const dy = planetPos.y - projPos.y;
                const distSq = dx * dx + dy * dy;
                const dist = Math.sqrt(distSq);

                // Identify mass (use radius for now as proxy for mass)
                const mass = planet.radiusValue * 10; // Simple scaler

                // F = G * (m1 * m2) / r^2
                // We assume projectile mass is 1 for simplicity of force application
                // Clamp distance to avoid singularity/extreme forces at center
                const clampedDist = Math.max(dist, planet.radiusValue * 0.3); 
                const clampedDistSq = clampedDist * clampedDist;

                const forceMagnitude = (GravitySystem.G * mass) / clampedDistSq;

                // Normalize direction and apply force
                const fx = (dx / dist) * forceMagnitude;
                const fy = (dy / dist) * forceMagnitude;

                projectile.applyForce(fx, fy);
            }
        }
    }
}
