let gameState = 'MENU';
let animationId;
window.playerSpeedRef = 0; // global reference for AI relative speed calculation

class GameEngine {
    constructor() {
        this.board = document.getElementById('entities-layer');
        this.road = document.getElementById('road');
        this.scoreDisplay = document.getElementById('score-val');
        this.speedDisplay = document.getElementById('speed-val');
        
        this.player = null;
        this.entities = [];
        
        this.score = 0;
        this.globalScrollSpeed = 10; // Increased to ensure AI coming from top doesn't move backwards
        this.lastSpawn = 0;
        this.spawnRate = 1200; // ms
    }

    start() {
        // Clear board
        this.board.innerHTML = '';
        this.entities = [];
        this.score = 0;
        this.spawnRate = 1200;
        this.aiCarSpawned = false; // Track if AI car is already on track
        
        document.getElementById('ai-val').innerText = "Cruising";
        document.getElementById('trace-rule').innerText = "--";
        document.getElementById('trace-defuzz').innerText = "--";
        document.getElementById('trace-dec').innerText = "--";
        document.getElementById('trace-path').innerText = "--";
        document.getElementById('trace-log').innerHTML = "";

        // Init player
        this.player = new Player(this.board);
        console.log('Player car created at:', this.player.x, this.player.y);
        
        // Spawn the single AI competitor car
        const aiLane = Math.floor(Math.random() * 3);
        const laneW = 600 / 3;
        const aiXPos = (aiLane * laneW) + (laneW / 2) - 23;
        const aiCar = new Obstacle(this.board, 'ai', aiXPos);
        this.entities.push(aiCar);
        this.aiCarSpawned = true;
        console.log('AI car created at:', aiCar.x, aiCar.y);
        console.log('Total entities on board:', this.entities.length);
        
        this.road.classList.add('road-moving');
        document.getElementById('fuzzy-visualizer').classList.add('visible');
        gameState = 'PLAYING';
        this.lastSpawn = performance.now();
        
        this.loop(performance.now());
    }

    stop() {
        gameState = 'GAMEOVER';
        cancelAnimationFrame(animationId);
        this.road.classList.remove('road-moving');
        document.getElementById('fuzzy-visualizer').classList.remove('visible');
        
        console.log('💥 CRASH! Score:', Math.floor(this.score));
        console.log('Game over screen will appear in 3 seconds...');
        
        // Final Explosion
        let ex = document.createElement('div');
        ex.className = 'explosion-fx';
        ex.style.left = (this.player.x + 23) + 'px';
        ex.style.top = (this.player.y + 43) + 'px';
        this.board.appendChild(ex);

        // Delay game over screen by 3 seconds to show explosion
        setTimeout(() => {
            showScreen('game-over-screen');
            document.getElementById('final-score').innerText = Math.floor(this.score);
            console.log('💀 GAME OVER! Press R to restart or Q to quit to menu');
        }, 3000); // Changed from 1200ms to 3000ms
    }

    spawnObstacle(timestamp) {
        if (timestamp - this.lastSpawn > this.spawnRate) {
            // Generate in one of 3 lanes safely
            const laneIndex = Math.floor(Math.random() * 3);
            const laneW = 600 / 3;
            // Center of lane minus roughly half width of obstacle
            const xPos = (laneIndex * laneW) + (laneW / 2) - 23; 

            // Only spawn cones or stones (no more AI cars)
            let type = Math.random() > 0.5 ? 'cone' : 'stone';

            this.entities.push(new Obstacle(this.board, type, xPos));

            this.lastSpawn = timestamp;
            // Increase difficulty over time by spawning faster
            this.spawnRate = Math.max(500, this.spawnRate - 10);
        }
    }

    loop(timestamp) {
        if (gameState !== 'PLAYING') return;

        // 1. Spawning
        this.spawnObstacle(timestamp);

        // 2. Player Update
        this.player.update();
        window.playerSpeedRef = this.player.speed; // update global ref for Python API

        // HUD Updates
        let actualSpeed = this.globalScrollSpeed + this.player.speed;
        if (actualSpeed > 0) {
            let oldScore = Math.floor(this.score);
            this.score += actualSpeed * 0.1;
            if (Math.floor(this.score) > oldScore && Math.floor(this.score) % 50 === 0) {
                this.scoreDisplay.parentElement.classList.add('pop');
                setTimeout(() => this.scoreDisplay.parentElement.classList.remove('pop'), 150);
            }
        }
        
        this.scoreDisplay.innerText = Math.floor(this.score);
        this.speedDisplay.innerText = Math.floor(actualSpeed * 10) + " MPH";

        // Adjust road sync
        let animDur = Math.max(0.1, 0.8 - (this.player.speed * 0.05));
        document.querySelectorAll('.lane-divider').forEach(d => d.style.animationDuration = `${animDur}s`);

        // 3. Update Entities
        for (let i = this.entities.length - 1; i >= 0; i--) {
            let ent = this.entities[i];
            
            ent.update(this.player.speed, this.globalScrollSpeed);
            
            // Asynchronously fire off Python Fuzzy request if it's time
            ent.applyPythonFuzzy(this.player.x, this.player.y, timestamp);

            // Collision Check
            if (checkCollision(this.player.element, ent.element)) {
                if (ent.type === 'cone' || ent.type === 'stone') {
                    // Crash on any obstacle
                    this.stop();
                    return; // exit loop entirely
                } else if (ent.type === 'ai') {
                    // Crash on AI car collision
                    this.stop();
                    return;
                }
            } else if (ent.markedForDeletion) {
                // Only obstacles get deleted, AI car stays forever
                ent.destroy();
                this.entities.splice(i, 1);
            }
        }

        animationId = requestAnimationFrame(t => this.loop(t));
    }
}

// Global UI Logic
let engine;

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

document.addEventListener("DOMContentLoaded", () => {
    engine = new GameEngine();
    window.engine = engine;

    // Keyboard controls for game over screen
    document.addEventListener('keydown', (e) => {
        const currentScreen = document.querySelector('.screen.active');
        
        // Only respond to R and Q on game over screen
        if (currentScreen && currentScreen.id === 'game-over-screen') {
            if (e.key.toLowerCase() === 'r') {
                e.preventDefault();
                showScreen('game-ui');
                engine.start();
            } else if (e.key.toLowerCase() === 'q') {
                e.preventDefault();
                showScreen('start-screen');
            }
        }
        
        // Spacebar to start from main menu
        if (currentScreen && currentScreen.id === 'start-screen') {
            if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                showScreen('game-ui');
                engine.start();
            }
        }
    });

    document.getElementById('btn-start').addEventListener('click', () => {
        showScreen('game-ui');
        engine.start();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
        showScreen('game-ui');
        engine.start();
    });

    document.getElementById('btn-leaderboard').addEventListener('click', async () => {
        showScreen('leaderboard-screen');
        await renderLeaderboard();
    });

    document.getElementById('btn-back-menu').addEventListener('click', () => {
        showScreen('start-screen');
    });

    document.getElementById('btn-menu-from-gameover').addEventListener('click', () => {
        showScreen('start-screen');
    });

    document.getElementById('btn-save').addEventListener('click', async () => {
        const name = document.getElementById('player-name').value || "ANON";
        const finalScore = Math.floor(engine.score);
        
        document.getElementById('player-name').value = '';
        showScreen('leaderboard-screen');
        await api.saveScore(name, finalScore);
        await renderLeaderboard();
    });
});

async function renderLeaderboard() {
    const container = document.getElementById('leaderboard-list');
    container.innerHTML = "Fetching secured records...";
    const scores = await api.getLeaderboard();
    
    if (scores.length === 0) {
        container.innerHTML = "NO RACE DATA FOUND";
        return;
    }
    
    let html = '';
    scores.forEach((s, i) => {
        html += `<div class="lb-row">
            <span>#${i+1} <span class="lb-name">${s.name}</span></span>
            <span class="lb-score">${s.score}</span>
        </div>`;
    });
    
    container.innerHTML = html;
}
