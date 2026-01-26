declare module 'polybooljs' {
    export interface Polygon {
        regions: number[][][];
        inverted: boolean;
    }

    export interface BuildLog {
        // ... incomplete but sufficient for now
    }

    export function polygonFromGeoJSON(geojson: any): Polygon;
    export function polygonToGeoJSON(poly: Polygon): any;

    export function selectUnion(polys: Polygon[]): Polygon;
    export function selectIntersect(polys: Polygon[]): Polygon;
    export function selectDifference(polys: Polygon[]): Polygon;
    export function selectXor(polys: Polygon[]): Polygon;

    export function union(poly1: Polygon, poly2: Polygon): Polygon;
    export function intersect(poly1: Polygon, poly2: Polygon): Polygon;
    export function difference(poly1: Polygon, poly2: Polygon): Polygon;
    export function differenceRev(poly1: Polygon, poly2: Polygon): Polygon;
    export function xor(poly1: Polygon, poly2: Polygon): Polygon;

    // Helper functions often present in basic usage
    // Polybooljs usually works with { regions: number[][][], inverted: boolean }
    // A single region is [ [x,y], [x,y], ... ]
}
