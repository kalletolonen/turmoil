import { MapGenerator, MapConfig } from '../logic/MapGenerator';
import { SeededRNG } from '../logic/SeededRNG';

describe('MapGenerator', () => {
    const defaultConfig: MapConfig = {
        width: 800,
        height: 600,
        planetCount: 6,
        minPlanetRadius: 25,
        maxPlanetRadius: 70,
        padding: 50
    };

    it('should generate reproducible maps with the same seed', () => {
        const seed = 12345;
        const rng1 = new SeededRNG(seed);
        const mapGen1 = new MapGenerator();
        const map1 = mapGen1.generate(defaultConfig, rng1);

        const rng2 = new SeededRNG(seed);
        const mapGen2 = new MapGenerator();
        const map2 = mapGen2.generate(defaultConfig, rng2);

        expect(map1).toEqual(map2);
    });

    it('should generate different maps with different seeds', () => {
        const rng1 = new SeededRNG(11111);
        const mapGen1 = new MapGenerator();
        const map1 = mapGen1.generate(defaultConfig, rng1);

        const rng2 = new SeededRNG(22222);
        const mapGen2 = new MapGenerator();
        const map2 = mapGen2.generate(defaultConfig, rng2);

        // It is extremely unlikely to match exactly in positions and sizes
        expect(map1).not.toEqual(map2);
    });

    it('should respect planet count config', () => {
        const rng = new SeededRNG(12345);
        const mapGen = new MapGenerator();
        const config = { ...defaultConfig, planetCount: 10 };
        const map = mapGen.generate(config, rng);

        expect(map.planets.length).toBe(10);
    });

    it('should scale efficiently', () => {
        const rng = new SeededRNG(12345);
        const mapGen = new MapGenerator();
        const config = { 
            ...defaultConfig, 
            width: 20000, 
            height: 20000, 
            planetCount: 1000 
        };
        
        const start = performance.now();
        const map = mapGen.generate(config, rng);
        const end = performance.now();

        expect(map.planets.length).toBe(1000);
        expect(end - start).toBeLessThan(100); // Should be very fast (<100ms)
    });

    it('should ensure existence of both red and green factions', () => {
        const rng = new SeededRNG(12345);
        const mapGen = new MapGenerator();
        const map = mapGen.generate(defaultConfig, rng);

        const redPlanets = map.planets.filter(p => p.teamId === 'red');
        const greenPlanets = map.planets.filter(p => p.teamId === 'green');

        expect(redPlanets.length).toBeGreaterThan(0);
        expect(greenPlanets.length).toBeGreaterThan(0);
    });
});
