import Phaser from 'phaser';
import { RapierManager } from '../physics/RapierManager';
import RAPIER from '@dimforge/rapier2d-compat';
import { SeededRNG } from '../logic/SeededRNG';
import { Turret } from './Turret';

export class Planet {
    private body: RAPIER.RigidBody;

    private visual: Phaser.GameObjects.Arc;
    private turrets: Turret[] = [];
    private radius: number;
    private scene: Phaser.Scene;

    public teamId: string | null = null;
    public readonly id: string = Phaser.Utils.String.UUID();

    constructor(scene: Phaser.Scene, x: number, y: number, radius: number, color: number = 0x66ccff, teamId: string | null = null) {
        this.teamId = teamId;
        this.scene = scene;
        this.radius = radius;
        const rapierManager = RapierManager.getInstance();
        if (!rapierManager.world) {
             throw new Error("Rapier World not initialized");
        }

        // Physics: Static body for planets
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(x, y);
            
        this.body = rapierManager.world.createRigidBody(bodyDesc);
        // Tag the body so FleetRenderer can ignore it
        (this.body as any).userData = { type: 'planet' };
        
        const colliderDesc = RAPIER.ColliderDesc.ball(radius);
        rapierManager.world.createCollider(colliderDesc, this.body);

        // Visual: Simple circle
        this.visual = scene.add.circle(x, y, radius, color);
        // Ensure it's visually compliant (maybe add a stroke)
        this.visual.setStrokeStyle(2, 0xffffff);
    }

    destroy() {
        // Cleanup if needed (Phaser handles visual destroy on scene shutdown usually, but physics needs manual cleanup if destroyed mid-game)
        // For this task, we assume they are permanent 
    }

    spawnTurrets(rng: SeededRNG, count: number) {
        for (let i = 0; i < count; i++) {
            // Random angle
            const angle = rng.nextRange(0, Math.PI * 2);
            
            // Calculate position on surface
            // Turret height approx 10, so center it at radius + 5?
            const turretDist = this.radius + 5; 
            const tx = this.body.translation().x + Math.cos(angle) * turretDist;
            const ty = this.body.translation().y + Math.sin(angle) * turretDist;
            
            // Angle needs to be rotated so turret faces out (or in? usually out)
            // If angle is 0 (right), turret should face right. 
            // Turret visual is widthxheight. If rotation=0 means pointing right, then we are good.
            
            this.turrets.push(new Turret(this.scene, tx, ty, angle, 10, 10, this.teamId));
        }
    }

    get position(): { x: number, y: number } {
        return this.body.translation();
    }

    get radiusValue(): number {
        return this.radius;
    }
    
    get turretsList(): Turret[] {
        return this.turrets;
    }

    addTurretAtAngle(angle: number, teamId: string | null) {
        const turretDist = this.radius + 5; 
        const tx = this.body.translation().x + Math.cos(angle) * turretDist;
        const ty = this.body.translation().y + Math.sin(angle) * turretDist;
        
        const newTurret = new Turret(this.scene, tx, ty, angle, 10, 10, teamId);
        this.turrets.push(newTurret);
        return newTurret;
    }

    public getControllerTeamId(): string | null {
        if (this.turrets.length === 0) return null;
        
        const firstTeam = this.turrets[0].teamId;
        if (!firstTeam) return null; // Neutral turret implies no team control

        // Check if all turrets have the same team ID
        for (let i = 1; i < this.turrets.length; i++) {
            if (this.turrets[i].teamId !== firstTeam) {
                return null;
            }
        }
        
        return firstTeam;
    }
}
