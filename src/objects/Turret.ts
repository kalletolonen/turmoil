import Phaser from 'phaser';
import { RapierManager } from '../physics/RapierManager';
import RAPIER from '@dimforge/rapier2d-compat';
import { ProjectileType } from './ProjectileTypes';
import { GameConfig } from '../config';

export class Turret {
    private body: RAPIER.RigidBody;
    public visual: Phaser.GameObjects.Sprite;

    public armed: boolean = false;
    public readonly id: string = Phaser.Utils.String.UUID();


    public aimVector: { x: number, y: number } | null = null;
    public projectileType: ProjectileType = ProjectileType.BASIC;
    
    public isFalling: boolean = false;

    public setFalling(falling: boolean) {
        if (this.isFalling === falling) return;
        this.isFalling = falling;
        
        if (this.body) {
            if (falling) {
                this.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
                this.body.wakeUp();
            } else {
                this.body.setBodyType(RAPIER.RigidBodyType.Fixed, true);
                this.body.setLinvel({ x: 0, y: 0 }, true);
                this.body.setAngvel(0, true);
            }
        }
    }

    public applyForce(x: number, y: number) {
        if (this.body && this.isFalling) {
            this.body.applyImpulse({ x: x * 0.016, y: y * 0.016 }, true); // Scale for time step approx
        }
    }

    public applyImpulse(x: number, y: number) {
        if (this.body && this.isFalling) {
            this.body.applyImpulse({ x: x, y: y }, true);
        }
    }

    public getMass(): number {
        if (this.body) {
            return this.body.mass();
        }
        return 100; // Default high mass if no body
    }
    
    public update() {
        if (this.body) {
            const pos = this.body.translation();
            this.visual.setPosition(pos.x, pos.y);
            this.visual.setRotation(this.body.rotation() + Math.PI / 2);
            
            // Optimization: Only update graphics if moved?
            // For falling turrets, they move every frame.
            if (this.isFalling) {
                 this.updateVisuals();
                 this.updateSelectionBracket();
            }
        }
    }

    public health: number = 100;
    public maxHealth: number = 100;
    
    public actionPoints: number = 1;
    public maxActionPoints: number = 10;
    
    private apGraphics: Phaser.GameObjects.Graphics;
    private healthText: Phaser.GameObjects.Text;

    /**
     * @param scene Phaser Scene
     * @param x World X position
     * @param y World Y position
     * @param angle Angle in radians (rotation of the turret)
     * @param width Width of the turret base
     * @param height Height of the turret (pointing outwards)
     */
    public teamId: string | null = null;

    /**
     * @param scene Phaser Scene
     * @param x World X position
     * @param y World Y position
     * @param angle Angle in radians (rotation of the turret)
     * @param width Width of the turret base
     * @param height Height of the turret (pointing outwards)
     * @param teamId Team ID
     */
    constructor(scene: Phaser.Scene, x: number, y: number, angle: number, width: number = 10, height: number = 10, teamId: string | null = null) {
        this.teamId = teamId;
        const rapierManager = RapierManager.getInstance();
        if (!rapierManager.world) {
             throw new Error("Rapier World not initialized");
        }

        // Scale Factor
        const VISUAL_SCALE_MULTIPLIER = 4.0;
        const scaledWidth = width * VISUAL_SCALE_MULTIPLIER;
        const scaledHeight = height * VISUAL_SCALE_MULTIPLIER;

        // Physics: Static body
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(x, y)
            .setRotation(angle);
            
        this.body = rapierManager.world.createRigidBody(bodyDesc);
        (this.body as any).userData = { type: 'turret', parent: this };
        
        // Hitbox: Polygon to match shape (Wide head, narrow legs)
        // Body Coords:
        // X+ is Up (Head), X- is Down (Legs)
        // Y+ is Right, Y- is Left
        
        const hw = scaledWidth / 2;
        const hh = scaledHeight / 2;
        
        // Trapezoid shape:
        // Head (Top): Full width
        // Legs (Bottom): Narrower
        const vertices = new Float32Array([
            hh, -hw,      // Head Left
            hh, hw,       // Head Right
            -hh, hw * 0.4, // Leg Right (Tapered)
            -hh, -hw * 0.4 // Leg Left (Tapered)
        ]);
        
        const colliderDesc = RAPIER.ColliderDesc.convexHull(vertices);
        if (!colliderDesc) throw new Error("Could not generate convex hull");
        colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        rapierManager.world.createCollider(colliderDesc, this.body);

        // Visual: Sprite
        let color = 0xff0000;
        if (this.teamId === 'red') color = 0xff0000;
        if (this.teamId === 'green') color = 0x00ff00;
        
        this.visual = scene.add.sprite(x, y, 'turret_sprite');
        this.visual.setTint(color); // Always team color
        this.visual.setRotation(angle + Math.PI / 2); // Legs down correction
        
        // Scale to match scaled dimensions relative to texture size
        const scaleX = scaledWidth / this.visual.width;
        const scaleY = scaledHeight / this.visual.height;
        this.visual.setScale(scaleX, scaleY);
        
        // AP Graphics (Pips)
        this.apGraphics = scene.add.graphics();
        
        // Health Text
        this.healthText = scene.add.text(x, y - 30, '100', {
            fontSize: '16px',
            color: '#00ff00',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.healthText.setOrigin(0.5);
        
        this.updateVisuals();
        
        // Interaction
        this.visual.setInteractive();
        
        // Selection Bracket
        this.selectionBracket = scene.add.graphics();
        this.selectionBracket.setDepth(100);
        this.selectionBracket.setVisible(false);
    }

    public setArmed(value: boolean, vector?: { x: number, y: number }) {
        this.armed = value;
        if (this.armed && vector) {
            this.aimVector = vector;
            // Removed: this.visual.setTint(0xffff00); // User requested always team color
        } else {
            this.aimVector = null;
            // Color restore logic is redundant if we never change it, but good to keep consistency if needed.
            // For now, we simply don't change the tint away from team color.
            this.armed = false;
        }
    }
    
    public takeDamage(amount: number): boolean {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
        this.updateVisuals();
        return this.health <= 0;
    }
    
    public addActionPoints(amount: number) {
        this.actionPoints += amount;
        if (this.actionPoints > this.maxActionPoints) {
            this.actionPoints = this.maxActionPoints;
        }
        this.updateVisuals();
    }
    
    public consumeActionPoints(amount: number): boolean {
        // Red Faction Max AP config or Debug Infinite AP bypass consumption
        if (GameConfig.DEBUG_INFINITE_AP || (GameConfig.RED_FACTION_MAX_AP && this.teamId === 'red')) {
            return true;
        }

        if (this.actionPoints >= amount) {
            this.actionPoints -= amount;
            this.updateVisuals();
            return true;
        }
        return false;
    }

    public setMaxActionPoints() {
        this.actionPoints = this.maxActionPoints;
        this.updateVisuals();
    }
    
    public updateVisuals() {
        // Safe check for visual elements
        if (!this.healthText || !this.healthText.active) return;
        if (!this.apGraphics || !this.apGraphics.active) return;
        if (!this.visual || !this.visual.active) return;

        // Update Health Text
        if (this.health <= 0) {
            this.healthText.setVisible(false);
        } else {
            this.healthText.setVisible(true);
            this.healthText.setText(Math.ceil(this.health).toString());
            this.healthText.setPosition(this.position.x, this.position.y - 30 - (this.visual.scaleY - 1) * 10);
            
            // Color based on health
            if (this.health < 30) {
                this.healthText.setColor('#ff0000');
            } else if (this.health < 60) {
                this.healthText.setColor('#ffff00');
            } else {
                this.healthText.setColor('#00ff00');
            }
            this.healthText.setDepth(101);
        }
        
        // Update AP Pips
        this.apGraphics.clear();
        if (this.health > 0) {
            this.drawAPPips();
        }
    }
        
    
    public getBounds(): Phaser.Geom.Rectangle {
        return this.visual.getBounds();
    }
    
    public get position(): { x: number, y: number } {
        if (this.body && this.body.isValid()) {
            return this.body.translation();
        }
        return { x: this.visual.x, y: this.visual.y };
    }
    
    public get rotation(): number {
        if (this.body && this.body.isValid()) {
            return this.body.rotation();
        }
        return this.visual.rotation;
    }

    private selectionBracket: Phaser.GameObjects.Graphics;
    public isSelected: boolean = false;

    public setSelected(selected: boolean) {
        this.isSelected = selected;
        this.selectionBracket.setVisible(selected);
        this.updateSelectionBracket();
    }

    private updateSelectionBracket() {
        this.selectionBracket.clear();
        if (!this.isSelected) return;

        const width = 20;
        const height = 20;
        const x = this.position.x;
        const y = this.position.y;
        const bracketSize = 8;

        this.selectionBracket.lineStyle(2, 0xffffff, 1.0);
        
        // Top Left
        this.selectionBracket.beginPath();
        this.selectionBracket.moveTo(x - width/2, y - height/2 + bracketSize);
        this.selectionBracket.lineTo(x - width/2, y - height/2);
        this.selectionBracket.lineTo(x - width/2 + bracketSize, y - height/2);
        this.selectionBracket.strokePath();

         // Top Right
        this.selectionBracket.beginPath();
        this.selectionBracket.moveTo(x + width/2 - bracketSize, y - height/2);
        this.selectionBracket.lineTo(x + width/2, y - height/2);
        this.selectionBracket.lineTo(x + width/2, y - height/2 + bracketSize);
        this.selectionBracket.strokePath();

        // Bottom Left
        this.selectionBracket.beginPath();
        this.selectionBracket.moveTo(x - width/2, y + height/2 - bracketSize);
        this.selectionBracket.lineTo(x - width/2, y + height/2);
        this.selectionBracket.lineTo(x - width/2 + bracketSize, y + height/2);
        this.selectionBracket.strokePath();

        // Bottom Right
        this.selectionBracket.beginPath();
        this.selectionBracket.moveTo(x + width/2 - bracketSize, y + height/2);
        this.selectionBracket.lineTo(x + width/2, y + height/2);
        this.selectionBracket.lineTo(x + width/2, y + height/2 - bracketSize);
        this.selectionBracket.strokePath();
    }

    private drawAPPips() {
        // Draw AP pips above health bar
        const baseWidth = 20;
        const barWidth = baseWidth * (this.maxHealth / 100);
        const pipsY = this.position.y - 20 - (this.visual.scaleY - 1) * 10; 
        const startX = this.position.x - barWidth / 2;
        
        const pipSize = 3;
        const spacing = 4;
        const maxPerRow = Math.floor(barWidth / spacing);

        for (let i = 0; i < this.maxActionPoints; i++) {
            const row = Math.floor(i / maxPerRow);
            const col = i % maxPerRow;
            
            const px = startX + col * spacing;
            const py = pipsY - (row * (pipSize + 2));
            
            // Empty pip border
            this.apGraphics.lineStyle(1, 0x888888);
            this.apGraphics.strokeRect(px, py, pipSize, pipSize);
            
            // Fill if active
            if (i < this.actionPoints) {
                this.apGraphics.fillStyle(0x00ffff); // Cyan for AP
                this.apGraphics.fillRect(px, py, pipSize, pipSize);
            }
        }
    }

    public destroy() {
        this.apGraphics.destroy();
        this.healthText.destroy();
        this.visual.destroy();
        this.selectionBracket.destroy();
        
        const rapierManager = RapierManager.getInstance();
        if (rapierManager.world && this.body) {
            rapierManager.world.removeRigidBody(this.body);
            // @ts-ignore
            this.body = null;
        }
    }
}
