// Shared utility functions
function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

function checkCollision(divA, divB) {
    const rectA = divA.getBoundingClientRect();
    const rectB = divB.getBoundingClientRect();
    const margin = 5; // forgiveness margin

    return !(
        rectA.top + margin > rectB.bottom - margin ||
        rectA.right - margin < rectB.left + margin ||
        rectA.bottom - margin < rectB.top + margin ||
        rectA.left + margin > rectB.right - margin
    );
}

// Player Entity Class
class Player {
    constructor(container) {
        this.element = document.createElement('div');
        this.element.className = 'entity vehicle player-car';
        
        // Add wheels
        ['tl', 'tr', 'bl', 'br'].forEach(pos => {
            let w = document.createElement('div');
            w.className = `wheel ${pos}`;
            this.element.appendChild(w);
        });

        container.appendChild(this.element);

        this.width = 46;
        this.height = 86;
        
        this.keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

        window.addEventListener('keydown', e => { if (this.keys.hasOwnProperty(e.code)) this.keys[e.code] = true; });
        window.addEventListener('keyup', e => { if (this.keys.hasOwnProperty(e.code)) this.keys[e.code] = false; });
        
        this.reset();
    }

    reset() {
        this.x = 277; // roughly center of 600px board
        // Base vertical (render) position near bottom of the viewport.
        // Keep as a baseline so speed can shift the visible y to simulate passing.
        this.baseY = (window && window.innerHeight) ? (window.innerHeight - 120) : 600;
        this.y = this.baseY;
        this.speed = 0;
        this.updateDOM();
    }

    update() {
        // Lateral Steering
        if(this.keys.ArrowLeft) this.x -= 7;
        if(this.keys.ArrowRight) this.x += 7;

        // Acceleration
        if(this.keys.ArrowUp) {
            this.speed += 0.2;
        } else if(this.keys.ArrowDown) {
            this.speed -= 0.5;
        } else {
            // Friction
            if(this.speed > 0) this.speed -= 0.1;
            if(this.speed < 0) this.speed += 0.1;
        }

        // Clamp Speed
        this.speed = clamp(this.speed, -3, 15);
        
        // Clamp bounds (Road is 600px wide, margins are 5px borders)
        this.x = clamp(this.x, 10, 600 - this.width - 10);

        // Vertical position reacts to speed so the player can move 'ahead' of AI
        // Faster forward speed moves the player's rendered position upward (smaller y)
        const desiredY = Math.max(80, this.baseY - (this.speed * 12));
        // Smoothly approach desired Y so movement feels natural
        this.y += (desiredY - this.y) * 0.12;
        // Keep player within visible road area
        const maxY = Math.max(this.baseY, (window && window.innerHeight) ? (window.innerHeight - 80) : this.baseY);
        this.y = clamp(this.y, 80, maxY);

        this.updateDOM();
    }

    updateDOM() {
        this.element.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
        // Debug: log first position
        if (!this._loggedPosition) {
            console.log(`Player car rendered at x:${this.x}, y:${this.y}`);
            this._loggedPosition = true;
        }
    }
}
