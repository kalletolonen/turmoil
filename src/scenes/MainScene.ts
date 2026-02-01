import Phaser from 'phaser';
import { RapierManager } from '../physics/RapierManager';
import gigaBlasterIcon from '../objects/graphics/weapons/giga_blaster.jpg';
import colonizerIcon from '../objects/graphics/weapons/colonizer.jpg';
import basicIcon from '../objects/graphics/weapons/basic.jpg';
import defenderIcon from '../objects/graphics/weapons/defender.jpg';
import radarIcon from '../objects/graphics/weapons/radar.jpg';
import turretSprite from '../objects/graphics/weapons/turret.png';
import { TurnManager, TurnPhase } from '../logic/TurnManager';
// import { FleetRenderer } from '../renderer/FleetRenderer';
import { SeededRNG } from '../logic/SeededRNG';
import { Planet } from '../objects/Planet';
// import { Debris } from '../objects/Debris';
import { Projectile } from '../objects/Projectile';
import { Turret } from '../objects/Turret';
import { ProjectileType } from '../objects/ProjectileTypes';
import { GravitySystem } from '../logic/GravitySystem';
import { TeamManager } from '../logic/TeamManager';
import { AIManager } from '../logic/AIManager';
import { UIManager } from '../ui/UIManager';
import { InputManager } from '../input/InputManager';
import { TrajectorySystem } from '../logic/TrajectorySystem';
import { FXManager } from '../logic/FXManager';
import { GameConfig } from '../config';
import { MapGenerator } from '../logic/MapGenerator';
import { TextureGenerator } from '../renderer/TextureGenerator';
import { CombatManager } from '../logic/CombatManager';
import { CollisionManager } from '../logic/CollisionManager';

export class MainScene extends Phaser.Scene {
  public rapierManager: RapierManager;
  public teamManager: TeamManager;
  public aiManager: AIManager;
  public turnManager: TurnManager;
  // private fleetRenderer!: FleetRenderer; 
  private rng: SeededRNG;
  public planets: Planet[] = [];
  // private debris: Debris[] = [];
  private initialized = false;
  private graphics!: Phaser.GameObjects.Graphics;
  private projectiles: Projectile[] = [];
  private playBounds: Phaser.Geom.Rectangle = new Phaser.Geom.Rectangle(0, 0, GameConfig.MAP_WIDTH, GameConfig.MAP_HEIGHT);
  
  
  public selectedTurret: Turret | null = null;
  
  public isDevMode: boolean = true;
  public showAITrajectories: boolean = false;
  
  
  public uiManager!: UIManager;
  public inputManager!: InputManager;
  public trajectorySystem!: TrajectorySystem;
  public combatManager!: CombatManager;
  public collisionManager!: CollisionManager;

  constructor() {
    super('MainScene');
    this.rapierManager = RapierManager.getInstance();
    this.teamManager = new TeamManager();
    this.aiManager = new AIManager();
    this.turnManager = new TurnManager();
    // Default RNG - will be overwritten in init
    this.rng = new SeededRNG(GameConfig.SEED);
  }

  init(data: { isMenuBackground?: boolean; seed?: number }) {
    this.isMenuBackground = data.isMenuBackground || false;
    const seed = data.seed !== undefined ? data.seed : GameConfig.SEED;
    this.rng = new SeededRNG(seed);
    
    // Clear State
    this.planets = [];
    this.projectiles = [];
    this.selectedTurret = null;
    this.teamManager.reset(); // Clear old teams
    
    console.log(`Initializing MainScene. Background: ${this.isMenuBackground}, Seed: ${seed}`);
  }

  public isMenuBackground: boolean = false;

  preload() {
    // Assets would go here
    this.load.image('icon_giga_blaster', gigaBlasterIcon);
    this.load.image('icon_colonizer', colonizerIcon);
    this.load.image('icon_basic', basicIcon);
    this.load.image('icon_defender', defenderIcon);
    this.load.image('icon_radar', radarIcon);
    this.load.image('turret_sprite', turretSprite);
  }

  async create() {
    // 1. Init Physics
    await this.rapierManager.init();
    
    // Always reset physics world to clear old bodies from previous scenes
    this.rapierManager.reset();
    
    // Fix for Android Touch Action (Scroll blocking)
    this.game.canvas.style.touchAction = 'none';
    
    // Enable Multi-touch (Add 2 extra pointers for total 3, just to be safe)
    this.input.addPointer(2);
    
    // 2. Setup Managers
    this.combatManager = new CombatManager();
    this.collisionManager = new CollisionManager(
        this.combatManager,
        this.teamManager,
        () => this.planets,
        (p) => this.removeProjectile(p)
    );

    // 2. Setup Renderer
    // this.fleetRenderer = new FleetRenderer(this); // Pass 'this' as scene
    this.graphics = this.add.graphics();
    this.graphics.setDepth(1000);

    // Draw Play Boundary (Moved to after planet generation)
    // this.drawPlayBoundary();
    
    // ...


    
    // 3. Init AI Physics (after Rapier is ready)
    this.aiManager.init();

    // Generate all textures
    TextureGenerator.generate(this);
    
    // Init FXManager
    FXManager.init(this);

    // 3. Create Debug Bodies (Visual Test)
    if (this.rapierManager.world) {

        // Initialize Teams
        const redTeam = this.teamManager.addTeam({ id: 'red', name: 'Red Faction', color: 0xff0000 });
        const greenTeam = this.teamManager.addTeam({ id: 'green', name: 'Green Faction', color: 0x00ff00, isAI: true });

        // Spawn Planets with Overlap Prevention
        // Generate Map
        const mapGen = new MapGenerator();
        const mapWidth = GameConfig.MAP_WIDTH;
        const mapHeight = GameConfig.MAP_HEIGHT;
        
        // Set Camera Bounds with Buffer (Will be updated in calculatePlayBounds)
        // const buffer = 500;
        // this.cameras.main.setBounds(-buffer, -buffer, mapWidth + 2 * buffer, mapHeight + 2 * buffer);
        
        const mapData = mapGen.generate({
            width: mapWidth,
            height: mapHeight,
            planetCount: 8, // Reduced from 12 to prevent overcrowding
            minPlanetRadius: 40, // Slightly reduced
            maxPlanetRadius: 100, // Slightly reduced
            padding: 50 // Reduced padding to fit planets in 800x600
        }, this.rng);

        mapData.planets.forEach((pData) => {
             const planet = new Planet(this, pData.x, pData.y, pData.radius, pData.color, pData.teamId, pData.seed);
             
             if (pData.teamId === redTeam.id) redTeam.addPlanet(planet);
             if (pData.teamId === greenTeam.id) greenTeam.addPlanet(planet);

             if (pData.turretCount > 0) {
                 planet.spawnTurrets(this.rng, pData.turretCount); // MainScene RNG is synced
             }
             this.planets.push(planet);
        });

        // Spawn Debris
        // for (let i = 0; i < 20; i++) {
        //     const x = this.rng.nextRange(50, 750);
        //     const y = this.rng.nextRange(50, 550);
        //     const radius = this.rng.nextRange(3, 8);
        //     this.debris.push(new Debris(this, x, y, radius));
        // }
    }

    // Calculate Dynamic Play Bounds
    this.calculatePlayBounds();
    
    // Redraw Boundary
    this.graphics.clear();
    this.drawPlayBoundary();


    this.turnManager.onPhaseChange = (phase) => {
        // UI Update could happen here
        this.add.text(10, 10, `Phase: ${phase}`, { color: '#0f0' })
            .setName('phaseTextTemp')
            .setDepth(100)
            .setScrollFactor(0)
            .destroy(); 

        if (phase === TurnPhase.PLANNING) {
            this.teamManager.resetResources(); // Kept for AI logic? Or remove entirely?
            // User requested "omit faction energy". So we should ignore resources.
            // But AI might use it? Assuming I need to check AI logic separately.
            
            // this.projectiles.forEach(p => p.destroy());
            // this.projectiles = [];
            
            // We want to KEEP the graphics (trajectories) or clear them? 
            // Usually we want to clear old trajectories, but keep the projectiles.
            this.graphics.clear();

            // Reset Radar Turrets to Basic (Effect lasts 1 turn)
            // const { ProjectileType } = await import('../objects/ProjectileTypes');
            this.planets.forEach(p => {
                p.turretsList.forEach(t => {
                    if (t.projectileType === ProjectileType.RADAR) {
                        t.projectileType = ProjectileType.BASIC;
                        // Also update visual queue? The UIManager weapon selection might need refresh
                    }
                });
            });

            // AP Accumulation Phase
            this.applyAPAccumulation();

            // TRIGGER AI
            // We give it a slight delay so it doesn't happen INSTANTLY after resolution, 
            // but for now synchronous is fine.
            const teams = this.teamManager.getTeams();
            const aiTeams = teams.filter(t => t.isAI);
            const humanTeams = teams.filter(t => !t.isAI);
            
            aiTeams.forEach(aiTeam => {
                this.aiManager.calculateMoves(aiTeam, humanTeams, this.planets);
            });
             // this.updateTeamUI(); // Removed
        }
    };
    
    // UI Text removed by user request
    // this.add.text(10, 10, 'Press SPACE to Execute Turn', { fontSize: '16px', color: '#ffffff' }).setScrollFactor(0);
    // this.data.set('phaseText', this.add.text(10, 30, 'Phase: PLANNING', { fontSize: '16px', color: '#00ff00' }).setScrollFactor(0));

     // Trigger initial state if we missed the event
     if (this.turnManager.currentPhase === TurnPhase.PLANNING) {
          // Re-run the planning setup manually
          this.teamManager.resetResources();
          this.applyAPAccumulation();
          
          const teams = this.teamManager.getTeams();
          const aiTeams = teams.filter(t => t.isAI);
          
          aiTeams.forEach(aiTeam => {
              const enemies = teams.filter(t => t.id !== aiTeam.id);
              this.aiManager.calculateMoves(aiTeam, enemies, this.planets);
          });
           // this.updateTeamUI();
     }

     if (!this.isMenuBackground) {
         // Ensure UI Scene is running
         if (!this.scene.isActive('UIScene')) {
             this.scene.launch('UIScene');
             this.scene.bringToTop('UIScene');
         }
         
         const uiScene = this.scene.get('UIScene');
         this.uiManager = new UIManager(this, uiScene);
         // ... (rest is same)
         this.uiManager.createWeaponSelectionUI();
         this.uiManager.createDebugUI();
         this.uiManager.createFireButton();
         this.uiManager.createMenuButton(); // New Method
         
         this.inputManager = new InputManager(this);
         this.inputManager.handleInput();
         
         // Handle Audio Context Resume
         this.input.on('pointerdown', () => {
             const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
             if (soundManager.context && soundManager.context.state === 'suspended') {
                 soundManager.context.resume();
             }
         });
     }

     this.trajectorySystem = new TrajectorySystem(this);
     
     // Bind Busy Check
     this.turnManager.checkBusy = () => {
         // 1. Are projectiles flying?
         if (this.projectiles.length > 0) return true;
         
         // 2. Are turrets falling?
         let fallingCount = 0;
         this.planets.forEach(p => {
             p.turretsList.forEach(t => {
                 if (t.isFalling) fallingCount++;
             });
         });
         
         return fallingCount > 0;
     };

     this.initialized = true;
  }

  update(_time: number, delta: number) {
    if (!this.initialized) return;

    // Convert delta to ms
    // Convert delta to ms
    // Only run turn manager if NOT menu background
    const shouldStep = !this.isMenuBackground ? this.turnManager.update(delta) : false;

    if (shouldStep) {
        // Projectiles now handle their own gravity internally
        
        // Apply gravity to falling turrets
        const fallingTurrets: Turret[] = [];
        this.planets.forEach(p => {
             p.turretsList.forEach(t => {
                 if (t.isFalling) fallingTurrets.push(t);
             });
        });
        if (fallingTurrets.length > 0) {
            GravitySystem.applyGravity(fallingTurrets, this.planets);
            fallingTurrets.forEach(t => t.update());
        }

        // Check Play Area Bounds
        this.checkPlayBounds();
    }
    
    // Check Victory
    this.checkVictoryCondition();

    if (shouldStep) {
        this.rapierManager.step(); 
        this.projectiles.forEach(p => p.update(this.planets, this.projectiles));

        // Projectiles now handle their own gravity internally
        
        // Apply gravity to falling turrets
        const fallingTurrets: Turret[] = [];
        this.planets.forEach(p => {
             p.turretsList.forEach(t => {
                 if (t.isFalling) fallingTurrets.push(t);
             });
        });
        if (fallingTurrets.length > 0) {
            GravitySystem.applyGravity(fallingTurrets, this.planets);
            fallingTurrets.forEach(t => t.update());
        }

        // Check Play Area Bounds
        this.checkPlayBounds();
        
        this.collisionManager.update();
        FXManager.getInstance().update(delta);
    }

    if (this.turnManager.currentPhase === TurnPhase.PLANNING && this.uiManager) {
        this.uiManager.updateWeaponSelectionUI();
    }

    // Prediction handling - show during PLANNING and EXECUTION
    if (!this.isMenuBackground && (this.turnManager.currentPhase === TurnPhase.PLANNING || 
        this.turnManager.currentPhase === TurnPhase.EXECUTION)) {
        this.graphics.clear();
        this.trajectorySystem.predictTrajectory(this.graphics);
    } else {
        // Clear trajectories during other phases
        this.graphics.clear();
    }
    
    // Update Phase Text
    const phaseText = this.data.get('phaseText') as Phaser.GameObjects.Text;
    if (phaseText) {
        // Phase text removed
        // phaseText.setText(`Phase: ${this.turnManager.currentPhase}`);
    }
  }

  // Helper needed for managers
  public removeProjectile(p: Projectile) {
        const pIndex = this.projectiles.indexOf(p);
        if (pIndex > -1) this.projectiles.splice(pIndex, 1);
  }
  
  public fireProjectiles() {
       this.planets.forEach(p => {
         p.turretsList.forEach(t => {
             if (t.armed && t.aimVector) {
                 const angle = Math.atan2(t.aimVector.y, t.aimVector.x);
                 const speed = Math.sqrt(t.aimVector.x * t.aimVector.x + t.aimVector.y * t.aimVector.y);
                 
                 const pos = t.position;
                 const tipLen = GameConfig.PROJECTILE_SPAWN_OFFSET;
                  const tipX = pos.x + Math.cos(angle) * tipLen;
                  const tipY = pos.y + Math.sin(angle) * tipLen;
                  
                  const proj = new Projectile(this, tipX, tipY, angle, speed, undefined, t.projectileType, t.teamId);
                  if (t.teamId) {
                     // Color projectile based on team if we want?
                     // proj.setTint ...
                     const team = this.teamManager.getTeam(t.teamId);
                     if (team) proj.setTint(team.color);
                 }
                 this.projectiles.push(proj);
                 
                 // Apply Recoil
                 const recoilMagnitude = speed * proj.getMass() * 10.0; 
                 // Resistance/Friction of the base on the ground
                 // If airborne (isFalling), resistance is 0.
                 const recoilResistance = t.isFalling ? 0 : 2000.0; 
                 
                 if (recoilMagnitude > recoilResistance) {
                     if (!t.isFalling) t.setFalling(true); // Enable dynamic physics if grounded
                     
                     // Apply remaining force after overcoming resistance
                     const effectiveRecoil = recoilMagnitude - recoilResistance;
                     
                     const recoilX = -Math.cos(angle) * effectiveRecoil;
                     const recoilY = -Math.sin(angle) * effectiveRecoil;
                     
                     t.applyImpulse(recoilX, recoilY);
                     t.applyImpulse(recoilX, recoilY);
                 }
                 
                 // Disarm the turret so trajectory prediction stops
                 t.setArmed(false);
             }
         });
     });
  }

  public executeTurn() {
       if (this.turnManager.currentPhase !== TurnPhase.PLANNING) return;

       this.planets.forEach(p => {
           p.turretsList.forEach(t => {
               if (t.armed) {
                   t.consumeActionPoints(1);
               }
           });
       });

       this.turnManager.commitTurn();
       this.fireProjectiles();
  }

  private applyAPAccumulation() {
      this.planets.forEach(p => {
          const controllerId = p.getControllerTeamId();
          p.turretsList.forEach(t => {
              let apGain = 1;
              if (controllerId && t.teamId === controllerId) {
                  apGain = 2;
              }
              t.addActionPoints(apGain);

               // Visual Feedback
              const text = `+${apGain}`;
              // Green for player/friendly, maybe different for enemy?
              // For now simpler: Cyan for AP.
              FXManager.getInstance().createFloatingText(t.position.x, t.position.y - 20, text, 0x00ffff);

              // If Red Faction Max AP config is enabled, max it out
              if (GameConfig.RED_FACTION_MAX_AP && t.teamId === 'red') {
                  t.setMaxActionPoints();
              }
          });
      });
  }
  private checkPlayBounds() {
      const bounds = this.playBounds;
      
      this.planets.forEach(p => {
          for (let i = p.turretsList.length - 1; i >= 0; i--) {
              const t = p.turretsList[i];
              // Check bounds
              if (!bounds.contains(t.position.x, t.position.y)) {
                  // Visual text
                  FXManager.getInstance().createFloatingText(t.position.x, t.position.y, "OUT OF BOUNDS!", 0xff0000);
                  // FX
                  FXManager.getInstance().createExplosion(t.position.x, t.position.y, 0xffffff, 30);
                  
                  t.destroy();
                  p.turretsList.splice(i, 1);
              }
          }
      });
  }

  private calculatePlayBounds() {
      if (this.planets.length === 0) return;

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      this.planets.forEach(p => {
          const r = p.radiusValue;
          if (p.position.x - r < minX) minX = p.position.x - r;
          if (p.position.x + r > maxX) maxX = p.position.x + r;
          if (p.position.y - r < minY) minY = p.position.y - r;
          if (p.position.y + r > maxY) maxY = p.position.y + r;
      });

      const padding = 500;
      this.playBounds.setPosition(minX - padding, minY - padding);
      this.playBounds.setSize(
          (maxX + padding) - (minX - padding),
          (maxY + padding) - (minY - padding)
      );
      
      // Update Camera Bounds to match (plus a bit more for shake/ui)
      this.cameras.main.setBounds(
          this.playBounds.x - 100, 
          this.playBounds.y - 100, 
          this.playBounds.width + 200, 
          this.playBounds.height + 200
      );
      
      this.cameras.main.centerOn(this.playBounds.centerX, this.playBounds.centerY);
  }

  private drawPlayBoundary() {
         const x = this.playBounds.x;
         const y = this.playBounds.y;
         const w = this.playBounds.width;
         const h = this.playBounds.height;
         
         const graphics = this.add.graphics();
         graphics.lineStyle(2, 0xffffff, 0.5); // Thinner, slightly transparent
         
         // Helper for dashed line
         const dashLen = 20;
         const gapLen = 20;
         const step = dashLen + gapLen;

         const drawDashedRect = (x: number, y: number, w: number, h: number) => {
             // Top
             for (let i = x; i < x + w; i += step) {
                 graphics.lineBetween(i, y, Math.min(i + dashLen, x + w), y);
             }
             // Bottom
             for (let i = x; i < x + w; i += step) {
                 graphics.lineBetween(i, y + h, Math.min(i + dashLen, x + w), y + h);
             }
             // Left
             for (let i = y; i < y + h; i += step) {
                 graphics.lineBetween(x, i, x, Math.min(i + dashLen, y + h));
             }
             // Right
             for (let i = y; i < y + h; i += step) {
                 graphics.lineBetween(x + w, i, x + w, Math.min(i + dashLen, y + h));
             }
         };
         
         drawDashedRect(x, y, w, h);
  }

  private checkVictoryCondition() {
      if (this.data.get('victoryShown')) return;

      // Count AI turrets (non-red)
      let aiTurretCount = 0;
      this.planets.forEach(p => {
          p.turretsList.forEach(t => {
               if (t.teamId !== 'red') {
                   aiTurretCount++;
               }
          });
      });

      // Count Player turrets
      let playerTurretCount = 0;
      this.planets.forEach(p => {
           p.turretsList.forEach(t => {
               if (t.teamId === 'red') playerTurretCount++;
           });
      });

      if (aiTurretCount === 0 && playerTurretCount > 0) {
          // VICTORY
          this.data.set('victoryShown', true);
          const cx = this.scale.width / 2;
          const cy = this.scale.height / 2;
          
          const victoryText = this.add.text(cx, cy, 'VICTORY!', { 
              fontSize: '96px', 
              color: '#00ff00', 
              fontStyle: 'bold',
              stroke: '#000000',
              strokeThickness: 8
          }).setOrigin(0.5).setScrollFactor(0).setDepth(3000);
          
          this.tweens.add({
              targets: victoryText,
              scale: { from: 0.5, to: 1.2 },
              duration: 800,
              ease: 'Bounce.Out',
              onComplete: () => {
                  this.time.delayedCall(3000, () => {
                      this.scene.stop('MainScene');
                      this.scene.stop('UIScene');
                      this.scene.start('MenuScene');
                  });
              }
          });
      }
  }
}
