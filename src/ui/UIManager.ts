import Phaser from 'phaser';
import { MainScene } from '../scenes/MainScene';
import { ProjectileType, PROJECTILE_DATA } from '../objects/ProjectileTypes';

import { TurnPhase } from '../logic/TurnManager';

export class UIManager {
    private scene: MainScene;
    private weaponUIContainer: Phaser.GameObjects.Container | null = null;

    constructor(scene: MainScene) {
        this.scene = scene;
    }

    public createWeaponSelectionUI() {
        // Create a container for the bottom UI
        const width = this.scene.scale.width;
        const height = 120;
        const y = this.scene.scale.height - height;
        
        this.weaponUIContainer = this.scene.add.container(0, y);
        this.weaponUIContainer.setScrollFactor(0);
        this.weaponUIContainer.setDepth(2000);
        
        // Background (Sprite)
        const bg = this.scene.add.image(width/2, height/2, 'white_1x1');
        bg.setDisplaySize(width, height);
        bg.setTint(0x222222);
        bg.setAlpha(0.9);
        this.weaponUIContainer.add(bg);
        
        const types = [ProjectileType.BASIC, ProjectileType.GIGA_BLASTER, ProjectileType.COLONIZER, ProjectileType.RADAR, ProjectileType.DEFENDER];
        const spacing = 150;
        const startX = width / 2 - ((types.length - 1) * spacing) / 2;
        
        types.forEach((type, i) => {
            const stats = PROJECTILE_DATA[type];
            
            const boxX = startX + i * spacing;
            const boxY = height / 2;
            
            // Button Background
            const button = this.scene.add.image(boxX, boxY, 'white_1x1');
            button.setDisplaySize(140, 100);
            button.setTint(0x444444);
            button.setInteractive({ useHandCursor: true });
            button.setName(`btn_${type}`); // Identify for update
            button.setData('isUI', true);
            
            // Click Handler
            button.on('pointerdown', () => {
                if (this.scene.selectedTurret && this.scene.turnManager.currentPhase === TurnPhase.PLANNING) {
                    this.handleWeaponChange(type);
                }
            });
            
            this.weaponUIContainer?.add(button);
            
            // Icon/Color
            const icon = this.scene.add.image(boxX, boxY - 20, 'particle');
            icon.setTint(stats.color);
            icon.setDisplaySize(20, 20); // Radius 10 -> diam 20
            this.weaponUIContainer?.add(icon);
            
            // Text
            const nameText = this.scene.add.text(boxX, boxY, stats.name, { fontSize: '14px', color: '#fff' }).setOrigin(0.5, 0);
            const costText = this.scene.add.text(boxX, boxY + 20, `Cost: ${stats.cost}`, { fontSize: '12px', color: '#aaa' }).setOrigin(0.5, 0);
            
            this.weaponUIContainer?.add(nameText);
            this.weaponUIContainer?.add(costText);
        });
        
        this.weaponUIContainer.setVisible(false);
    }

    public updateWeaponSelectionUI() {
        if (!this.weaponUIContainer) return;
        
        if (!this.scene.selectedTurret) {
            this.weaponUIContainer.setVisible(false);
            return;
        }
        
        // Only show for player owned turrets
        const team = this.scene.teamManager.getTeam(this.scene.selectedTurret.teamId!);
        if (team && team.isAI) {
             this.weaponUIContainer.setVisible(false);
             return;
        }
 
        this.weaponUIContainer.setVisible(true);
        
        const types = [ProjectileType.BASIC, ProjectileType.GIGA_BLASTER, ProjectileType.COLONIZER, ProjectileType.RADAR, ProjectileType.DEFENDER];
        
        types.forEach(type => {
            const button = this.weaponUIContainer?.getByName(`btn_${type}`) as Phaser.GameObjects.Image;
            if (button) {
                const stats = PROJECTILE_DATA[type];
                const isSelected = this.scene.selectedTurret?.projectileType === type;
                
                // Highlight selection
                if (isSelected) {
                     // button.setStrokeStyle(3, 0x4444ff); // Blue selection (Image doesn't support stroke)
                     // Use Tint to show selection 
                     button.setTint(0x4444ff);
                } else {
                     button.setTint(0x444444);
                }
                
                // Check affordability
                // If already owned, cost is 0 (refund logic handled on switch)
                let affordable = true;
                if (!isSelected) {
                     // Calculate buying power
                     let currentReserved = 0;
                     if (this.scene.selectedTurret?.projectileType === ProjectileType.RADAR) {
                         // Radar cost is sunken. Buying power is just current AP.
                         currentReserved = 0; 
                     } else {
                         // Normal weapon: If armed, we get refund.
                         currentReserved = this.scene.selectedTurret?.armed ? PROJECTILE_DATA[this.scene.selectedTurret.projectileType].cost : 0;
                     }

                     const buyingPower = this.scene.selectedTurret!.actionPoints + currentReserved;
                     if (buyingPower < stats.cost) {
                         affordable = false;
                     }
                }
                
                button.setAlpha(affordable ? 1 : 0.1); // Darker when disabled
                if (affordable) {
                    button.setInteractive();
                } else {
                    button.disableInteractive();
                    button.setTint(0x550000); // Reddish for disabled
                    // button.setStrokeStyle(2, 0xff0000); // Red stroke for disabled (unsupported)
                }
            }
        });
    }

    private handleWeaponChange(newType: ProjectileType) {
        if (!this.scene.selectedTurret) return;
        const team = this.scene.teamManager.getTeam(this.scene.selectedTurret.teamId!);
        if (!team) return;
  
        const currentStats = PROJECTILE_DATA[this.scene.selectedTurret.projectileType];
        const newStats = PROJECTILE_DATA[newType];
        
        if (this.scene.selectedTurret.projectileType === newType) return;
        
        const turret = this.scene.selectedTurret;
        
        // 1. Save AIM state
        const wasArmed = turret.armed;
        const savedVector = turret.aimVector;

        // 2. Refund Logic (if Armed)
        if (turret.projectileType !== ProjectileType.RADAR) {
             if (wasArmed) {
                  turret.addActionPoints(currentStats.cost);
                  turret.setArmed(false);
             }
        }
        
        // 3. Switch Type
        turret.projectileType = newType;
        
        // 4. Re-Arm Logic (Try to restore aim)
        if (newType === ProjectileType.RADAR) {
             if (turret.actionPoints >= newStats.cost) {
                 turret.consumeActionPoints(newStats.cost);
             } else {
                 console.log("Not enough AP for Radar after switch");
             }
        } else {
             // Normal Weapon: Check if we can afford to re-arm with saved vector
             if (wasArmed && savedVector) {
                 if (turret.actionPoints >= newStats.cost) {
                     turret.consumeActionPoints(newStats.cost);
                     turret.setArmed(true, savedVector);
                 } else {
                     console.log("Not enough AP to maintain shot with new weapon");
                 }
             }
        }
        
        // Visual update
        this.updateWeaponSelectionUI();
    }

    public createDebugUI() {
        if (!this.scene.isDevMode) return;

        const x = 10;
        const y = 80;
        
        const container = this.scene.add.container(x, y);
        container.setScrollFactor(0);
        container.setDepth(2000); // Above other UI?

        const bg = this.scene.add.image(0, 0, 'white_1x1');
        bg.setDisplaySize(150, 40);
        bg.setTint(0x000000);
        bg.setAlpha(0.5);
        bg.setOrigin(0);
        container.add(bg);

        const text = this.scene.add.text(10, 10, 'Toggle AI Traj (OFF)', { fontSize: '12px', color: '#ffffff' });
        container.add(text);

        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
             this.scene.showAITrajectories = !this.scene.showAITrajectories;
             text.setText(`Toggle AI Traj (${this.scene.showAITrajectories ? 'ON' : 'OFF'})`);
             text.setColor(this.scene.showAITrajectories ? '#00ff00' : '#ffffff');
        });

        // Max AP Toggle
        const maxApBg = this.scene.add.image(0, 50, 'white_1x1');
        maxApBg.setDisplaySize(150, 40);
        maxApBg.setTint(0x000000);
        maxApBg.setAlpha(0.5);
        maxApBg.setOrigin(0);
        container.add(maxApBg);
        
        const maxApText = this.scene.add.text(10, 60, 'Max AP (Selected)', { fontSize: '12px', color: '#ffffff' });
        container.add(maxApText);
        
        maxApBg.setInteractive({ useHandCursor: true });
        maxApBg.on('pointerdown', () => {
             if (this.scene.selectedTurret) {
                 // Set high AP, ignoring clamp? 
                 // Turret.addActionPoints clamps to max.
                 // We might need to force it or temporarily increase max?
                 // Let's force it directly if property is public? It is public (implied).
                 // Wait, addActionPoints implementation:
                 // "if (this.actionPoints > this.maxActionPoints) this.actionPoints = this.maxActionPoints;"
                 // So we need to increase max first? Or just set it and assume no update checks it immediately?
                 // Or just set maxActionPoints to 10 too?
                 this.scene.selectedTurret.maxActionPoints = 10; 
                 this.scene.selectedTurret.actionPoints = 10;
                 this.scene.selectedTurret.updateHealthBar(); // Visual update
                 console.log("Maxed AP for selected turret");
             }
        });
    }
}
