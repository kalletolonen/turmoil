import Phaser from 'phaser';
import { RapierManager } from '../physics/RapierManager';
import RAPIER from '@dimforge/rapier2d-compat';
import { INTERACTION_DEBRIS } from '../physics/PhysicsGroups';

export class FXManager {
    private static instance: FXManager;
    private scene: Phaser.Scene;
    private debris: { body: RAPIER.RigidBody, visual: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, life: number }[] = [];
    
    private constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public static getInstance(): FXManager {
        if (!FXManager.instance) {
            throw new Error("FXManager not initialized. Call init() first.");
        }
        return FXManager.instance;
    }

    public static init(scene: Phaser.Scene) {
        FXManager.instance = new FXManager(scene);
    }

    public update(delta: number) {
        // Update debris
        const rapierManager = RapierManager.getInstance();
        if (!rapierManager.world) return;

        for (let i = this.debris.length - 1; i >= 0; i--) {
            const d = this.debris[i];
            d.life -= delta;

            if (d.life <= 0) {
                // Destroy
                if (rapierManager.world.getRigidBody(d.body.handle)) {
                     rapierManager.world.removeRigidBody(d.body);
                }
                d.visual.destroy();
                this.debris.splice(i, 1);
            } else {
                // Sync visual
                const pos = d.body.translation();
                const rot = d.body.rotation();
                d.visual.setPosition(pos.x, pos.y);
                d.visual.setRotation(rot);
                
                // Fade out
                if (d.life < 1000) {
                    d.visual.setAlpha(d.life / 1000);
                }
            }
        }
    }

    public createExplosion(x: number, y: number, color: number, size: number = 20) {
        // Subtle/Distinctive: Expanding Ring Shockwave (Hollow)
        const graphics = this.scene.add.graphics({ x, y });
        
        // Draw circle at 0,0 (local to graphics)
        // We'll scale the graphics object itself
        const thickness = 2;
        graphics.lineStyle(thickness, color);
        graphics.strokeCircle(0, 0, size / 2); // Base size
        
        graphics.setScale(0.1); // Start small
        graphics.setAlpha(1);

        this.scene.tweens.add({
            targets: graphics,
            scale: 2.0, // Expand to 2x size
            alpha: 0,   // Fade out
            duration: 400,
            ease: 'Quad.out',
            onComplete: () => graphics.destroy()
        });
        
        // Optional: Small central point that vanishes quickly
        const center = this.scene.add.image(x, y, 'particle');
        center.setTint(color);
        center.setScale(0.2);
        this.scene.tweens.add({
            targets: center,
            scale: 0,
            duration: 150,
            onComplete: () => center.destroy()
        });
    }

    public createDebrisBurst(x: number, y: number, color: number, count: number = 5) {
        const rapierManager = RapierManager.getInstance();
        if (!rapierManager.world) return;
        
        // Limit max debris to prevent lag
        if (this.debris.length > 100) return;

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 50 + 20; // Random speed
            const size = Math.random() * 3 + 2;

            // Physics Body
            const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(x, y)
                .setLinvel(Math.cos(angle) * speed, Math.sin(angle) * speed)
                .setAngularDamping(0.5);
            
            const body = rapierManager.world.createRigidBody(bodyDesc);
            
            const colliderDesc = RAPIER.ColliderDesc.cuboid(size / 2, size / 2)
                 .setDensity(0.5)
                 .setRestitution(0.5) // Bouncy
                 .setCollisionGroups(INTERACTION_DEBRIS);
            
            rapierManager.world.createCollider(colliderDesc, body);
            
            // Visual
            const visual = this.scene.add.image(x, y, 'particle'); // reusing particle as unknown shape
            visual.setTint(color); 
            visual.setDisplaySize(size, size);
            
            this.debris.push({
                body: body,
                visual: visual,
                life: 3000 + Math.random() * 2000 // 3-5 seconds life
            });
        }
    }

    public createThrustEffect(x: number, y: number, angle: number) {
         // Create a small burst of particles opposite to the movement direction
         // Visual only, no physics body needed for thrust particles typically
         const particleCount = 3;
         // Thrust is opposite to movement, but here we just pass angle of velocity probably?
         // If angle is the direction of travel, throw particles in opposite: angle + PI
         const thrustAngle = angle + Math.PI;

         for (let i = 0; i < particleCount; i++) {
             const spread = (Math.random() - 0.5) * 0.5; // +/- 0.25 rad spread
             const pAngle = thrustAngle + spread;
             // const speed = Math.random() * 20 + 10;
             
             // Visual Thrust (Sprite)
             const p = this.scene.add.image(x, y, 'particle');
             p.setTint(0xffaa00);
             p.setScale(0.5); // Start small (8 * 0.5 = 4px)
             
             this.scene.tweens.add({
                 targets: p,
                 x: x + Math.cos(pAngle) * 30,
                 y: y + Math.sin(pAngle) * 30,
                 alpha: 0,
                 scale: 0.1,
                 duration: 200 + Math.random() * 100,
                 onComplete: () => p.destroy()
             });
         }
    }
    
    public showFloatingText(x: number, y: number, text: string, color: string) {
        const floatingText = this.scene.add.text(x, y, text, {
            fontSize: '16px',
            color: color,
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });
        floatingText.setOrigin(0.5, 0.5);
        floatingText.setDepth(3000); // Ensure it's above everything

        this.scene.tweens.add({
            targets: floatingText,
            y: y - 40, // Move up
            alpha: 0,
            duration: 1500,
            ease: 'Power1',
            onComplete: () => floatingText.destroy()
        });
    }

    public clear() {
        const rapierManager = RapierManager.getInstance();
        if (!rapierManager.world) return;

        this.debris.forEach(d => {
            if (rapierManager.world!.getRigidBody(d.body.handle)) {
                 rapierManager.world!.removeRigidBody(d.body);
            }
            d.visual.destroy();
        });
        this.debris = [];
    }
}
