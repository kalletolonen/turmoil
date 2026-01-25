import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../logic/SeededRNG';

describe('SeededRNG', () => {
    it('should produce the same sequence for the same seed', () => {
        const rng1 = new SeededRNG(12345);
        const rng2 = new SeededRNG(12345);

        const seq1 = [rng1.nextFloat(), rng1.nextFloat(), rng1.nextFloat()];
        const seq2 = [rng2.nextFloat(), rng2.nextFloat(), rng2.nextFloat()];

        expect(seq1).toEqual(seq2);
    });

    it('should produce different sequences for different seeds', () => {
        const rng1 = new SeededRNG(12345);
        const rng2 = new SeededRNG(67890);

        const val1 = rng1.nextFloat();
        const val2 = rng2.nextFloat();

        expect(val1).not.toBe(val2);
    });

    it('should generate integers within range', () => {
        const rng = new SeededRNG(12345);
        const min = 5;
        const max = 15; // Exclusive

        for (let i = 0; i < 100; i++) {
            const val = rng.nextInt(min, max);
            expect(val).toBeGreaterThanOrEqual(min);
            expect(val).toBeLessThan(max);
            expect(Number.isInteger(val)).toBe(true);
        }
    });

    it('should generate floats within range', () => {
        const rng = new SeededRNG(12345);
        const min = 1.5;
        const max = 3.5;

        for (let i = 0; i < 100; i++) {
            const val = rng.nextRange(min, max);
            expect(val).toBeGreaterThanOrEqual(min);
            expect(val).toBeLessThan(max);
        }
    });
});
