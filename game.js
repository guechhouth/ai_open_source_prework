// Game client initialization
class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // Game state
        this.playerId = null;
        this.players = {};
        this.avatars = {};
        this.myPlayer = null;
        
        // Viewport/Camera system
        this.cameraX = 0;
        this.cameraY = 0;
        this.viewportWidth = 0;
        this.viewportHeight = 0;
        
        // WebSocket connection
        this.socket = null;
        this.connected = false;
        
        // Avatar image cache
        this.avatarImageCache = {};
        
        // Input tracking
        this.keysPressed = {};
        this.isMoving = false;
        
        // Camera smoothing
        this.targetCameraX = 0;
        this.targetCameraY = 0;
        this.cameraSpeed = 0.1; // Smoothing factor (0.1 = smooth, 1.0 = instant)
        
        // Performance
        this.lastFrameTime = 0;
        this.targetFPS = 60;
        this.frameInterval = 1000 / this.targetFPS;
        
        // UI state
        this.showUI = true;
        
        this.init();
    }
    
    init() {
        // Set canvas size to fill the browser window
        this.resizeCanvas();
        
        // Load the world map image
        this.loadWorldMap();
        
        // Connect to game server
        this.connectToServer();
        
        // Setup input handling
        this.setupInputHandling();
        
        // Start game loop
        this.startGameLoop();
        
        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.viewportWidth = this.canvas.width;
        this.viewportHeight = this.canvas.height;
        
        // Update camera position to center on my player
        this.updateCameraPosition();
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            // World map loaded, game loop will handle rendering
        };
        this.worldImage.onerror = () => {
            console.error('Failed to load world map image');
        };
        this.worldImage.src = 'world.jpg';
    }
    
    // WebSocket connection methods
    connectToServer() {
        try {
            this.socket = new WebSocket('wss://codepath-mmorg.onrender.com');
            
            this.socket.onopen = () => {
                console.log('Connected to game server');
                this.connected = true;
                this.joinGame();
            };
            
            this.socket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };
            
            this.socket.onclose = () => {
                console.log('Disconnected from game server');
                this.connected = false;
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to connect to server:', error);
        }
    }
    
    joinGame() {
        if (this.connected) {
            const message = {
                action: 'join_game',
                username: 'Guech'
            };
            this.socket.send(JSON.stringify(message));
        }
    }
    
    // Message handling
    handleMessage(data) {
        console.log('Received message:', data);
        
        switch (data.action) {
            case 'join_game':
                if (data.success) {
                    this.playerId = data.playerId;
                    this.players = data.players;
                    this.avatars = data.avatars;
                    this.myPlayer = data.players[this.playerId];
                    this.loadAvatarImages();
                    this.updateCameraPosition();
                } else {
                    console.error('Failed to join game:', data.error);
                }
                break;
                
            case 'players_moved':
                this.players = { ...this.players, ...data.players };
                if (this.myPlayer && data.players[this.playerId]) {
                    this.myPlayer = data.players[this.playerId];
                    this.updateCameraPosition();
                }
                break;
                
            case 'player_joined':
                this.players[data.player.id] = data.player;
                this.avatars[data.avatar.name] = data.avatar;
                this.loadAvatarImages();
                break;
                
            case 'player_left':
                delete this.players[data.playerId];
                break;
        }
    }
    
    // Avatar image loading and caching
    loadAvatarImages() {
        for (const avatarName in this.avatars) {
            const avatar = this.avatars[avatarName];
            if (!this.avatarImageCache[avatarName]) {
                this.avatarImageCache[avatarName] = {};
                
                // Load frames for each direction
                ['north', 'south', 'east'].forEach(direction => {
                    this.avatarImageCache[avatarName][direction] = [];
                    avatar.frames[direction].forEach((frameData, index) => {
                        const img = new Image();
                        img.onload = () => {
                            // Avatar frame loaded, game loop will handle rendering
                        };
                        img.src = frameData;
                        this.avatarImageCache[avatarName][direction][index] = img;
                    });
                });
            }
        }
    }
    
    // Camera/Viewport system
    updateCameraPosition() {
        if (this.myPlayer) {
            // Calculate target camera position (center on my player)
            this.targetCameraX = this.myPlayer.x - this.viewportWidth / 2;
            this.targetCameraY = this.myPlayer.y - this.viewportHeight / 2;
            
            // Clamp target camera to world boundaries
            this.targetCameraX = Math.max(0, Math.min(this.targetCameraX, this.worldWidth - this.viewportWidth));
            this.targetCameraY = Math.max(0, Math.min(this.targetCameraY, this.worldHeight - this.viewportHeight));
        }
    }
    
    updateCameraSmooth() {
        // Smooth camera movement using linear interpolation
        this.cameraX += (this.targetCameraX - this.cameraX) * this.cameraSpeed;
        this.cameraY += (this.targetCameraY - this.cameraY) * this.cameraSpeed;
    }
    
    // Coordinate conversion
    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.cameraX,
            y: worldY - this.cameraY
        };
    }
    
    screenToWorld(screenX, screenY) {
        return {
            x: screenX + this.cameraX,
            y: screenY + this.cameraY
        };
    }
    
    // Game loop
    startGameLoop() {
        const gameLoop = (currentTime) => {
            // Frame rate limiting
            if (currentTime - this.lastFrameTime >= this.frameInterval) {
                this.update();
                this.render();
                this.lastFrameTime = currentTime;
            }
            requestAnimationFrame(gameLoop);
        };
        requestAnimationFrame(gameLoop);
    }
    
    update() {
        // Update smooth camera movement
        this.updateCameraSmooth();
    }
    
    // Rendering methods
    render() {
        if (!this.worldImage) return;
        
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw world map with camera offset
        this.drawWorldMap();
        
        // Draw all players
        this.drawPlayers();
        
        // Draw UI overlay
        if (this.showUI) {
            this.drawUI();
        }
    }
    
    drawWorldMap() {
        // Draw the visible portion of the world map
        this.ctx.drawImage(
            this.worldImage,
            this.cameraX, this.cameraY, this.viewportWidth, this.viewportHeight,  // Source: visible area
            0, 0, this.viewportWidth, this.viewportHeight  // Destination: full canvas
        );
    }
    
    drawPlayers() {
        for (const playerId in this.players) {
            const player = this.players[playerId];
            this.drawAvatar(player);
        }
    }
    
    drawAvatar(player) {
        const screenPos = this.worldToScreen(player.x, player.y);
        
        // Check if avatar is visible in viewport
        if (screenPos.x < -50 || screenPos.x > this.viewportWidth + 50 ||
            screenPos.y < -50 || screenPos.y > this.viewportHeight + 50) {
            return; // Skip rendering if not visible
        }
        
        const avatar = this.avatars[player.avatar];
        if (!avatar || !this.avatarImageCache[player.avatar]) return;
        
        // Get the appropriate frame based on direction and animation
        let direction = player.facing;
        let frameIndex = player.animationFrame || 0;
        
        // Handle west direction (flip east frames)
        let flipHorizontal = false;
        if (direction === 'west') {
            direction = 'east';
            flipHorizontal = true;
        }
        
        const frameImage = this.avatarImageCache[player.avatar][direction]?.[frameIndex];
        if (!frameImage) return;
        
        // Draw avatar with proper aspect ratio and shadow
        const avatarSize = 32; // Base size
        const centerX = screenPos.x;
        const centerY = screenPos.y;
        
        this.ctx.save();
        
        // Draw shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(centerX, centerY + avatarSize/2 - 2, avatarSize/3, avatarSize/6, 0, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Draw avatar
        if (flipHorizontal) {
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(frameImage, -centerX - avatarSize/2, centerY - avatarSize/2, avatarSize, avatarSize);
        } else {
            this.ctx.drawImage(frameImage, centerX - avatarSize/2, centerY - avatarSize/2, avatarSize, avatarSize);
        }
        
        this.ctx.restore();
        
        // Draw username label with better styling
        this.drawUsername(player.username, centerX, centerY - avatarSize/2 - 8);
    }
    
    drawUsername(username, x, y) {
        this.ctx.save();
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 3;
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        
        // Draw text with outline
        this.ctx.strokeText(username, x, y);
        this.ctx.fillText(username, x, y);
        
        this.ctx.restore();
    }
    
    // UI rendering
    drawUI() {
        this.ctx.save();
        
        // Connection status
        const statusColor = this.connected ? '#4CAF50' : '#F44336';
        const statusText = this.connected ? 'Connected' : 'Disconnected';
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, 10, 120, 60);
        
        this.ctx.fillStyle = statusColor;
        this.ctx.font = 'bold 14px Arial';
        this.ctx.fillText(statusText, 70, 30);
        
        // Player count
        const playerCount = Object.keys(this.players).length;
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`Players: ${playerCount}`, 70, 50);
        
        // Controls hint
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, this.viewportHeight - 40, 200, 30);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Arial';
        this.ctx.fillText('Use Arrow Keys or WASD to move', 110, this.viewportHeight - 20);
        
        this.ctx.restore();
    }
    
    // Input handling methods
    setupInputHandling() {
        document.addEventListener('keydown', (event) => this.handleKeyDown(event));
        document.addEventListener('keyup', (event) => this.handleKeyUp(event));
    }
    
    handleKeyDown(event) {
        // Prevent default browser behavior for movement keys
        const movementKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
        if (movementKeys.includes(event.code)) {
            event.preventDefault();
        }
        
        // Track key state
        this.keysPressed[event.code] = true;
        
        // Send movement command
        this.sendMovementCommand();
    }
    
    handleKeyUp(event) {
        // Track key state
        this.keysPressed[event.code] = false;
        
        // Check if any movement keys are still pressed
        const movementKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
        const anyMovementKeyPressed = movementKeys.some(key => this.keysPressed[key]);
        
        if (!anyMovementKeyPressed && this.isMoving) {
            // No movement keys pressed, send stop command
            this.sendStopCommand();
        } else if (anyMovementKeyPressed) {
            // Still have movement keys pressed, send movement command
            this.sendMovementCommand();
        }
    }
    
    sendMovementCommand() {
        if (!this.connected) return;
        
        // Determine direction based on pressed keys (support both arrow keys and WASD)
        let direction = null;
        
        // Check for movement keys (prioritize the most recent)
        if (this.keysPressed['ArrowUp'] || this.keysPressed['KeyW']) {
            direction = 'up';
        } else if (this.keysPressed['ArrowDown'] || this.keysPressed['KeyS']) {
            direction = 'down';
        } else if (this.keysPressed['ArrowLeft'] || this.keysPressed['KeyA']) {
            direction = 'left';
        } else if (this.keysPressed['ArrowRight'] || this.keysPressed['KeyD']) {
            direction = 'right';
        }
        
        if (direction) {
            const message = {
                action: 'move',
                direction: direction
            };
            this.socket.send(JSON.stringify(message));
            this.isMoving = true;
        }
    }
    
    sendStopCommand() {
        if (!this.connected) return;
        
        const message = {
            action: 'stop'
        };
        this.socket.send(JSON.stringify(message));
        this.isMoving = false;
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
