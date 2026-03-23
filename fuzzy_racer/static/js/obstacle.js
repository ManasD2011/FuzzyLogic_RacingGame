class Obstacle {
    constructor(container, type, laneX) {
        this.element = document.createElement('div');
        this.type = type; // 'ai', 'cone', 'stone'
        this.scale = 1;
        
        if (type === 'ai') {
            this.element.className = 'entity vehicle ai-car';
            // Single red AI car
            this.element.style.background = 'linear-gradient(180deg, #f12711, #f5af19)';
            
            this.scale = 1.0;
            
            // Add wheels
            ['tl', 'tr', 'bl', 'br'].forEach(pos => {
                let w = document.createElement('div');
                w.className = `wheel ${pos}`;
                this.element.appendChild(w);
            });
            
            this.width = 46 * this.scale;
            this.height = 86 * this.scale;
            // AI car moves at similar speed to global scroll, so it stays on screen
            this.baseAISpeed = 8 + Math.random() * 4; // 8 to 12 (slightly faster/slower than global 10)
        } else {
            this.element.className = `entity obstacle ${type}`;
            if (type === 'cone') {
                this.width = 30;
                this.height = 50;
            } else { // stone
                this.width = 45;
                this.height = 35;
            }
            this.baseAISpeed = 0; // Static
        }

        this.x = laneX;
        // Spawn AI car in middle of visible screen to race alongside player
        // Spawn obstacles off-screen at top
        if (type === 'ai') {
            this.y = 200; // AI starts visible in upper-middle area
        } else {
            this.y = -100 - Math.random() * 300; // Obstacles spawn off-screen
        }

        
        this.markedForDeletion = false;
        
        // For throttling Flask API calls to 2x a second per car instead of 60x
        this.lastFuzzyRequest = 0;
        this.currentFuzzyAction = "Maintain Speed";
        this.lastTraceSignature = "";
        
        // Target X for lane shifting
        this.targetX = this.x;

        container.appendChild(this.element);
        this.updateDOM();
        
        // Log creation
        if (type === 'ai') {
            console.log('🏎️ AI CAR CREATED:', {
                x: this.x,
                y: this.y,
                baseSpeed: this.baseAISpeed,
                className: this.element.className,
                visible: true
            });
        }
    }

    update(playerSpeed, globalScrollSpeed) {
        // For AI cars, keep them racing on screen near the player
        if (this.type === 'ai') {
            // AI car should maintain position relative to player, racing alongside
            // Instead of scrolling off-screen, it stays in the visible racing area
            // Apply fuzzy logic speed adjustments
            let speedDelta = 0;
            if (this.currentFuzzyAction === 'Brake') {
                speedDelta = -0.3;
            } else if (this.currentFuzzyAction === 'Accelerate') {
                speedDelta = 0.2;
            }

            this.baseAISpeed = Math.max(4, Math.min(15, this.baseAISpeed + speedDelta));

            // Make AI respond to the player's relative forward progress so the player
            // can actually overtake when they accelerate. If playerSpeed > AI base speed
            // the AI should retreat (move up / smaller y). If player is slower, AI will
            // move down toward the player.
            // Use the difference between playerSpeed and AI's own base speed to decide.
            const rel = (playerSpeed - this.baseAISpeed);
            const relativeMovement = -rel * 0.6; // negative => AI moves up when player is faster

            // Add a gentle world-bias so AI still respects its own base speed vs global scroll
            const worldBias = (globalScrollSpeed - this.baseAISpeed) * 0.15;

            this.y += relativeMovement + worldBias;

            // Keep AI car within a reasonable visible racing zone
            const minY = 60;
            const maxY = (window && window.innerHeight) ? (window.innerHeight - 140) : 500;
            this.y = clamp(this.y, minY, maxY);
            
            // Log AI car position every 60 frames for debugging
            if (!this._frameCount) this._frameCount = 0;
            this._frameCount++;
            if (this._frameCount % 60 === 0) {
                console.log(`AI car: x=${Math.round(this.x)}, y=${Math.round(this.y)}, speed=${this.baseAISpeed.toFixed(1)}, action=${this.currentFuzzyAction}`);
            }
        } else {
            // For obstacles (cones/stones), use normal scrolling
            let relativeScroll = globalScrollSpeed + playerSpeed - this.baseAISpeed;
            // Make obstacles move a little slower relative to the world so the
            // player has a better chance to react/pass. Tune slowFactor to adjust difficulty.
            const slowFactor = 0.78; // 0.0 (stop) .. 1.0 (original speed)
            this.y += relativeScroll * slowFactor;
        }
        
        // Lateral movement (Lane Shifting) - works for both AI and obstacles
        if (Math.abs(this.x - this.targetX) > 2) {
            this.x += (this.targetX - this.x) * 0.05; // Smooth lerp
        }

        // Only mark obstacles for deletion when off-screen, keep AI car always
        if (this.type !== 'ai' && (this.y > window.innerHeight + 300 || this.y < -600)) {
            this.markedForDeletion = true;
        } else {
            this.updateDOM();
        }
    }

    async applyPythonFuzzy(playerX, playerY, timestamp) {
        if (this.type !== 'ai') return;
        const entities = (window.engine && Array.isArray(window.engine.entities))
            ? window.engine.entities
            : [];

        // 1. Find nearest interaction target in/near the same lane.
        // Primary: player if the player is behind this AI (racing interaction).
        // Secondary: nearest entity ahead for collision avoidance.
        let distAhead = 500;
        let targetSpeed = 10 + window.playerSpeedRef; // default to player world speed
        
        // If player is behind and close laterally, use player as the main race target.
        // In this game's coordinate system, larger y means lower on screen (behind AI).
        if (playerY > this.y && Math.abs(playerX - this.x) < 120) {
            distAhead = playerY - this.y;
        }
        
        // Obstacles/cars ahead still get priority when they are the closest threat.
        entities.forEach(e => {
            if (e !== this && e.y < this.y && Math.abs(e.x - this.x) < 80) {
                let d = this.y - e.y;
                if (d < distAhead) {
                    distAhead = d;
                    targetSpeed = e.type === 'ai' ? e.baseAISpeed : 0;
                }
            }
        });

        // Throttle API to 5x per second for more responsive real-time updates
        if (timestamp - this.lastFuzzyRequest > 200) {
            this.lastFuzzyRequest = timestamp;

            const relSpd = this.baseAISpeed - targetSpeed;
            
            const laneWidth = 200;
            let leftClearance = 500;
            let rightClearance = 500;
            
            if (this.x < 100) leftClearance = 0; // Already in leftmost lane
            if (this.x > 300) rightClearance = 0; // Already in rightmost
            
            const checkClearance = (ex, ey) => {
                let yDist = Math.abs(ey - this.y);
                if (yDist < 150) { // entity next to us vertically
                    if (ex + 50 < this.x && this.x - (ex + 50) < laneWidth) leftClearance = Math.min(leftClearance, yDist);
                    if (ex > this.x + 50 && ex - (this.x + 50) < laneWidth) rightClearance = Math.min(rightClearance, yDist);
                }
            };

            checkClearance(playerX, playerY);
            entities.forEach(e => {
                if (e !== this) checkClearance(e.x, e.y);
            });

            // Call Python API
            const data = await api.getFuzzyDecision(distAhead, relSpd, leftClearance, rightClearance);
            // console.log("Fuzzy API response:", data);
            
            this.currentFuzzyAction = data.action;
            const pathAction = data.path;
            
            // UI Update check (Only update Trace UI if THIS ai is the closest to the player)
            let isClosest = true;
            let myDist = Math.abs(this.y - playerY);
            entities.forEach(e => {
                if (e.type === 'ai' && e !== this && Math.abs(e.y - playerY) < myDist) {
                    isClosest = false;
                }
            });

            // console.log("isClosest for AI at x:", this.x, "is", isClosest);
            
            if (isClosest) {
                // ...
                document.getElementById('ai-val').innerText = this.currentFuzzyAction + " / " + pathAction;
                document.getElementById('trace-dec').innerText = this.currentFuzzyAction;
                document.getElementById('trace-path').innerText = pathAction;
                
                const ruleStr = data.rule ? data.rule : "--";
                document.getElementById('trace-rule').innerText = ruleStr;
                
                if (data.defuzzified_value !== undefined) {
                    document.getElementById('trace-defuzz').innerText = Math.round(data.defuzzified_value);
                }

                if (data.distance_membership && data.speed_membership) {
                    drawFuzzyGraph('distGraph', data.distance_membership, distAhead, [0, 550], ['Near', 'Medium', 'Far'], ['#00e5ff', '#b388ff', '#ff1744']);
                    drawFuzzyGraph('speedGraph', data.speed_membership, relSpd, [-10, 10], ['Slow', 'Normal', 'Fast'], ['#00e5ff', '#b388ff', '#ff1744']);
                }

                const logBox = document.getElementById('trace-log');
                const now = new Date();
                const time = now.toLocaleTimeString('en-GB') + '.' + String(now.getMilliseconds()).padStart(3, '0');
                const defuzz = data.defuzzified_value !== undefined ? data.defuzzified_value.toFixed(1) : '-';
                const signature = [
                    Math.round(distAhead),
                    Math.round(relSpd),
                    data.rule || '-',
                    this.currentFuzzyAction,
                    pathAction,
                    defuzz
                ].join('|');

                // Add a new log line only when fuzzy state meaningfully changes.
                if (signature !== this.lastTraceSignature) {
                    this.lastTraceSignature = signature;
                    logBox.innerHTML = `<div class="log-entry">[${time}] D:${Math.round(distAhead)} | S:${relSpd.toFixed(1)} | Z:${defuzz}<br/>${this.currentFuzzyAction} / ${pathAction}<br/>Rule: ${data.rule || '-'}</div>` + logBox.innerHTML;

                    // Keep visualizer log bounded.
                    while (logBox.children.length > 20) {
                        logBox.removeChild(logBox.lastChild);
                    }
                }
            }
            
            // Apply Lane Changes Targets
            if (pathAction === "Shift Left" && Math.abs(this.targetX - this.x) < 5) {
                this.targetX = Math.max(30, this.targetX - laneWidth);
            } else if (pathAction === "Shift Right" && Math.abs(this.targetX - this.x) < 5) {
                this.targetX = Math.min(430, this.targetX + laneWidth);
            }
        }
        
        // Speed adjustment is now handled in update() function
    }

    destroy() {
        this.element.remove();
    }

    updateDOM() {
        this.element.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) scale(${this.scale})`;
        // Debug: log first few updates
        if (!this._loggedPosition) {
            console.log(`${this.type} rendered at x:${this.x}, y:${this.y}, scale:${this.scale}`);
            this._loggedPosition = true;
        }
    }
}

function drawFuzzyGraph(canvasId, memberships, crispyValue, range, labels, colors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const mapX = (v) => {
        let pct = (v - range[0]) / (range[1] - range[0]);
        pct = Math.max(0, Math.min(1, pct));
        return pct * w;
    };

    // Draw triangles representing fuzzy sets
    labels.forEach((label, i) => {
        const val = memberships[label] || 0;
        const color = colors[i];
        
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        if (canvasId === 'distGraph') {
            if (label === 'Near') { ctx.moveTo(mapX(0), h-10); ctx.lineTo(mapX(0), 10); ctx.lineTo(mapX(150), 10); ctx.lineTo(mapX(250), h-10); }
            if (label === 'Medium') { ctx.moveTo(mapX(150), h-10); ctx.lineTo(mapX(300), 10); ctx.lineTo(mapX(450), h-10); }
            if (label === 'Far') { ctx.moveTo(mapX(350), h-10); ctx.lineTo(mapX(500), 10); ctx.lineTo(mapX(600), 10); ctx.lineTo(mapX(600), h-10); }
        } else {
            if (label === 'Slow') { ctx.moveTo(mapX(-10), h-10); ctx.lineTo(mapX(-10), 10); ctx.lineTo(mapX(-3), 10); ctx.lineTo(mapX(0), h-10); }
            if (label === 'Normal') { ctx.moveTo(mapX(-2), h-10); ctx.lineTo(mapX(0), 10); ctx.lineTo(mapX(3), h-10); }
            if (label === 'Fast') { ctx.moveTo(mapX(1), h-10); ctx.lineTo(mapX(5), 10); ctx.lineTo(mapX(10), 10); ctx.lineTo(mapX(10), h-10); }
        }
        
        // Stroke outline
        ctx.globalAlpha = val > 0 ? 0.9 : 0.4;
        ctx.stroke();

        // Fill activated portion
        if (val > 0) {
            ctx.globalAlpha = 0.3;
            ctx.fill();
        }
        
        // Draw text
        ctx.globalAlpha = val > 0 ? 1.0 : 0.6;
        ctx.font = '9px monospace';
        let lx = mapX(canvasId === 'distGraph' ? (i===0?50 : i===1?260 : 420) : (i===0?-7 : i===1?-1 : 5));
        ctx.fillText(`${label}:${val.toFixed(2)}`, lx, 10);
    });

    // Draw baseline
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 1.0;
    ctx.beginPath();
    ctx.moveTo(0, h - 10);
    ctx.lineTo(w, h - 10);
    ctx.stroke();

    // Draw crisp input line
    const crispX = mapX(crispyValue);
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(crispX, 0);
    ctx.lineTo(crispX, h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText(Math.round(crispyValue), Math.min(crispX + 2, w - 20), h - 2);
}
