import Phaser from 'phaser';
import { MainScene } from '../scenes/MainScene';
import { Turret } from '../objects/Turret';
import { TurnPhase } from '../logic/TurnManager';
import { PROJECTILE_DATA } from '../objects/ProjectileTypes';
import { GameConfig } from '../config';

export class InputManager {
    private scene: MainScene;
    
    public draggingTurret: Turret | null = null;
    public dragStartPos: Phaser.Math.Vector2 | null = null;
    public dragCurrentPos: Phaser.Math.Vector2 | null = null;
    
    private readonly DRAG_SPEED_SCALE = 2.0;

    constructor(scene: MainScene) {
        this.scene = scene;
    }

    public handleInput() {
        // Confirm Turn
        this.scene.input.keyboard?.on('keydown-SPACE', () => {
             if (this.scene.turnManager.currentPhase === TurnPhase.PLANNING) {
                 this.scene.planets.forEach(p => {
                     p.turretsList.forEach(t => {
                         if (t.armed) {
                             t.consumeActionPoints(1);
                         }
                     });
                 });
     
                 this.scene.turnManager.commitTurn();
                 this.scene.fireProjectiles();
             }
         });
         
         // Drag Logic
         this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
             // Check if we clicked UI
             const clickedUI = currentlyOver.some(obj => obj.getData('isUI'));
             if (clickedUI) return;

             if (this.scene.turnManager.currentPhase !== TurnPhase.PLANNING) return;
             
             let clickedTurret: Turret | null = null;
             for (const p of this.scene.planets) {
                 for (const t of p.turretsList) {
                     const bounds = t.getBounds();
                     if (bounds.contains(pointer.worldX, pointer.worldY)) {
                         clickedTurret = t;
                         break;
                     }
                 }
                 if (clickedTurret) break;
             }
             
             if (clickedTurret) {
                 // Selection Logic
                 if (this.scene.selectedTurret && this.scene.selectedTurret !== clickedTurret) {
                     this.scene.selectedTurret.setSelected(false);
                 }
                 this.scene.selectedTurret = clickedTurret;
                 this.scene.selectedTurret.setSelected(true);
                 this.scene.uiManager.updateWeaponSelectionUI();
     
                 // Prevent controlling AI turrets
                 const team = this.scene.teamManager.getTeam(clickedTurret.teamId!);
                 if (team && team.isAI) return;
     
                 // Check AP
                 // If already armed, we allow drag (re-aiming). 
                 // If not armed, need at least 1 AP to arm.
                 if (!clickedTurret.armed && clickedTurret.actionPoints < 1) {
                      console.log("Not enough AP");
                      return;
                 }
     
                 this.draggingTurret = clickedTurret;
                 this.dragStartPos = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
                 this.dragCurrentPos = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
                 
                 // Refund if already armed
                 if (clickedTurret.armed) {
                      const stats = PROJECTILE_DATA[clickedTurret.projectileType];
                      clickedTurret.addActionPoints(stats.cost);
                 }
                 clickedTurret.setArmed(false);
             } else {
                  if (this.scene.selectedTurret) {
                      this.scene.selectedTurret.setSelected(false);
                      this.scene.selectedTurret = null;
                      this.scene.uiManager.updateWeaponSelectionUI();
                  }
             }
         });
     
         this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
             if (this.draggingTurret) {
                 this.dragCurrentPos?.set(pointer.worldX, pointer.worldY);
             }
         });
     
         this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
             if (this.draggingTurret && this.dragStartPos && this.dragCurrentPos) {
                 const start = this.draggingTurret.position;
                 const end = { x: pointer.worldX, y: pointer.worldY };
                 
                 const dx = start.x - end.x;
                 const dy = start.y - end.y;
                 const len = Math.sqrt(dx*dx + dy*dy);
     
                 if (len > 10) { 
                      const stats = PROJECTILE_DATA[this.draggingTurret.projectileType];
                      const cost = stats.cost;
     
                      if (this.draggingTurret.armed) {
                          // Should not happen with new refund logic in pointerdown, but for safety:
                          const vx = dx * this.DRAG_SPEED_SCALE;
                          const vy = dy * this.DRAG_SPEED_SCALE;
                          
                          let finalVx = vx;
                          let finalVy = vy;
                          
                            const currentSpeed = Math.sqrt(vx*vx + vy*vy);
                          if (currentSpeed > GameConfig.MAX_PROJECTILE_SPEED) {
                              const scale = GameConfig.MAX_PROJECTILE_SPEED / currentSpeed;
                              finalVx *= scale;
                              finalVy *= scale;
                          }
     
                          this.draggingTurret.setArmed(true, { x: finalVx, y: finalVy });
                      } else {
                          // Try to arm
                          if (this.draggingTurret.actionPoints >= cost) {
                              this.draggingTurret.consumeActionPoints(cost);
                              
                              const vx = dx * this.DRAG_SPEED_SCALE;
                              const vy = dy * this.DRAG_SPEED_SCALE;
                              
                              let finalVx = vx;
                              let finalVy = vy;
     
                              const currentSpeed = Math.sqrt(vx*vx + vy*vy);
                              if (currentSpeed > this.MAX_PROJECTILE_SPEED) {
                                  const scale = this.MAX_PROJECTILE_SPEED / currentSpeed;
                                  finalVx *= scale;
                                  finalVy *= scale;
                              }
     
                              this.draggingTurret.setArmed(true, { x: finalVx, y: finalVy });
                          } else {
                              console.log("Not enough energy!");
                              this.scene.tweens.add({
                                  targets: this.draggingTurret.visual,
                                  alpha: 0.5,
                                  yoyo: true,
                                  duration: 100,
                                  repeat: 3
                              });
                              this.draggingTurret.setArmed(false);
                          }
                      }
                 } else {
                      if (this.draggingTurret.armed) {
                          // Refund AP
                          const stats = PROJECTILE_DATA[this.draggingTurret.projectileType];
                          this.draggingTurret.addActionPoints(stats.cost);
                      }
                      this.draggingTurret.setArmed(false);
                 }
                 
                 this.draggingTurret = null;
                 this.dragStartPos = null;
                 this.dragCurrentPos = null;
             }
         });
    }
}
