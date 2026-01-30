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
        const cells: { x: number, y: number, width: number, height: number }[] = [];

        // Grid-based Candidate Generation
        const cols = Math.ceil(Math.sqrt(config.planetCount * 1.5));
        const rows = Math.ceil(config.planetCount * 1.5 / cols);
        
        const cellW = config.width / cols;
        const cellH = config.height / rows;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                cells.push({
                    x: c * cellW,
                    y: r * cellH,
                    width: cellW,
                    height: cellH
                });
            }
        }

        // Shuffle cells
        rng.shuffle(cells);

        // Pick needed count
        const selectedCells = cells.slice(0, config.planetCount);

        for (const cell of selectedCells) {
            const radius = rng.nextRange(config.minPlanetRadius, config.maxPlanetRadius);
            
            const safePadding = config.padding / 2;
            const minX = cell.x + radius + safePadding;
            const maxX = cell.x + cell.width - radius - safePadding;
            const minY = cell.y + radius + safePadding;
            const maxY = cell.y + cell.height - radius - safePadding;

            let x, y;
            if (minX >= maxX) x = cell.x + cell.width / 2;
            else x = rng.nextRange(minX, maxX);

            if (minY >= maxY) y = cell.y + cell.height / 2;
            else y = rng.nextRange(minY, maxY);
            
            // Determine Team & Properties
            const isNaturalNeutral = rng.nextFloat() < 0.3;
            let teamId: string | null = null;
            let color = 0x888888;
            let turretCount = 0;

            if (!isNaturalNeutral) {
                if (x < config.width / 2) {
                    teamId = 'red';
                } else {
                    teamId = 'green';
                }
                turretCount = rng.nextInt(2, 6);
            } else {
                color = 0x666666;
            }

            const seed = rng.nextInt(0, 1000000);

            planets.push({
                x, y, radius, color, teamId, turretCount, seed
            });
        }

        return { planets };
    }
}
