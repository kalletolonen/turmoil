# Turmoil TBS

A Turn-Based Artillery Strategy game inspired by "Scorched Earth" and "Worms", but played in space with orbital mechanics.
Command your faction of turrets, utilize gravity to curve your shots, and destroy the enemy on fully destructible planets.

**Playable Demo:** [https://turmoil.tolonen.com](https://turmoil.tolonen.com)

## Features

- **Orbital Physics:** Projectiles are affected by the gravity of all planets in the system. Mastering gravity slingshots is key to victory.
- **Destructible Terrain:** Blast chunks out of planets to remove cover or knock enemy turrets into space.
- **Turn-Based Combat:** Plan your moves carefully using Action Points (AP). Move, aim, and fire multiple weapons.
- **Procedural Maps:** Every match takes place on a unique, randomly generated solar system.
- **Diverse Arsenal:**
  - **Basic Cannon:** Reliable, low cost.
  - **Giga Blaster:** High damage, large explosion radius.
  - **Colonizer:** Spawns a new turret on impact.
  - **Defender:** Deploys a protective shield.
  - **Radar:** Reveals the fog of war (planned).

## Tech Stack

- **Engine:** Phaser 3 (WebGL)
- **Physics:** Rapier.js (WASM) for deterministic 2D physics
- **Build Tool:** Vite
- **Language:** TypeScript

## Development

### Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

### Running

- **Development Server:**

  ```bash
  npm run dev
  ```

  Open `http://localhost:5173` to play.

- **Run Tests:**

  ```bash
  npm test
  ```

- **Build for Production:**
  ```bash
  npm run build
  ```
  Output files will be in `dist/`.

## Deployment

See [DEPLOY.md](DEPLOY.md) for instructions on hosting the game on a VPS (Apache/Nginx).

## Agentic Instructions

**For AI Agents working on this repo:**

1.  **Always add tests**: Every new feature or logic module must have accompanying unit tests.
2.  **Run test suite**: Verify with `npm test` before committing.
3.  **Strict Typing**: Maintain high TypeScript standards; no implicit `any`.
