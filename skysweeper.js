// Game configuration
const config = {
    rows: 9,               // 9x9 grid
    cols: 9,               
    startingLives: 3,
    waveBaseSpeed: 4000,   // ms per cell movement
    waveSpeedIncrease: 100, // Speed reduction per wave
    waveBaseShips: 15,     // First wave ships
    waveIncreaseShips: 5,  // Add 5 ships per wave
    wavePauseTime: 5000,   // ms between waves
    minSpeed: 500,         // Minimum speed in ms
    shipSpawnInterval: 1,  // Spawn a ship every movement
    maxShipSpawnRows: 5,   // Maximum rows for ship distribution
    hiddenBufferRows: 6,   // Hidden rows above the visible board
    darkMode: false,       // Dark mode toggle status
    poofEffectEnabled: true, // Enable poof effect when clearing clouds
    roundedClouds: true,   // Enable rounded cloud shapes
    cellSize: 60           // Fixed cell size of 60px
};

// Game state
const gameState = {
    grid: [],
    lives: config.startingLives,
    wave: 1,
    score: 0,
    gameStarted: false,
    gameOver: false,
    waveActive: false,
    currentSpeed: config.waveBaseSpeed,
    movementInterval: null,
    nextWaveTimeout: null,
    animationFrameId: null, // For animation loop
    flyingUFOs: [],        // Array to track flying UFOs
    poofEffects: [],       // Array to track poof effects
    shipsInWave: 0,        // Total ships for the current wave
    shipsSpawned: 0,       // How many ships have been spawned
    movementCount: 0,      // Counter for board movements
    heartPlaced: false,    // Whether a heart has been placed in the current wave
    destroyedShips: 0,     // Track how many ships have been destroyed
    escapedShips: 0        // Track how many ships have escaped
};

// DOM Elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const heartElements = document.querySelectorAll('.heart');
const waveIndicator = document.querySelector('.wave-indicator');
const scoreElement = document.querySelector('.score');
const shipsCounterElement = document.querySelector('.ships-counter');

// Cell size calculation
let cellSize = config.cellSize; // Fixed cell size of 60px

function calculateCellSize() {
    // Use the fixed cell size instead of calculating dynamically
    cellSize = config.cellSize;
    
    // Set canvas size to fixed dimensions (9 cells × 60px = 540px)
    canvas.width = cellSize * config.cols;  // 540px
    canvas.height = cellSize * config.rows; // 540px
}

// Place a heart in the wave - only if player has lost a heart
function placeHeartInWave() {
    // Only place a heart if the player has lost a life
    if (gameState.lives >= config.startingLives) {
        return;
    }
    
    // Find potential heart placement locations (empty cells with no adjacent ships)
    const potentialHeartLocations = [];
    
    // Search in hidden buffer rows
    for (let row = 0; row < config.hiddenBufferRows; row++) {
        for (let col = 0; col < config.cols; col++) {
            const cell = gameState.grid[row][col];
            // Only place on empty cells with no ships and no numbers
            if (!cell.isShip && cell.adjacentShips === 0 && !cell.hasHeart) {
                potentialHeartLocations.push({ row, col });
            }
        }
    }
    
    // If we have potential locations, pick one at random
    if (potentialHeartLocations.length > 0) {
        const randomIndex = Math.floor(Math.random() * potentialHeartLocations.length);
        const { row, col } = potentialHeartLocations[randomIndex];
        
        gameState.grid[row][col].hasHeart = true;
        gameState.heartPlaced = true;
    } else {
        // If no perfect locations, try to find at least a non-ship cell
        let attempts = 0;
        while (attempts < 20 && !gameState.heartPlaced) {
            const row = Math.floor(Math.random() * config.hiddenBufferRows);
            const col = Math.floor(Math.random() * config.cols);
            
            if (!gameState.grid[row][col].isShip && !gameState.grid[row][col].hasHeart) {
                gameState.grid[row][col].hasHeart = true;
                gameState.heartPlaced = true;
            }
            attempts++;
        }
    }
}

// Create poof effect when revealing a cell
function createPoofEffect(visibleRow, col) {
    if (!config.poofEffectEnabled) return;
    
    const x = col * cellSize + cellSize / 2;
    const y = visibleRow * cellSize + cellSize / 2;
    
    // Create multiple particles for the poof effect
    const particleCount = 8 + Math.floor(Math.random() * 4); // 8-12 particles
    
    for (let i = 0; i < particleCount; i++) {
        // Random angle for the particle
        const angle = (i / particleCount) * Math.PI * 2;
        // Random speed
        const speed = 1 + Math.random() * 1.5;
        // Random size
        const size = Math.max(3, Math.floor(cellSize / 8 + Math.random() * (cellSize / 6)));
        
        // Particle movement direction
        const dx = Math.cos(angle) * speed;
        const dy = Math.sin(angle) * speed;
        
        // Add the particle to the array
        gameState.poofEffects.push({
            x: x,
            y: y,
            dx: dx,
            dy: dy,
            size: size,
            opacity: 0.9 + Math.random() * 0.1, // Start mostly opaque
            frameCount: 20 + Math.floor(Math.random() * 10) // Random duration
        });
    }
    
    // Ensure animation loop is running
    if (!gameState.animationFrameId) {
        animateEffects();
    }
}

// Separate animation loop for all effects (UFOs and poofs)
function animateEffects() {
    // Update all animations
    updateFlyingUFOs();
    updatePoofEffects();
    
    // Redraw the board with updated animations
    drawBoard();
    
    // Continue animation if there are effects to animate
    if (gameState.flyingUFOs.length > 0 || gameState.poofEffects.length > 0) {
        gameState.animationFrameId = requestAnimationFrame(animateEffects);
    } else {
        gameState.animationFrameId = null;
    }
}

// Update poof effect particles
function updatePoofEffects() {
    for (let i = gameState.poofEffects.length - 1; i >= 0; i--) {
        const poof = gameState.poofEffects[i];
        
        // Move the particle
        poof.x += poof.dx;
        poof.y += poof.dy;
        
        // Reduce opacity
        poof.opacity -= 0.04; // Fade out quicker than UFOs
        
        // Decrement frame count
        poof.frameCount--;
        
        // Remove particle when it's very transparent or frame count ends
        if (poof.opacity <= 0 || poof.frameCount <= 0) {
            gameState.poofEffects.splice(i, 1);
        }
    }
}

// Draw the game board - only draw the visible portion
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Color mappings for adjacent ship numbers (adjusted for dark mode)
    const numberColors = config.darkMode ? [
        null,  // 0 has no number
        '#3498db',  // 1: brighter blue
        '#2ecc71',  // 2: brighter green
        '#e74c3c',  // 3: brighter red
        '#9b59b6',  // 4: purple
        '#e67e22',  // 5: orange
        '#1abc9c',  // 6: teal
        '#ecf0f1',  // 7: white
        '#bdc3c7'   // 8: light gray
    ] : [
        null,  // 0 has no number
        '#0000FF',  // 1: blue
        '#008000',  // 2: green
        '#FF0000',  // 3: red
        '#000080',  // 4: dark blue
        '#800000',  // 5: maroon
        '#008080',  // 6: teal
        '#000000',  // 7: black
        '#808080'   // 8: gray
    ];
    
    // Hardcode the colors instead of using CSS variables
    const boardBackground = config.darkMode ? '#0a1622' : '#87CEEB';
    const cellBorder = config.darkMode ? '#1c2833' : '#ADD8E6';
    const cloudColor = config.darkMode ? '#6c7a89' : '#ffffff';
    
    // Fill the entire board with background color and rounded corners
    ctx.fillStyle = boardBackground;
    
    // Use exactly 10px radius to match the CSS border-radius
    const boardCornerRadius = 10;
    
    // Draw a rounded rectangle for the board background
    // Extend the drawing area slightly beyond canvas edges to prevent hairline gaps
    ctx.beginPath();
    ctx.moveTo(boardCornerRadius, -1);
    ctx.lineTo(canvas.width - boardCornerRadius, -1);
    ctx.arcTo(canvas.width + 1, -1, canvas.width + 1, boardCornerRadius, boardCornerRadius);
    ctx.lineTo(canvas.width + 1, canvas.height - boardCornerRadius);
    ctx.arcTo(canvas.width + 1, canvas.height + 1, canvas.width - boardCornerRadius, canvas.height + 1, boardCornerRadius);
    ctx.lineTo(boardCornerRadius, canvas.height + 1);
    ctx.arcTo(-1, canvas.height + 1, -1, canvas.height - boardCornerRadius, boardCornerRadius);
    ctx.lineTo(-1, boardCornerRadius);
    ctx.arcTo(-1, -1, boardCornerRadius, -1, boardCornerRadius);
    ctx.closePath();
    ctx.fill();
    
    // First pass: Draw all revealed cells
    for (let bufferRow = config.hiddenBufferRows; bufferRow < config.rows + config.hiddenBufferRows; bufferRow++) {
        // Convert buffer row to visible row for drawing
        const visibleRow = bufferRow - config.hiddenBufferRows;
        
        for (let col = 0; col < config.cols; col++) {
            const cell = gameState.grid[bufferRow][col];
            const x = col * cellSize;
            const y = visibleRow * cellSize;
            
            if (cell.isRevealed) {
                // If it's a ship and game is over, display spaceship emoji
                if (cell.isShip && gameState.gameOver) {
                    ctx.font = `${Math.floor(cellSize * 0.7)}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('🛸', x + cellSize/2, y + cellSize/2);
                }
                // Draw heart if the cell has one
                else if (cell.hasHeart) {
                    ctx.font = `${Math.floor(cellSize * 0.7)}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('❤️', x + cellSize/2, y + cellSize/2);
                }
                // Draw number if cell has adjacent ships and isn't a ship
                else if (cell.adjacentShips > 0 && !cell.isShip) {
                    ctx.font = `bold ${Math.floor(cellSize * 0.6)}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = numberColors[cell.adjacentShips];
                    ctx.fillText(cell.adjacentShips.toString(), x + cellSize/2, y + cellSize/2);
                }
            }
        }
    }
    
    // Second pass: Draw all unrevealed cells (clouds)
    if (config.roundedClouds) {
        // Draw connected clouds
        drawConnectedClouds(cloudColor);
    } else {
        // Draw standard square clouds
        for (let bufferRow = config.hiddenBufferRows; bufferRow < config.rows + config.hiddenBufferRows; bufferRow++) {
            const visibleRow = bufferRow - config.hiddenBufferRows;
            for (let col = 0; col < config.cols; col++) {
                const cell = gameState.grid[bufferRow][col];
                const x = col * cellSize;
                const y = visibleRow * cellSize;
                
                if (!cell.isRevealed) {
                    // Unrevealed cell - covered with white/gray clouds (fog of war)
                    ctx.fillStyle = cloudColor;
                    ctx.fillRect(x, y, cellSize, cellSize);
                    ctx.strokeRect(x, y, cellSize, cellSize);
                    
                    // Draw mark if cell is marked
                    if (cell.isMarked) {
                        ctx.font = `${Math.floor(cellSize * 0.7)}px Arial`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('👾', x + cellSize/2, y + cellSize/2);
                    }
                }
            }
        }
    }
    
    // Draw flying UFOs
    gameState.flyingUFOs.forEach(ufo => {
        ctx.globalAlpha = ufo.opacity;
        ctx.font = `${Math.floor(cellSize * 1)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛸', ufo.x, ufo.y);
    });
    
    // Draw poof effects with color support
    drawPoofEffects();
    
    // Reset global opacity
    ctx.globalAlpha = 1.0;
}

// Find connected groups of cells
function findConnectedGroups(cells) {
    const groups = [];
    const visited = new Set();
    
    // Helper to create a unique key for a cell
    const cellKey = (row, col) => `${row},${col}`;
    
    // Create a map for quick lookup
    const cellMap = {};
    cells.forEach(cell => {
        cellMap[cellKey(cell.row, cell.col)] = cell;
    });
    
    // Find all cells in a connected group using flood fill
    function findGroup(startRow, startCol) {
        const group = [];
        const queue = [{ row: startRow, col: startCol }];
        visited.add(cellKey(startRow, startCol));
        
        while (queue.length > 0) {
            const current = queue.shift();
            group.push(current);
            
            // Check 4 adjacent cells (up, right, down, left)
            const neighbors = [
                { row: current.row - 1, col: current.col },
                { row: current.row, col: current.col + 1 },
                { row: current.row + 1, col: current.col },
                { row: current.row, col: current.col - 1 }
            ];
            
            for (const neighbor of neighbors) {
                const key = cellKey(neighbor.row, neighbor.col);
                if (cellMap[key] && !visited.has(key)) {
                    visited.add(key);
                    queue.push(neighbor);
                }
            }
        }
        
        return group;
    }
    
    // Find all groups
    for (const cell of cells) {
        const key = cellKey(cell.row, cell.col);
        if (!visited.has(key)) {
            const group = findGroup(cell.row, cell.col);
            groups.push(group);
        }
    }
    
    return groups;
}

// Draw connected cloud shapes with rounded edges
function drawConnectedClouds(cloudColor) {
    // First identify all unrevealed cells
    const unrevealedCells = [];
    
    for (let bufferRow = config.hiddenBufferRows; bufferRow < config.rows + config.hiddenBufferRows; bufferRow++) {
        const visibleRow = bufferRow - config.hiddenBufferRows;
        for (let col = 0; col < config.cols; col++) {
            if (!gameState.grid[bufferRow][col].isRevealed) {
                unrevealedCells.push({ row: visibleRow, col });
            }
        }
    }
    
    // Find cloud groups (connected unrevealed cells)
    const cellGroups = findConnectedGroups(unrevealedCells);
    
    // Draw each cloud group
    cellGroups.forEach(group => {
        drawCloudGroup(group, cloudColor);
    });
    
    // Draw marks on unrevealed cells
    for (let bufferRow = config.hiddenBufferRows; bufferRow < config.rows + config.hiddenBufferRows; bufferRow++) {
        const visibleRow = bufferRow - config.hiddenBufferRows;
        for (let col = 0; col < config.cols; col++) {
            const cell = gameState.grid[bufferRow][col];
            if (!cell.isRevealed && cell.isMarked) {
                const x = col * cellSize;
                const y = visibleRow * cellSize;
                ctx.font = `${Math.floor(cellSize * 0.7)}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('👾', x + cellSize/2, y + cellSize/2);
            }
        }
    }
}

// Draw a single cloud group with rounded edges
function drawCloudGroup(group, cloudColor) {
    // First clear the background under the cloud group for proper transparency
    const boardBackground = config.darkMode ? '#0a1622' : '#87CEEB';
    ctx.fillStyle = boardBackground;
    
    group.forEach(cell => {
        const x = cell.col * cellSize;
        const y = cell.row * cellSize;
        ctx.fillRect(x, y, cellSize, cellSize);
    });
    
    ctx.fillStyle = cloudColor;
    
    // Use exactly 10px to match the board corner radius
    const radius = 10; // Use exact pixel value instead of cellSize/4
    
    group.forEach(cell => {
        const x = cell.col * cellSize;
        const y = cell.row * cellSize;
        
        // Helper to check if a cell is in the group
        const isInGroup = (row, col) => {
            return group.some(c => c.row === row && c.col === col);
        };
        
        // Check adjacent cells to determine which corners to round
        const hasLeft = isInGroup(cell.row, cell.col - 1);
        const hasRight = isInGroup(cell.row, cell.col + 1);
        const hasTop = isInGroup(cell.row - 1, cell.col);
        const hasBottom = isInGroup(cell.row + 1, cell.col);
        
        // Also check diagonals to determine corner rounding
        const hasTopLeft = isInGroup(cell.row - 1, cell.col - 1);
        const hasTopRight = isInGroup(cell.row - 1, cell.col + 1);
        const hasBottomLeft = isInGroup(cell.row + 1, cell.col - 1);
        const hasBottomRight = isInGroup(cell.row + 1, cell.col + 1);
        
        // Draw based on adjacency
        ctx.beginPath();
        
        // Top left corner
        if (!hasTop && !hasLeft && !hasTopLeft) {
            ctx.moveTo(x, y + radius);
            ctx.arcTo(x, y, x + radius, y, radius);
        } else {
            ctx.moveTo(x, y);
        }
        
        // Top right corner
        if (!hasTop && !hasRight && !hasTopRight) {
            ctx.lineTo(x + cellSize - radius, y);
            ctx.arcTo(x + cellSize, y, x + cellSize, y + radius, radius);
        } else {
            ctx.lineTo(x + cellSize, y);
        }
        
        // Bottom right corner
        if (!hasBottom && !hasRight && !hasBottomRight) {
            ctx.lineTo(x + cellSize, y + cellSize - radius);
            ctx.arcTo(x + cellSize, y + cellSize, x + cellSize - radius, y + cellSize, radius);
        } else {
            ctx.lineTo(x + cellSize, y + cellSize);
        }
        
        // Bottom left corner
        if (!hasBottom && !hasLeft && !hasBottomLeft) {
            ctx.lineTo(x + radius, y + cellSize);
            ctx.arcTo(x, y + cellSize, x, y + cellSize - radius, radius);
        } else {
            ctx.lineTo(x, y + cellSize);
        }
        
        ctx.closePath();
        ctx.fill();
    });
}

// Handle mouse click on the canvas
function handleCanvasClick(event) {
    if (!gameState.gameStarted || gameState.gameOver) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    const col = Math.floor(clickX / cellSize);
    const visibleRow = Math.floor(clickY / cellSize);
    
    // Convert visible row to buffer row
    const bufferRow = visibleRow + config.hiddenBufferRows;
    
    // Check if click is within bounds
    if (visibleRow >= 0 && visibleRow < config.rows && col >= 0 && col < config.cols) {
        const cell = gameState.grid[bufferRow][col];
        
        // Left click to reveal, right click to mark
        if (event.button === 0) { // Left click
            // If cell is already marked, don't reveal
            if (cell.isMarked) return;
            
            // Check if clicking on a heart
            if (cell.hasHeart) {
                collectHeart();
                cell.hasHeart = false; // Remove the heart
                
                // Add score for collecting a heart
                gameState.score += 10;
                updateScore();
                drawBoard();
                return;
            }
            
            // Reveal cell
            if (!cell.isRevealed) {
                // Create poof effect at the clicked location
                createPoofEffect(visibleRow, col);
                
                if (cell.isShip) {
                    // Clicking on a ship loses life
                    reduceLives();
                    // Create UFO flying away animation at the visual position
                    createFlyingUFO(visibleRow, col);
                    cell.isShip = false; // Remove the ship
                    cell.isRevealed = true; // Reveal this cell
                    
                    // Update destroyed ships count
                    gameState.destroyedShips++;
                    // Count as escaped when clicked (flies away)
                    gameState.escapedShips++;
                    updateShipsCounter();
                } else {
                    // Use the full recursive flood fill to reveal connected empty cells
                    floodFill(bufferRow, col);
                    
                    // Add score for revealing cells
                    gameState.score += 1;
                    updateScore();
                }
            }
        } else if (event.button === 2) { // Right click
            // Only allow marking unrevealed cells
            if (!cell.isRevealed) {
                // Toggle cell marking (no limit on marks)
                cell.isMarked = !cell.isMarked;
                
                // Check if a ship was correctly marked (add score)
                if (cell.isMarked && cell.isShip) {
                    gameState.score += 5;
                    updateScore();
                }
            }
        }
        
        drawBoard();
    }
}

// Spawn a new ship in the top row
function spawnNewShip() {
    if (gameState.shipsSpawned >= gameState.shipsInWave) return;
    
    // Calculate current row distribution limit based on wave
    const rowDistributionLimit = Math.min(config.maxShipSpawnRows + Math.floor((gameState.wave - 1) / 2), 7);
    
    // Don't exceed row distribution limit
    if (gameState.movementCount > rowDistributionLimit) {
        // Force place all remaining ships
        while (gameState.shipsSpawned < gameState.shipsInWave) {
            const col = Math.floor(Math.random() * config.cols);
            if (!gameState.grid[0][col].isShip) {
                gameState.grid[0][col].isShip = true;
                gameState.grid[0][col].isRevealed = false; // Keep hidden
                gameState.shipsSpawned++;
            }
        }
        return;
    }
    
    // Try to place a ship in a random column of the top hidden row
    const maxAttempts = 10;
    let attempts = 0;
    let placed = false;
    
    // Check for columns with multiple consecutive high numbers
    const avoidColumns = [];
    
    // Count consecutive 3s in existing rows but be less restrictive
    for (let col = 0; col < config.cols; col++) {
        let count = 0;
        for (let row = 0; row < Math.min(3, config.hiddenBufferRows); row++) {
            if (gameState.grid[row][col].adjacentShips >= 3) {
                count++;
            }
        }
        
        // Only avoid if there are multiple high-value cells in a column
        if (count >= 2) {
            avoidColumns.push(col);
            // Don't avoid adjacent columns as much, just the exact column with multiple 3s
        }
    }
    
    // Prefer random placement 40% of the time (reduced from 60% to encourage clustering)
    if (Math.random() < 0.4) {
        while (!placed && attempts < maxAttempts) {
            const col = Math.floor(Math.random() * config.cols);
            
            // Avoid columns that would create rows of 3s
            if (avoidColumns.includes(col)) {
                attempts++;
                continue;
            }
            
            if (!gameState.grid[0][col].isShip) {
                gameState.grid[0][col].isShip = true;
                gameState.grid[0][col].isRevealed = false; // Keep hidden
                gameState.shipsSpawned++;
                placed = true;
            }
            attempts++;
        }
    } 
    // Try cluster placement with higher probability (60%)
    else {
        // Find existing ships in top 4 rows to cluster with
        const existingShipColumns = [];
        for (let r = 0; r < 4 && r < config.hiddenBufferRows; r++) {
            for (let c = 0; c < config.cols; c++) {
                if (gameState.grid[r][c].isShip && !avoidColumns.includes(c)) {
                    existingShipColumns.push(c);
                }
            }
        }
        
        // If we found suitable existing ships, try to place near one
        if (existingShipColumns.length > 0) {
            const targetCol = existingShipColumns[Math.floor(Math.random() * existingShipColumns.length)];
            
            // Prioritize creating clusters by trying same column first, then adjacent columns
            const possibleCols = [
                targetCol, // Same column has highest priority for clustering
                Math.max(0, targetCol - 1),
                Math.min(config.cols - 1, targetCol + 1)
            ];
            
            for (let col of possibleCols) {
                if (!gameState.grid[0][col].isShip && !avoidColumns.includes(col)) {
                    gameState.grid[0][col].isShip = true;
                    gameState.grid[0][col].isRevealed = false; // Keep hidden
                    gameState.shipsSpawned++;
                    placed = true;
                    break;
                }
            }
        }
    }
    
    // If we still haven't placed a ship, use any available column
    if (!placed) {
        // Try to place in a column with an existing ship above it first
        const columnsWithShips = [];
        for (let col = 0; col < config.cols; col++) {
            for (let row = 1; row < config.hiddenBufferRows; row++) {
                if (gameState.grid[row][col].isShip) {
                    columnsWithShips.push(col);
                    break;
                }
            }
        }
        
        // If we have columns with ships, prioritize them
        if (columnsWithShips.length > 0 && Math.random() < 0.7) {
            const col = columnsWithShips[Math.floor(Math.random() * columnsWithShips.length)];
            if (!gameState.grid[0][col].isShip) {
                gameState.grid[0][col].isShip = true;
                gameState.grid[0][col].isRevealed = false;
                gameState.shipsSpawned++;
            }
        }
        
        // If still not placed, use any available column
        if (!placed) {
            const availableCols = [];
            for (let col = 0; col < config.cols; col++) {
                if (!gameState.grid[0][col].isShip) {
                    availableCols.push(col);
                }
            }
            
            if (availableCols.length > 0) {
                const randomCol = availableCols[Math.floor(Math.random() * availableCols.length)];
                gameState.grid[0][randomCol].isShip = true;
                gameState.grid[0][randomCol].isRevealed = false;
                gameState.shipsSpawned++;
            }
        }
    }
    
    // Recalculate adjacent ships
    calculateAdjacentShips();
}

// Initialize the game grid
function initializeGrid() {
    gameState.grid = [];
    
    // Create grid with buffer rows (not visible to player)
    for (let row = 0; row < config.rows + config.hiddenBufferRows; row++) {
        gameState.grid[row] = [];
        for (let col = 0; col < config.cols; col++) {
            gameState.grid[row][col] = {
                isShip: false,
                isRevealed: row >= config.hiddenBufferRows, // Only reveal visible rows
                isMarked: false,
                adjacentShips: 0,
                hasHeart: false
            };
        }
    }
}

// Generate ships for a wave
function generateWave() {
    // Clear any existing ships but don't hide cells that are already on the board
    for (let row = 0; row < config.rows + config.hiddenBufferRows; row++) {
        for (let col = 0; col < config.cols; col++) {
            gameState.grid[row][col].isShip = false;
            gameState.grid[row][col].isMarked = false;
            gameState.grid[row][col].hasHeart = false;
            
            // Only visible rows are revealed
            if (row >= config.hiddenBufferRows) {
                gameState.grid[row][col].isRevealed = true;
            } else {
                gameState.grid[row][col].isRevealed = false; // Hidden buffer rows
            }
            
            gameState.grid[row][col].adjacentShips = 0;
        }
    }
    
    // Calculate number of ships for current wave
    gameState.shipsInWave = config.waveBaseShips + (gameState.wave - 1) * config.waveIncreaseShips;
    
    // Calculate how many rows to distribute ships across based on wave number
    // This scales with the number of ships to maintain consistent density
    const rowsToDistribute = Math.min(config.maxShipSpawnRows + Math.floor((gameState.wave - 1) / 2), 7);
    
    gameState.shipsSpawned = 0;
    gameState.movementCount = 0;
    gameState.heartPlaced = false;
    gameState.destroyedShips = 0;
    gameState.escapedShips = 0;
    
    gameState.waveActive = true;
    
    // Place initial ships only in the hidden buffer rows (not visible to player yet)
    const initialShips = Math.min(Math.ceil(gameState.shipsInWave * 0.4), 6); // Reduced from 8 to 6
    let attempts = 0;
    const maxAttempts = 50;
    
    while (gameState.shipsSpawned < initialShips && attempts < maxAttempts) {
        // Place ships only in the hidden buffer rows
        const row = Math.floor(Math.random() * config.hiddenBufferRows);
        const col = Math.floor(Math.random() * config.cols);
        
        // Make sure we don't place on top of another ship
        if (!gameState.grid[row][col].isShip) {
            gameState.grid[row][col].isShip = true;
            gameState.grid[row][col].isRevealed = false; // Hide cells with ships
            gameState.shipsSpawned++;
        }
        
        attempts++;
    }
    
    // Place a heart if player has lost lives
    placeHeartInWave();
    
    // Calculate adjacent ships
    calculateAdjacentShips();
    
    updateShipsCounter();
}

// Calculate adjacent ships for all cells
function calculateAdjacentShips() {
    for (let row = 0; row < config.rows + config.hiddenBufferRows; row++) {
        for (let col = 0; col < config.cols; col++) {
            if (!gameState.grid[row][col].isShip) {
                let count = 0;
                
                // Check all 8 adjacent cells
                for (let r = Math.max(0, row - 1); r <= Math.min(config.rows + config.hiddenBufferRows - 1, row + 1); r++) {
                    for (let c = Math.max(0, col - 1); c <= Math.min(config.cols - 1, col + 1); c++) {
                        if (r !== row || c !== col) { // Skip the cell itself
                            if (gameState.grid[r][c].isShip) {
                                count++;
                            }
                        }
                    }
                }
                
                gameState.grid[row][col].adjacentShips = count;
            }
        }
    }
}

// Move the grid down
function moveGridDown() {
    // Check the visible bottom row for unmarked ships and incorrectly marked cells
    const bottomVisibleRow = config.rows + config.hiddenBufferRows - 1;
    const bottomRow = [...gameState.grid[bottomVisibleRow]];
    
    // Track positions for UFOs to create
    let bottomUFOs = [];
    let shipsEscaped = false;
    
    // Check bottom row for ships and marks
    for (let col = 0; col < config.cols; col++) {
        const cell = bottomRow[col];
        
        if (cell.isShip && !cell.isMarked) {
            // If unmarked ship reaches bottom, track for UFO animation and lose life
            bottomUFOs.push(col);
            reduceLives();
            shipsEscaped = true;
            gameState.destroyedShips++; // Count as destroyed
            gameState.escapedShips++;   // Count as escaped
        } else if (cell.isShip && cell.isMarked) {
            // If marked ship reaches bottom, it counts as destroyed and create poof effect
            shipsEscaped = true;
            gameState.destroyedShips++; // Count as destroyed
            
            // Create poof effect for marked ship
            const visibleRow = config.rows - 1;
            createPoofEffect(visibleRow, col);
        } else if (!cell.isShip && cell.isMarked) {
            // If incorrectly marked cell reaches bottom, player loses a life
            reduceLives();
            // Create a visual effect for incorrect mark
            createIncorrectMarkEffect(config.rows - 1, col);
        }
        
        // Check if a heart was missed and left the board
        if (cell.hasHeart) {
            // Heart leaves the board without being collected
            cell.hasHeart = false;
        }
    }
    
    // Move everything down
    for (let row = config.rows + config.hiddenBufferRows - 1; row > 0; row--) {
        for (let col = 0; col < config.cols; col++) {
            // Copy cell from above
            gameState.grid[row][col] = { ...gameState.grid[row - 1][col] };
        }
    }
    
    // Clear the top row (hidden buffer) - always hidden for fog of war effect
    for (let col = 0; col < config.cols; col++) {
        gameState.grid[0][col] = {
            isShip: false,
            isRevealed: false, // Always hide new cells for fog of war effect
            isMarked: false,
            adjacentShips: 0,
            hasHeart: false
        };
    }
    
    // Create flying UFOs for unmarked ships that reached bottom
    for (let col of bottomUFOs) {
        // Convert to visible coordinates for UFO
        const visibleRow = config.rows - 1;
        createFlyingUFO(visibleRow, col);
    }
    
    // Spawn new ships in top row if needed
    gameState.movementCount++;
    if (gameState.waveActive && gameState.shipsSpawned < gameState.shipsInWave && 
        gameState.movementCount % config.shipSpawnInterval === 0) {
        spawnNewShip();
    }
    
    // Chance to place a heart if one hasn't been placed yet in this wave
    // and player has lost at least one heart
    if (gameState.waveActive && !gameState.heartPlaced && 
        gameState.lives < config.startingLives &&
        gameState.movementCount > 5 && Math.random() < 0.05) {
        placeHeartInWave();
    }
    
    // Recalculate adjacent ships after grid movement
    calculateAdjacentShips();
    
    // Update the ships counter if ships escaped (always update to be safe)
    if (shipsEscaped) {
        updateShipsCounter();
    }
    
    // Check if wave is complete (no more ships on board and all ships spawned)
    if (gameState.waveActive && gameState.shipsSpawned >= gameState.shipsInWave && !hasShipsOnBoard()) {
        gameState.waveActive = false;
        gameState.wave++;
        gameState.score += gameState.wave * 10; // Score bonus for completing a wave
        updateScore();
        
        // Increase speed for the next wave
        gameState.currentSpeed = Math.max(
            config.minSpeed,
            config.waveBaseSpeed - ((gameState.wave - 1) * config.waveSpeedIncrease)
        );
        
        // Only show wave notification if game is not over
        if (!gameState.gameOver) {
            // Show next wave notification
            showWaveNotification();
            
            // Schedule next wave
            gameState.nextWaveTimeout = setTimeout(() => {
                generateWave();
            }, config.wavePauseTime);
        }
    }
    
    // Redraw the board after moving
    drawBoard();
}

// Check if there are still ships on the board
function hasShipsOnBoard() {
    for (let row = 0; row < config.rows + config.hiddenBufferRows; row++) {
        for (let col = 0; col < config.cols; col++) {
            if (gameState.grid[row][col].isShip) {
                return true;
            }
        }
    }
    return false;
}

// Create flying UFO effect
function createFlyingUFO(visibleRow, col) {
    const x = col * cellSize + cellSize / 2;
    const y = visibleRow * cellSize + cellSize / 2;
    
    // Random direction for the UFO to fly
    const angle = Math.random() * Math.PI * 2; // Random angle in radians
    const speed = 2 + Math.random() * 2; // Slightly higher speed (2-4 pixels per frame)
    
    // UFO movement direction
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;
    
    // Add flying UFO to the array
    gameState.flyingUFOs.push({
        x: x,
        y: y,
        dx: dx,
        dy: dy,
        opacity: 1.0,
        frameCount: 60 // Show for 60 frames (about 1 second)
    });
    
    // Ensure animation loop is running
    if (!gameState.animationFrameId) {
        animateEffects();
    }
}

// Update and animate flying UFOs
function updateFlyingUFOs() {
    for (let i = gameState.flyingUFOs.length - 1; i >= 0; i--) {
        const ufo = gameState.flyingUFOs[i];
        
        // Move the UFO
        ufo.x += ufo.dx;
        ufo.y += ufo.dy;
        
        // Reduce opacity
        ufo.opacity -= 0.016; // More gradual fade (about 60 frames to disappear)
        
        // Decrement frame count
        ufo.frameCount--;
        
        // Remove UFO when it's very transparent or frame count ends
        if (ufo.opacity <= 0 || ufo.frameCount <= 0) {
            gameState.flyingUFOs.splice(i, 1);
        }
    }
}

// Reduce player lives
function reduceLives() {
    gameState.lives--;
    
    updateLivesDisplay();
    
    if (gameState.lives <= 0) {
        endGame("Game Over - Out of Lives!");
    }
}

// Update the lives display
function updateLivesDisplay() {
    const heartArray = Array.from(heartElements);
    const numHearts = heartArray.length;
    
    // Process hearts in reverse DOM order (right to left)
    // so that when lives decrease, leftmost hearts disappear first
    for (let i = 0; i < numHearts; i++) {
        // numHearts - i - 1 starts from the right
        // gameState.lives starts counting from the left
        // So when gameState.lives is 3, all hearts are active
        // When gameState.lives is 2, the leftmost heart becomes inactive
        if (numHearts - i <= gameState.lives) {
            heartArray[i].innerHTML = '❤️';
            heartArray[i].style.opacity = 1;
        } else {
            heartArray[i].innerHTML = '❤️';
            heartArray[i].style.opacity = 0.2;
        }
    }
}

// Update the score display
function updateScore() {
    scoreElement.textContent = `Score: ${gameState.score}`;
}

// Update the wave indicator
function updateWaveIndicator() {
    waveIndicator.textContent = `Wave: ${gameState.wave}`;
}

// Show wave notification
function showWaveNotification() {
    // Don't show notification if game is over
    if (gameState.gameOver) return;
    
    // Remove any existing notification
    const existingNotification = document.querySelector('.wave-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create new notification - fix wave number (current wave - 1 was completed)
    const notification = document.createElement('div');
    notification.className = 'wave-notification';
    notification.textContent = `Wave ${gameState.wave - 1} Completed!
                               Wave ${gameState.wave} incoming in 5...`;
    
    // Append to game-container instead of body for proper positioning
    document.querySelector('.game-container').appendChild(notification);
    
    // Countdown timer
    let countdown = 4;
    const countdownInterval = setInterval(() => {
        // Check if game has ended during countdown
        if (gameState.gameOver) {
            clearInterval(countdownInterval);
            notification.remove();
            return;
        }
        
        notification.textContent = `Wave ${gameState.wave - 1} Completed!
                                   Wave ${gameState.wave} incoming in ${countdown}...`;
        countdown--;
        
        if (countdown < 0) {
            clearInterval(countdownInterval);
            notification.remove();
            updateWaveIndicator();
        }
    }, 1000);
}

// End the game
function endGame(message) {
    gameState.gameOver = true;
    gameState.gameStarted = false;
    clearInterval(gameState.movementInterval);
    clearTimeout(gameState.nextWaveTimeout);
    
    // Cancel any ongoing animation
    if (gameState.animationFrameId) {
        cancelAnimationFrame(gameState.animationFrameId);
        gameState.animationFrameId = null;
    }
    
    // Reveal all ships on the board
    for (let row = 0; row < config.rows + config.hiddenBufferRows; row++) {
        for (let col = 0; col < config.cols; col++) {
            const cell = gameState.grid[row][col];
            if (cell.isShip) {
                // Mark as revealed but keep the ship
                cell.isRevealed = true;
            }
        }
    }
    
    // Redraw the board to show all ships
    drawBoard();
    
    const gameOverElement = document.createElement('div');
    gameOverElement.className = 'game-over';
    gameOverElement.innerHTML = `
        <h2>Game Over</h2>
        <p>Out of Lives!</p>
        <p>Final Score: ${gameState.score}</p>
        <p>Waves Survived: ${gameState.wave}</p>
        <button id="restartButton">Play Again</button>
    `;
    
    // Append to game-container instead of body for proper positioning
    document.querySelector('.game-container').appendChild(gameOverElement);
    
    document.getElementById('restartButton').addEventListener('click', () => {
        gameOverElement.remove();
        resetGame();
        startGame();
    });
}

// Reset the game
function resetGame() {
    gameState.lives = config.startingLives;
    gameState.wave = 1;
    gameState.score = 0;
    gameState.gameOver = false;
    gameState.waveActive = false;
    gameState.currentSpeed = config.waveBaseSpeed;
    gameState.flyingUFOs = [];
    gameState.poofEffects = [];
    gameState.heartPlaced = false;
    gameState.destroyedShips = 0;
    gameState.escapedShips = 0;
    
    // Cancel any ongoing animation
    if (gameState.animationFrameId) {
        cancelAnimationFrame(gameState.animationFrameId);
        gameState.animationFrameId = null;
    }
    
    // Make the start button visible again
    startButton.style.display = 'block';
    
    updateLivesDisplay();
    updateScore();
    updateWaveIndicator();
    
    initializeGrid();
    drawBoard();
}

// Flood fill to reveal connected empty cells
function floodFill(row, col) {
    // If out of bounds, return
    if (row < 0 || row >= config.rows + config.hiddenBufferRows || col < 0 || col >= config.cols) {
        return;
    }
    
    const cell = gameState.grid[row][col];
    
    // If already revealed or is a ship or is marked, return
    if (cell.isRevealed || cell.isShip || cell.isMarked) {
        return;
    }
    
    // Reveal this cell
    cell.isRevealed = true;
    
    // If this cell has no adjacent ships, reveal all 8 neighbors
    if (cell.adjacentShips === 0) {
        for (let r = Math.max(0, row-1); r <= Math.min(config.rows + config.hiddenBufferRows - 1, row+1); r++) {
            for (let c = Math.max(0, col-1); c <= Math.min(config.cols-1, col+1); c++) {
                if (!(r === row && c === col)) {
                    floodFill(r, c);
                }
            }
        }
    }
}

// Collect a heart - restore one lost heart
function collectHeart() {
    if (gameState.lives < config.startingLives) {
        // Restore a lost heart
        gameState.lives++;
        updateLivesDisplay();
    }
}

// Handle right-click context menu (prevent it)
function handleContextMenu(event) {
    event.preventDefault();
    return false;
}

// Start the game
function startGame() {
    if (gameState.gameStarted) return;
    
    gameState.gameStarted = true;
    
    // Hide the start button instead of disabling it
    startButton.style.display = 'none';
    
    // Ensure we start with the base speed for first wave
    gameState.currentSpeed = config.waveBaseSpeed;
    
    // Setup first wave
    generateWave();
    
    // Start grid movement
    gameState.movementInterval = setInterval(moveGridDown, gameState.currentSpeed);
}

// Toggle dark mode
function toggleDarkMode() {
    config.darkMode = !config.darkMode;
    
    // Toggle the dark-mode class on the body
    document.body.classList.toggle('dark-mode');
    
    // Update the button emoji
    const darkModeButton = document.getElementById('darkModeToggle');
    darkModeButton.textContent = config.darkMode ? '🌙' : '☀️';
    
    // Redraw the board with the new color scheme
    drawBoard();
}

// Update ships counter
function updateShipsCounter() {
    const remainingShips = gameState.shipsInWave - gameState.destroyedShips;
    shipsCounterElement.textContent = `Ships: ${remainingShips} (${gameState.escapedShips} escaped)`;
}

// Create a visual effect for incorrect mark
function createIncorrectMarkEffect(visibleRow, col) {
    // Red X effect for incorrect mark
    const x = col * cellSize + cellSize / 2;
    const y = visibleRow * cellSize + cellSize / 2;
    
    // Add a red flash effect
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fillRect(col * cellSize, visibleRow * cellSize, cellSize, cellSize);
    
    // Create poof effect in red
    const particleCount = 8 + Math.floor(Math.random() * 4);
    
    for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const speed = 1 + Math.random() * 1.5;
        const size = Math.max(3, Math.floor(cellSize / 8 + Math.random() * (cellSize / 6)));
        
        const dx = Math.cos(angle) * speed;
        const dy = Math.sin(angle) * speed;
        
        gameState.poofEffects.push({
            x: x,
            y: y,
            dx: dx,
            dy: dy,
            size: size,
            opacity: 0.9 + Math.random() * 0.1,
            frameCount: 20 + Math.floor(Math.random() * 10),
            color: '#ff0000' // Red for incorrect marks
        });
    }
    
    // Ensure animation loop is running
    if (!gameState.animationFrameId) {
        animateEffects();
    }
}

// Draw poof effects with color support
function drawPoofEffects() {
    gameState.poofEffects.forEach(poof => {
        ctx.globalAlpha = poof.opacity;
        ctx.fillStyle = poof.color || (config.darkMode ? '#ecf0f1' : '#FFFFFF');
        ctx.beginPath();
        ctx.arc(poof.x, poof.y, poof.size, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Reset global opacity
    ctx.globalAlpha = 1.0;
}

// Initialize the game
function initializeGame() {
    calculateCellSize();
    initializeGrid();
    drawBoard();
    updateLivesDisplay();
    
    // Add event listeners
    canvas.addEventListener('mousedown', handleCanvasClick);
    canvas.addEventListener('contextmenu', handleContextMenu);
    startButton.addEventListener('click', startGame);
    
    // Add dark mode toggle listener
    const darkModeButton = document.getElementById('darkModeToggle');
    darkModeButton.addEventListener('click', toggleDarkMode);
    
    // Handle window resize
    window.addEventListener('resize', () => {
        calculateCellSize();
        drawBoard();
    });
}

// Initialize game when page loads
window.addEventListener('load', initializeGame); 