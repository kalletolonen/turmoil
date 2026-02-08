import { SeededRNG } from './SeededRNG';

export interface MapConfig {
    width: number;
    height: number;
    planetCount: number;
    minPlanetRadius: number;
    maxPlanetRadius: number;
    padding: number;
}

export interface PlanetData {
    x: number;
    y: number;
    radius: number;
    color: number;
    teamId: string | null;
    turretCount: number;
    seed: number;
}

export interface MapData {
    planets: PlanetData[];
}

export class MapGenerator {
    
    public generate(config: MapConfig, rng: SeededRNG): MapData {
        const planets: PlanetData[] = [];
        const MAX_ATTEMPTS = 50;

        for (let i = 0; i < config.planetCount; i++) {
            let placed = false;
            let attempts = 0;

            while (!placed && attempts < MAX_ATTEMPTS) {
                attempts++;
                
                const radius = rng.nextRange(config.minPlanetRadius, config.maxPlanetRadius);
                
                // Random position within bounds, respecting padding/radius
                // Let's use radius + small margin from edge, say 50px
                const edgeBuffer = radius + 50; 
                
                const minX = edgeBuffer;
                const maxX = config.width - edgeBuffer;
                const minY = edgeBuffer;
                const maxY = config.height - edgeBuffer;

                if (minX >= maxX || minY >= maxY) {
                     // Config error or map too small
                     console.warn("Map too small for planet size configuration");
                     continue; 
                }

                const x = rng.nextRange(minX, maxX);
                const y = rng.nextRange(minY, maxY);

                // Check Overlap
                let overlap = false;
                for (const existing of planets) {
                    const dist = Math.sqrt(Math.pow(x - existing.x, 2) + Math.pow(y - existing.y, 2));
                    const requiredDist = radius + existing.radius + config.padding;
                    
                    if (dist < requiredDist) {
                        overlap = true;
                        break;
                    }
                }

                if (!overlap) {
                    // Valid Position
                    // Determine Team & Properties (Initially neutral, assigned later)
                    const seed = rng.nextInt(0, 1000000);
                    const color = 0x888888; // Default color

                    planets.push({
                        x, y, radius, color, teamId: null, turretCount: 0, seed
                    });
                    placed = true;
                }
            }
            
            if (!placed) {
                console.warn(`Could not find space for planet ${i} after ${MAX_ATTEMPTS} attempts`);
            }
        }

        // 2. Assign Teams (Guaranteed Distribution)
        // Sort by X coordinate
        planets.sort((a, b) => a.x - b.x);

        // Ensure at least 1 planet per team
        // Strategy: First 2 -> Red, Last 2 -> Green, Middle -> Random/Neutral
        
        if (planets.length >= 2) {
             // Leftmost -> Red
             planets[0].teamId = 'red';
             // Rightmost -> Green
             planets[planets.length - 1].teamId = 'green';
             
             // If we have more planets, assign more
             if (planets.length >= 4) {
                 planets[1].teamId = 'red';
                 planets[planets.length - 2].teamId = 'green';
             }
             
             // Neutralize the rest or Random
             // The middle ones remain null (neutral) or can be assigned random props
             for (let i = 0; i < planets.length; i++) {
                 const p = planets[i];
                 if (!p.teamId) {
                     // Randomly decide if it's a neutral flavored planet
                     const isNaturalNeutral = rng.nextFloat() < 0.3;
                     if (isNaturalNeutral) {
                         p.color = 0x666666;
                     }
                 }
             }
        } else {
             // Fallback for very low planet count (< 2 ??)
             console.warn("Not enough planets for team assignment!");
        }

        // Distribute exactly 3 turrets per team
        const distributeTurrets = (team: string, count: number) => {
            const teamPlanets = planets.filter(p => p.teamId === team);
            if (teamPlanets.length === 0) return;

            for (let i = 0; i < count; i++) {
                const p = teamPlanets[rng.nextInt(0, teamPlanets.length)];
                p.turretCount++;
            }
        };

        distributeTurrets('red', 3);
        distributeTurrets('green', 3);

        return { planets };
    }
}
