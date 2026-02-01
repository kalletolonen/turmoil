import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
    private seedInput?: HTMLInputElement;

    constructor() {
        super('MenuScene');
    }

    create() {
        // 1. Launch Background Scene (initially random, or we wait for input logic)
        // We will do it via updatePreview to share logic.

        // 2. Create UI
        const width = this.scale.width;
        const height = this.scale.height;
        const cx = width / 2;
        const cy = height / 2;

        // Container (Optional, but good for grouping)
        // Title
        this.add.text(cx, cy - 150, 'TURMOIL', {
            fontSize: '84px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 8,
            shadow: { offsetX: 4, offsetY: 4, color: '#000', blur: 4, fill: true }
        }).setOrigin(0.5);

        // Subtitle / Version
        this.add.text(cx, cy - 80, 'Planetary Artillery Warfare', {
            fontSize: '24px',
            color: '#cccccc',
            fontStyle: 'italic',
             stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Seed Input Label
        this.add.text(cx, cy + 20, 'Map Seed:', {
            fontSize: '20px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5, 1);

        // Seed Input (DOM)
        const inputY = cy + 50;
        
        // Seed Input (DOM)
        const initialSeed = Math.floor(Math.random() * 100000);
        
        this.seedInput = document.createElement('input');
        this.seedInput.type = 'number';
        this.seedInput.value = initialSeed.toString();
        this.seedInput.style.width = '200px';
        this.seedInput.style.padding = '10px';
        this.seedInput.style.fontSize = '20px';
        this.seedInput.style.textAlign = 'center';
        
        this.add.dom(cx, inputY, this.seedInput); 
        // Note: DOM origin is center by default in Phaser
        
        // Live Preview Logic
        this.seedInput.addEventListener('input', () => {
             const val = parseInt(this.seedInput?.value || '0', 10);
             if (!isNaN(val)) {
                 this.updatePreview(val);
             }
        });
        
        // Initialize preview
        this.updatePreview(initialSeed);
        
        // Randomize Button (Aligned to the right of input)
        // Input width is 200px (so +/- 100 from center).
        // Let's place the button at cx + 100 + padding.
        this.add.text(cx + 140, inputY, '🎲', {
            fontSize: '32px',
            backgroundColor: '#333',
            padding: { x: 5, y: 5 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
             const newSeed = Math.floor(Math.random() * 100000);
             if (this.seedInput) {
                 this.seedInput.value = newSeed.toString();
                 this.updatePreview(newSeed);
             }
        });


        // Start Button
        const startBtn = this.add.container(cx, cy + 150);
        
        const btnBg = this.add.rectangle(0, 0, 240, 60, 0x00aa00)
            .setStrokeStyle(4, 0xffffff);
        
        const btnText = this.add.text(0, 0, 'START GAME', {
            fontSize: '32px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        startBtn.add([btnBg, btnText]);
        
        // Make the background interactive instead of the container for reliability
        btnBg.setInteractive({ useHandCursor: true })
            .on('pointerover', () => btnBg.setFillStyle(0x00cc00))
            .on('pointerout', () => btnBg.setFillStyle(0x00aa00))
            .on('pointerdown', () => this.startGame());

    }

    private updatePreview(seed: number) {
        // Debounce? For now just raw updates.
        // Check if scene is running, if so stop it.
        if (this.scene.isActive('MainScene') || this.scene.isPaused('MainScene')) {
            // Restart doesn't work well if it's not active? 
            // Better to stop and launch.
            this.scene.stop('MainScene');
        }
        
        // Small delay to ensure clean shutdown? No, Phaser handles queue.
        this.scene.launch('MainScene', { isMenuBackground: true, seed: seed });
        this.scene.sendToBack('MainScene');
    }

    startGame() {
        console.log("Start Game Clicked!");
        const seedVal = parseInt(this.seedInput?.value || '0', 10);
        console.log("Starting with seed:", seedVal);
        
        this.scene.stop('MainScene'); // Stop background
        this.scene.start('MainScene', { isMenuBackground: false, seed: seedVal }); // Start real game
        this.scene.stop('MenuScene'); // Stop self
    }
}
