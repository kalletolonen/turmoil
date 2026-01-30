import Phaser from 'phaser';

export class UIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UIScene', active: true });
    }

    create() {
        // UIScene is active but we don't put anything here by default.
        // The UIManager will populate it.
        // We might want to handle resize here if UIManager doesn't handle it fully?
        
        this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
             // Dispatch event or let UIManager handle it?
             // For now UIManager will need to listen or we re-layout.
             this.events.emit('resize', gameSize);
        });
    }
}
