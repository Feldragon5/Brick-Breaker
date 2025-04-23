// Wrap the entire game logic in an IIFE to avoid polluting the global scope
(function () {
	const canvas = document.getElementById("gameCanvas");
	const ctx = canvas.getContext("2d");
	const debugIndicator = document.getElementById("debugIndicator");

	// --- Game Constants ---
	const PADDLE_HEIGHT = 12;
	const PADDLE_WIDTH = 90;
	const PADDLE_BOTTOM_MARGIN = 20; // Space between paddle and bottom edge
	const BALL_RADIUS = 8;
	const BRICK_ROW_COUNT = 18; // Total rows generated (including off-screen initially)
	const BRICK_COLUMN_COUNT = 7;
	const BRICK_WIDTH = 45;
	const BRICK_HEIGHT = 20;
	const BRICK_PADDING = 8;
	const BRICK_OFFSET_TOP = 60; // Space for UI elements at the top
	const BRICK_OFFSET_LEFT = // Calculated dynamically for centering
		(canvas.width -
			(BRICK_COLUMN_COUNT * (BRICK_WIDTH + BRICK_PADDING) -
				BRICK_PADDING)) /
		2;
	const ROW_HEIGHT = BRICK_HEIGHT + BRICK_PADDING; // Total height of a brick row including padding

	const PADDLE_SPEED = 7;
	const INITIAL_BALL_SPEED_X = 4; // Base horizontal speed
	const INITIAL_BALL_SPEED_Y = -5; // Base vertical speed (negative is upwards)

	// --- UI Constants ---
	const UI_TOP_PADDING = 15; // Padding from the top edge for UI elements
	const PAUSE_BUTTON_SIZE = 30;
	const PAUSE_BUTTON_X = (canvas.width - PAUSE_BUTTON_SIZE) / 2; // Centered horizontally
	const PAUSE_BUTTON_Y = UI_TOP_PADDING; // Positioned near the top
	const PAUSE_ICON_COLOR = "#e0e0e0";
	const PAUSE_BUTTON_BG = "rgba(255, 255, 255, 0.1)"; // Semi-transparent white
	const MESSAGE_BG_COLOR = "rgba(30, 30, 30, 0.85)"; // Dark semi-transparent for messages
	const MESSAGE_STRIPE_HEIGHT = 100; // Height of the message background stripe

	// --- Particle Effects Constants ---
	const PARTICLE_COUNT = 10; // Number of particles per brick break
	const PARTICLE_LIFE = 30; // Duration particles last (in frames)
	const PARTICLE_SPEED_FACTOR = 2.0;
	const PARTICLE_SIZE = 2.0;

	// --- Brick Shatter Effects Constants ---
	const NUM_SHATTER_PIECES = 5; // Number of shard pieces per brick break
	const SHATTER_GRAVITY = 0.2;
	const SHATTER_INITIAL_DX_RANGE = 2.0; // Horizontal velocity range
	const SHATTER_INITIAL_DY_RANGE = 2.5; // Vertical velocity range
	const SHATTER_ROTATION_SPEED_RANGE = 0.15; // Rotation speed range
	const SHARD_SIZE_FACTOR = 0.75; // Size relative to brick dimensions
	const SHARD_ALPHA = 0.75; // Opacity of shards
	const SHARD_DARKEN_FACTOR = 0.75; // How much to darken shard color from original brick

	// --- Gameplay Constants ---
	const LAUNCH_DELAY_FRAMES = 50; // Frames to wait before auto-launching ball
	const ROW_ANIMATION_SPEED = 8; // Pixels per frame the rows shift down
	const SCORE_FOR_EXTRA_LIFE = 50; // Points needed to gain an extra life

	// --- Colors ---
	const BG_COLOR = "#1e1e1e"; // Canvas background
	const PADDLE_COLOR = "#bdc3c7"; // Silver-grey
	const BALL_COLOR = "#ffffff"; // White
	const TEXT_COLOR = "#e0e0e0"; // Light grey for UI text
	const GAMEOVER_COLOR = "#e74c3c"; // Red
	const PAUSE_COLOR = "#3498db"; // Blue
	const BRICK_OUTLINE_COLOR = "rgba(0, 0, 0, 0.2)"; // Subtle outline for bricks
	const availableColors = [
		// Pool of colors for bricks
		"#e74c3c", // Red
		"#3498db", // Blue
		"#2ecc71", // Green
		"#f1c40f", // Yellow
		"#9b59b6", // Purple
		"#1abc9c", // Teal
		"#e67e22", // Orange
		"#34ace0", // Light Blue
		"#ff7f50", // Coral
		"#ff6b81", // Pink
	];

	// --- Game State Variables ---
	let ball = {};
	let paddle = {};
	let bricks = [];
	let particles = []; // For small square particle effects
	let shatterPieces = []; // For larger triangular shard effects
	let score = 0;
	let lives = 3;
	let isGameOver = false;
	let animationFrameId = null; // Stores the requestAnimationFrame ID
	let rightPressed = false; // Keyboard state
	let leftPressed = false; // Keyboard state
	let rowsAdvanced = 0; // Tracks how many rows have been shifted down
	let isPaused = false;
	let waitingToLaunch = true; // Is the ball waiting on the paddle?
	let launchDelayTimer = 0; // Countdown timer for auto-launch

	// --- Touch State Variables ---
	let isTouchActive = false; // Is a touch currently controlling the paddle?
	let touchTargetX = null; // The X-coordinate the paddle is trying to reach via touch

	// --- Debug State ---
	let isDebugMode = false;
	let debugSpeedMultiplier = 1; // Multiplier for ball speed in debug mode

	// --- Row Animation State ---
	let isAnimatingRows = false; // Are the bricks currently shifting down?
	let animationTargetY = 0; // The target Y offset for the row animation
	let animationCurrentY = 0; // The current Y offset during animation
	let rowsToShiftAmount = 0; // How many rows need to be shifted

	// --- Initialization Functions ---

	// Initialize or reset the game state
	function initGame() {
		score = 0;
		rowsAdvanced = 0;
		lives = 3;
		isGameOver = false;
		isPaused = false;
		debugSpeedMultiplier = isDebugMode ? 5 : 1; // Set speed based on debug mode
		particles = [];
		shatterPieces = [];
		rightPressed = false;
		leftPressed = false;
		isTouchActive = false;
		touchTargetX = null;
		isAnimatingRows = false;
		animationTargetY = 0;
		animationCurrentY = 0;
		rowsToShiftAmount = 0;

		// Reset ball position and state for launch
		resetBallForLaunch();

		// Initialize paddle position (only set initial x if not already set)
		if (paddle.x === undefined) {
			paddle.x = (canvas.width - PADDLE_WIDTH) / 2;
		}
		paddle.y = canvas.height - PADDLE_HEIGHT - PADDLE_BOTTOM_MARGIN;
		paddle.width = PADDLE_WIDTH;
		paddle.height = PADDLE_HEIGHT;
		paddle.color = PADDLE_COLOR;

		// Create the initial grid of bricks
		bricks = [];
		for (let c = 0; c < BRICK_COLUMN_COUNT; c++) {
			bricks[c] = [];
			for (let r = 0; r < BRICK_ROW_COUNT; r++) {
				bricks[c][r] = createBrick(c, r);
			}
		}

		// Start the game loop if it's not already running
		if (!animationFrameId || isGameOver) {
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId); // Stop previous loop if any
			}
			animationFrameId = null;
			gameLoop();
		}
		// Show/hide the debug indicator based on the mode
		debugIndicator.style.display = isDebugMode ? "block" : "none";
	}

	// Reset the ball to its starting position on the paddle
	function resetBallForLaunch(keepCurrentPos = false) {
		if (!keepCurrentPos) {
			ball.x = canvas.width / 2;
			ball.y = canvas.height - 80; // Position above the paddle area
		}
		ball.dx = 0; // No initial movement
		ball.dy = 0;
		ball.radius = BALL_RADIUS;
		ball.color = BALL_COLOR;
		waitingToLaunch = true; // Set flag to wait for launch
		launchDelayTimer = LAUNCH_DELAY_FRAMES; // Start auto-launch timer
	}

	// Create a single brick object at a given column and row
	function createBrick(c, r) {
		const brickX = c * (BRICK_WIDTH + BRICK_PADDING) + BRICK_OFFSET_LEFT;
		const brickY = r * ROW_HEIGHT + BRICK_OFFSET_TOP;
		// Pick a random color from the available pool
		const colorIndex = Math.floor(Math.random() * availableColors.length);
		return {
			x: brickX,
			y: brickY,
			width: BRICK_WIDTH,
			height: BRICK_HEIGHT,
			color: availableColors[colorIndex],
		};
	}

	// --- Helper Function ---

	// Convert Hex color to RGBA, optionally darkening it
	function hexToRgba(hex, alpha = 1, darkenFactor = 1) {
		let r = 0,
			g = 0,
			b = 0;
		// Handle shorthand hex (e.g., #03F)
		if (hex.length == 4) {
			r = parseInt(hex[1] + hex[1], 16);
			g = parseInt(hex[2] + hex[2], 16);
			b = parseInt(hex[3] + hex[3], 16);
		} else if (hex.length == 7) {
			// Handle full hex (e.g., #0033FF)
			r = parseInt(hex[1] + hex[2], 16);
			g = parseInt(hex[3] + hex[4], 16);
			b = parseInt(hex[5] + hex[6], 16);
		}
		// Apply darkening factor
		r = Math.max(0, Math.floor(r * darkenFactor));
		g = Math.max(0, Math.floor(g * darkenFactor));
		b = Math.max(0, Math.floor(b * darkenFactor));
		return `rgba(${r},${g},${b},${alpha})`;
	}

	// --- Drawing Functions ---

	function drawBall() {
		ctx.beginPath();
		ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
		ctx.fillStyle = ball.color;
		ctx.fill();
		ctx.closePath();
	}

	function drawPaddle() {
		if (paddle.x === undefined) return; // Don't draw if not initialized

		// Draw paddle as a thick rounded line for a smoother look
		ctx.beginPath();
		ctx.lineCap = "round";
		ctx.lineWidth = paddle.height;
		// Start and end points account for the line thickness to match desired width/height
		ctx.moveTo(paddle.x + paddle.height / 2, paddle.y + paddle.height / 2);
		ctx.lineTo(
			paddle.x + paddle.width - paddle.height / 2,
			paddle.y + paddle.height / 2
		);
		ctx.strokeStyle = paddle.color;
		ctx.stroke();
		ctx.closePath();
	}

	function drawBricks() {
		// Apply vertical offset if rows are animating
		const yOffset = isAnimatingRows ? animationCurrentY : 0;

		for (let c = 0; c < BRICK_COLUMN_COUNT; c++) {
			for (let r = 0; r < BRICK_ROW_COUNT; r++) {
				// Check if the brick exists at this position
				if (bricks[c] && bricks[c][r]) {
					const brick = bricks[c][r];
					ctx.beginPath();
					ctx.rect(
						brick.x,
						brick.y + yOffset, // Apply animation offset here
						brick.width,
						brick.height
					);
					ctx.fillStyle = brick.color;
					ctx.fill();
					// Draw a subtle outline for definition
					ctx.strokeStyle = BRICK_OUTLINE_COLOR;
					ctx.lineWidth = 1;
					ctx.strokeRect(
						brick.x,
						brick.y + yOffset,
						brick.width,
						brick.height
					);
					ctx.closePath();
				}
			}
		}
	}

	function drawScore() {
		ctx.font = '18px "Segoe UI", sans-serif';
		ctx.fillStyle = TEXT_COLOR;
		ctx.textAlign = "left"; // Align score to the left
		ctx.fillText(
			"Score: " + score,
			UI_TOP_PADDING, // Left padding
			UI_TOP_PADDING + 18 // Top padding + approximate font height
		);
	}

	function drawLives() {
		ctx.font = '18px "Segoe UI", sans-serif';
		ctx.fillStyle = TEXT_COLOR;
		ctx.textAlign = "right"; // Align lives to the right
		ctx.fillText(
			"Lives: " + lives,
			canvas.width - UI_TOP_PADDING, // Right padding
			UI_TOP_PADDING + 18 // Top padding + approximate font height
		);
		ctx.textAlign = "left"; // Reset alignment for subsequent draws
	}

	function drawParticles() {
		particles.forEach((p) => {
			ctx.beginPath();
			// Draw particles as small squares
			ctx.rect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
			ctx.fillStyle = p.color;
			// Fade out particles based on remaining life
			ctx.globalAlpha = Math.max(0, p.life / PARTICLE_LIFE);
			ctx.fill();
			ctx.closePath();
		});
		ctx.globalAlpha = 1.0; // Reset global alpha
	}

	function drawShatterPieces() {
		shatterPieces.forEach((p) => {
			ctx.save(); // Save current context state
			ctx.translate(p.x, p.y); // Move origin to piece's center
			ctx.rotate(p.angle); // Rotate context
			// Set fill style using darkened RGBA color
			ctx.fillStyle = hexToRgba(
				p.color,
				SHARD_ALPHA,
				SHARD_DARKEN_FACTOR
			);
			// Draw the triangular shard
			ctx.beginPath();
			ctx.moveTo(p.vertices[0].x, p.vertices[0].y);
			ctx.lineTo(p.vertices[1].x, p.vertices[1].y);
			ctx.lineTo(p.vertices[2].x, p.vertices[2].y);
			ctx.closePath();
			ctx.fill();
			ctx.restore(); // Restore context state
		});
	}

	function drawPauseButton() {
		// Draw background rectangle
		ctx.fillStyle = PAUSE_BUTTON_BG;
		ctx.fillRect(
			PAUSE_BUTTON_X,
			PAUSE_BUTTON_Y,
			PAUSE_BUTTON_SIZE,
			PAUSE_BUTTON_SIZE
		);

		// Calculate icon dimensions and position
		ctx.fillStyle = PAUSE_ICON_COLOR;
		const iconSize = PAUSE_BUTTON_SIZE * 0.4;
		const iconPosX = PAUSE_BUTTON_X + (PAUSE_BUTTON_SIZE - iconSize) / 2;
		const iconPosY = PAUSE_BUTTON_Y + (PAUSE_BUTTON_SIZE - iconSize) / 2;

		if (isPaused) {
			// Draw Resume icon (triangle)
			ctx.beginPath();
			ctx.moveTo(iconPosX, iconPosY);
			ctx.lineTo(iconPosX + iconSize, iconPosY + iconSize / 2);
			ctx.lineTo(iconPosX, iconPosY + iconSize);
			ctx.closePath();
			ctx.fill();
		} else {
			// Draw Pause icon (two vertical bars)
			const barWidth = iconSize / 4;
			ctx.fillRect(iconPosX, iconPosY, barWidth, iconSize);
			ctx.fillRect(
				iconPosX + iconSize - barWidth,
				iconPosY,
				barWidth,
				iconSize
			);
		}
	}

	// Draws the semi-transparent background for messages
	function drawMessageBackground() {
		ctx.fillStyle = MESSAGE_BG_COLOR;
		const stripeY = canvas.height / 2 - MESSAGE_STRIPE_HEIGHT / 2;
		ctx.fillRect(0, stripeY, canvas.width, MESSAGE_STRIPE_HEIGHT);
	}

	// Draws a centered message (Game Over)
	function drawMessage(message, color) {
		drawMessageBackground();
		ctx.font = 'bold 36px "Segoe UI", sans-serif';
		ctx.fillStyle = color;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle"; // Vertically center text
		ctx.fillText(message, canvas.width / 2, canvas.height / 2);
		ctx.textAlign = "left"; // Reset alignment
		ctx.textBaseline = "alphabetic"; // Reset baseline
	}

	// Draws the centered Paused message
	function drawPauseMessage() {
		drawMessageBackground();
		ctx.font = 'bold 36px "Segoe UI", sans-serif';
		ctx.fillStyle = PAUSE_COLOR;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle"; // Vertically center text
		ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
		ctx.textAlign = "left"; // Reset alignment
		ctx.textBaseline = "alphabetic"; // Reset baseline
	}

	// --- Update & Collision Logic ---

	function updatePaddle() {
		// Don't move paddle if paused, game over, or rows are animating
		if (isPaused || isGameOver || isAnimatingRows) return;

		let moveDirection = 0; // -1 for left, 1 for right, 0 for no move

		// Touch control takes precedence
		if (isTouchActive && touchTargetX !== null) {
			const paddleCenter = paddle.x + paddle.width / 2;
			const difference = touchTargetX - paddleCenter;
			// Move only if the touch target is sufficiently far from the paddle center
			const threshold = PADDLE_SPEED / 1.5; // Adjust sensitivity
			if (Math.abs(difference) > threshold) {
				moveDirection = difference > 0 ? 1 : -1;
			}
		} else {
			// Keyboard control
			if (leftPressed) moveDirection = -1;
			else if (rightPressed) moveDirection = 1;
		}

		// Apply movement
		paddle.x += moveDirection * PADDLE_SPEED;

		// Clamp paddle position within canvas bounds
		paddle.x = Math.max(
			0, // Left bound
			Math.min(paddle.x, canvas.width - paddle.width) // Right bound
		);
	}

	function updateLaunchDelay() {
		// Countdown only if waiting to launch and game is active
		if (waitingToLaunch && !isPaused && !isGameOver && !isAnimatingRows) {
			launchDelayTimer--;
			if (launchDelayTimer <= 0) {
				// Timer finished, launch the ball
				waitingToLaunch = false;
				ball.dx = INITIAL_BALL_SPEED_X * (Math.random() < 0.5 ? 1 : -1); // Random initial horizontal direction
				ball.dy = INITIAL_BALL_SPEED_Y;
			}
		}
	}

	function updateBall() {
		// Don't update ball if paused, game over, waiting to launch, or rows animating
		if (isPaused || isGameOver || waitingToLaunch || isAnimatingRows) {
			return;
		}

		// Calculate next position based on current velocity and debug speed multiplier
		let nextX = ball.x + ball.dx * debugSpeedMultiplier;
		let nextY = ball.y + ball.dy * debugSpeedMultiplier;

		// Wall collisions (left/right)
		if (nextX > canvas.width - ball.radius || nextX < ball.radius) {
			ball.dx = -ball.dx; // Reverse horizontal direction
			// Correct position to prevent sticking
			if (nextX > canvas.width - ball.radius)
				ball.x = canvas.width - ball.radius;
			if (nextX < ball.radius) ball.x = ball.radius;
			// Recalculate nextX after correction and direction change
			nextX = ball.x + ball.dx * debugSpeedMultiplier;
		}

		// Wall collision (top)
		if (nextY < ball.radius) {
			ball.dy = -ball.dy; // Reverse vertical direction
			// Correct position
			if (nextY < ball.radius) ball.y = ball.radius;
			// Recalculate nextY
			nextY = ball.y + ball.dy * debugSpeedMultiplier;
		}
		// Paddle collision check
		else if (
			ball.dy > 0 && // Only check if moving downwards
			nextY + ball.radius > paddle.y && // Will cross paddle top edge?
			ball.y + ball.radius <= paddle.y && // Is currently above paddle top edge?
			nextX + ball.radius > paddle.x && // Ball overlaps horizontally with paddle?
			nextX - ball.radius < paddle.x + paddle.width
		) {
			paddleCollision(); // Handle paddle bounce logic
			// Recalculate nextY after collision adjustment
			nextY = ball.y + ball.dy * debugSpeedMultiplier;
		}
		// Bottom edge collision (lose life or debug bounce)
		else if (nextY > canvas.height - ball.radius) {
			if (isDebugMode) {
				// Bounce off bottom in debug mode
				ball.dy = -ball.dy;
				ball.y = canvas.height - ball.radius; // Correct position
			} else {
				// Normal mode: lose a life
				lives--;
				if (lives <= 0) {
					// Game Over
					isGameOver = true;
					ball.dx = 0; // Stop ball movement
					ball.dy = 0;
					ball.x = canvas.width / 2; // Center ball for message
					ball.y = canvas.height / 2 + 50;
					return; // Exit update function
				} else {
					// Reset ball for next life
					resetBallForLaunch();
					return; // Exit update function
				}
			}
		}

		// Update ball position if no life was lost or game over triggered
		ball.x += ball.dx * debugSpeedMultiplier;
		ball.y += ball.dy * debugSpeedMultiplier;
	}

	// Handle ball collision with the paddle
	function paddleCollision() {
		if (ball.dy <= 0) return; // Ignore if ball is moving up

		ball.dy = -ball.dy; // Reverse vertical direction

		// Calculate horizontal bounce angle based on where ball hits paddle
		let collidePoint = ball.x - (paddle.x + paddle.width / 2);
		ball.dx = collidePoint * 0.15; // Factor determines bounce angle sensitivity

		// Clamp horizontal speed to prevent excessive speeds
		const maxPaddleBounceDx = Math.abs(INITIAL_BALL_SPEED_X) * 2.2;
		ball.dx = Math.max(
			-maxPaddleBounceDx,
			Math.min(maxPaddleBounceDx, ball.dx)
		);

		// Ensure ball is placed just above the paddle to prevent sinking in
		ball.y = paddle.y - ball.radius - 0.1;
	}

	// Handle ball collision with bricks
	function brickCollision() {
		// Don't check collisions if paused, game over, waiting, or animating rows
		if (isPaused || isGameOver || waitingToLaunch || isAnimatingRows) {
			return false; // No collision occurred
		}

		let collisionOccurred = false;
		// Get current Y offset from row animation
		const yOffset = isAnimatingRows ? animationCurrentY : 0;

		for (let c = 0; c < BRICK_COLUMN_COUNT; c++) {
			for (let r = 0; r < BRICK_ROW_COUNT; r++) {
				// Check if brick exists
				if (bricks[c] && bricks[c][r]) {
					const brick = bricks[c][r];
					const brickTop = brick.y + yOffset;
					const brickBottom = brick.y + brick.height + yOffset;
					const brickLeft = brick.x;
					const brickRight = brick.x + brick.width;

					// Simple Axis-Aligned Bounding Box (AABB) collision check
					if (
						ball.x + ball.radius > brickLeft &&
						ball.x - ball.radius < brickRight &&
						ball.y + ball.radius > brickTop &&
						ball.y - ball.radius < brickBottom
					) {
						// Collision detected!
						const brickCenterX = brick.x + brick.width / 2;
						const brickCenterY =
							brick.y + brick.height / 2 + yOffset;

						// Create visual effects (particles and shards)
						createBrickShatterEffect(
							brickCenterX,
							brickCenterY,
							brick.width,
							brick.height,
							brick.color
						);
						createShatterEffect(
							// Legacy particle effect (squares)
							brickCenterX,
							brickCenterY,
							brick.color
						);

						// Update score and check for extra life
						score++;
						if (score > 0 && score % SCORE_FOR_EXTRA_LIFE === 0) {
							lives++;
						}

						// Remove the brick
						bricks[c][r] = null;
						collisionOccurred = true;

						// --- IMPORTANT: Ball passes through bricks ---
						// No ball direction change (ball.dx = -ball.dx or ball.dy = -ball.dy)
						// This allows breaking multiple bricks in one pass.
					}
				}
			}
		}
		return collisionOccurred; // Return true if any brick was hit
	}

	// Check if bottom rows are empty and trigger row shifting animation
	function checkAndShiftRows() {
		if (isPaused || isGameOver || isAnimatingRows) return;

		let lowestActiveRow = -1;
		// Find the lowest row index that still contains at least one brick
		for (let r = BRICK_ROW_COUNT - 1; r >= 0; r--) {
			for (let c = 0; c < BRICK_COLUMN_COUNT; c++) {
				if (bricks[c] && bricks[c][r]) {
					lowestActiveRow = r;
					break; // Found a brick in this row, move to next check
				}
			}
			if (lowestActiveRow !== -1) break; // Stop searching rows once the lowest active is found
		}

		// Calculate how many rows are empty at the bottom
		const shiftAmount =
			lowestActiveRow === -1 // If all bricks cleared somehow
				? BRICK_ROW_COUNT
				: BRICK_ROW_COUNT - 1 - lowestActiveRow;

		if (shiftAmount > 0) {
			// Initiate the row shifting animation
			rowsAdvanced += shiftAmount; // Track total rows advanced
			isAnimatingRows = true;
			rowsToShiftAmount = shiftAmount;
			animationTargetY = shiftAmount * ROW_HEIGHT; // Target offset in pixels
			animationCurrentY = 0; // Start animation offset at 0
		}
	}

	// Update the vertical position of bricks during the shifting animation
	function updateRowAnimation() {
		if (!isAnimatingRows) return;

		animationCurrentY += ROW_ANIMATION_SPEED; // Move bricks down

		// Check if animation reached or passed the target position
		if (animationCurrentY >= animationTargetY) {
			animationCurrentY = animationTargetY; // Snap to exact target

			// --- Update the actual brick data structure ---
			// Move existing bricks down in the array
			for (let r = BRICK_ROW_COUNT - 1; r >= 0; r--) {
				for (let c = 0; c < BRICK_COLUMN_COUNT; c++) {
					const targetRow = r + rowsToShiftAmount;
					if (targetRow < BRICK_ROW_COUNT && bricks[c]) {
						// Copy brick data to the new row, or null if no brick existed
						bricks[c][targetRow] = bricks[c][r]
							? { ...bricks[c][r] }
							: null;
						// Update the Y coordinate stored in the moved brick object
						if (bricks[c][targetRow]) {
							bricks[c][targetRow].y =
								targetRow * ROW_HEIGHT + BRICK_OFFSET_TOP;
						}
					}
				}
			}
			// Create new bricks in the top rows that were vacated
			for (let r = 0; r < rowsToShiftAmount; r++) {
				for (let c = 0; c < BRICK_COLUMN_COUNT; c++) {
					if (!bricks[c]) bricks[c] = []; // Ensure column array exists
					bricks[c][r] = createBrick(c, r); // Generate new brick
				}
			}

			// Reset animation state variables
			isAnimatingRows = false;
			animationTargetY = 0;
			animationCurrentY = 0;
			rowsToShiftAmount = 0;
		}
	}

	// --- Effect Creation Functions ---

	// Create small square particles emanating from a point
	function createShatterEffect(x, y, color) {
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			particles.push({
				x: x,
				y: y,
				dx: (Math.random() - 0.5) * PARTICLE_SPEED_FACTOR * 2, // Random horizontal velocity
				dy: (Math.random() - 0.5) * PARTICLE_SPEED_FACTOR * 2, // Random vertical velocity
				life: PARTICLE_LIFE + Math.random() * 10, // Randomize lifespan slightly
				color: color,
				size: PARTICLE_SIZE + Math.random() * 1, // Randomize size slightly
			});
		}
	}

	// Create larger triangular shard pieces for brick breaking
	function createBrickShatterEffect(
		centerX,
		centerY,
		brickWidth,
		brickHeight,
		color
	) {
		const maxShardRadius =
			Math.min(brickWidth, brickHeight) * SHARD_SIZE_FACTOR;

		for (let i = 0; i < NUM_SHATTER_PIECES; i++) {
			// Generate three random angles and radii to form a triangle
			const angle1 = Math.random() * Math.PI * 2;
			const angle2 = angle1 + ((Math.random() * 0.8 + 0.8) * Math.PI) / 2; // Ensure some separation
			const angle3 = angle2 + ((Math.random() * 0.8 + 0.8) * Math.PI) / 2; // Ensure some separation
			const radius1 = Math.random() * maxShardRadius;
			const radius2 = Math.random() * maxShardRadius;
			const radius3 = Math.random() * maxShardRadius;

			// Define vertices relative to the center (0,0)
			const vertices = [
				{
					x: Math.cos(angle1) * radius1,
					y: Math.sin(angle1) * radius1,
				},
				{
					x: Math.cos(angle2) * radius2,
					y: Math.sin(angle2) * radius2,
				},
				{
					x: Math.cos(angle3) * radius3,
					y: Math.sin(angle3) * radius3,
				},
			];

			shatterPieces.push({
				x: centerX, // Initial position X
				y: centerY, // Initial position Y
				vertices: vertices, // Shape definition
				dx: (Math.random() - 0.5) * SHATTER_INITIAL_DX_RANGE * 2, // Initial horizontal velocity
				dy:
					Math.random() * SHATTER_INITIAL_DY_RANGE -
					SHATTER_INITIAL_DY_RANGE / 2, // Initial vertical velocity (can go up slightly)
				angle: Math.random() * Math.PI * 2, // Initial rotation
				dAngle:
					(Math.random() - 0.5) * SHATTER_ROTATION_SPEED_RANGE * 2, // Rotational speed
				color: color, // Base color
				gravity: SHATTER_GRAVITY + (Math.random() - 0.5) * 0.05, // Slight gravity variation
			});
		}
	}

	// --- Effect Update Functions ---

	function updateParticles() {
		// Update position and life of square particles
		for (let i = particles.length - 1; i >= 0; i--) {
			const p = particles[i];
			p.x += p.dx;
			p.y += p.dy;
			p.dy += 0.06; // Simple gravity effect
			p.life--;
			// Remove particles whose lifespan has ended
			if (p.life <= 0) {
				particles.splice(i, 1);
			}
		}
	}

	function updateShatterPieces() {
		// Update position, rotation, and life of triangular shards
		for (let i = shatterPieces.length - 1; i >= 0; i--) {
			const p = shatterPieces[i];
			p.dy += p.gravity; // Apply gravity
			p.x += p.dx;
			p.y += p.dy;
			p.angle += p.dAngle; // Apply rotation
			// Remove shards that have fallen off-screen
			if (p.y > canvas.height + 50) {
				// Check well below the canvas
				shatterPieces.splice(i, 1);
			}
		}
	}

	// --- Debug Function ---

	function toggleDebugMode() {
		isDebugMode = !isDebugMode;
		debugSpeedMultiplier = isDebugMode ? 5 : 1; // Adjust speed multiplier
		console.log(
			"Debug Mode:",
			isDebugMode ? "ON" : "OFF",
			"- Speed Multiplier:",
			debugSpeedMultiplier
		);
		// Update the visibility of the debug indicator div
		debugIndicator.style.display = isDebugMode ? "block" : "none";
	}

	// --- Input Handling Helper ---

	// Get event coordinates relative to the canvas, accounting for scaling/offset
	function getCanvasCoordinates(event) {
		const rect = canvas.getBoundingClientRect();
		let x, y;

		// Check for touch event first
		if (event.touches && event.touches.length > 0) {
			x = event.touches[0].clientX - rect.left;
			y = event.touches[0].clientY - rect.top;
		} else if (event.clientX !== undefined) {
			// Check for mouse event
			x = event.clientX - rect.left;
			y = event.clientY - rect.top;
		} else {
			return null; // Unknown event type
		}

		// Adjust coordinates based on canvas intrinsic size vs displayed size
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;

		return { x: x * scaleX, y: y * scaleY };
	}

	// --- Input Event Handlers ---

	function keyDownHandler(e) {
		// Pause/Resume toggle (Escape key)
		if (e.key === "Escape" && !isGameOver) {
			isPaused = !isPaused;
			e.preventDefault(); // Prevent default browser behavior (e.g., exiting full screen)
			return;
		}

		// Restart game from Game Over screen (Space key)
		if ((e.code === "Space" || e.key === " ") && isGameOver) {
			// Stop the old game loop before starting a new one
			if (animationFrameId) cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
			initGame();
			e.preventDefault();
			return;
		}

		// Toggle Debug Mode (T key)
		if (e.key === "t" || e.key === "T") {
			toggleDebugMode();
			e.preventDefault();
			return;
		}

		// Paddle movement keys (only if game is active)
		if (!isPaused && !isGameOver && !isAnimatingRows) {
			if (
				e.key === "Right" ||
				e.key === "ArrowRight" ||
				e.key === "d" ||
				e.key === "D"
			) {
				rightPressed = true;
			} else if (
				e.key === "Left" ||
				e.key === "ArrowLeft" ||
				e.key === "a" ||
				e.key === "A"
			) {
				leftPressed = true;
			}
		}

		// Prevent default browser actions for game control keys
		if (
			[
				"ArrowLeft",
				"ArrowRight",
				" ",
				"a",
				"A",
				"d",
				"D",
				"Escape",
				"t",
				"T",
			].includes(e.key)
		) {
			e.preventDefault();
		}
	}

	function keyUpHandler(e) {
		// Update paddle movement flags when keys are released
		if (
			e.key === "Right" ||
			e.key === "ArrowRight" ||
			e.key === "d" ||
			e.key === "D"
		) {
			rightPressed = false;
		} else if (
			e.key === "Left" ||
			e.key === "ArrowLeft" ||
			e.key === "a" ||
			e.key === "A"
		) {
			leftPressed = false;
		}

		// Prevent default browser actions for game control keys
		if (
			["ArrowLeft", "ArrowRight", "a", "A", "d", "D", "t", "T"].includes(
				e.key
			)
		) {
			e.preventDefault();
		}
	}

	function clickHandler(e) {
		const coords = getCanvasCoordinates(e);
		if (!coords) return; // Ignore if coordinates couldn't be determined

		// Check for click on the Pause Button
		if (
			!isGameOver &&
			coords.x >= PAUSE_BUTTON_X &&
			coords.x <= PAUSE_BUTTON_X + PAUSE_BUTTON_SIZE &&
			coords.y >= PAUSE_BUTTON_Y &&
			coords.y <= PAUSE_BUTTON_Y + PAUSE_BUTTON_SIZE
		) {
			isPaused = !isPaused;
			// If unpausing via button, reset touch state
			if (!isPaused) {
				isTouchActive = false;
				touchTargetX = null;
			}
			e.preventDefault();
		}
		// Check for click anywhere else when Game Over to restart
		else if (isGameOver) {
			if (animationFrameId) cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
			initGame();
			e.preventDefault();
		}
		// Check for click anywhere else (not button) when Paused to resume
		else if (isPaused) {
			isPaused = false;
			// Reset touch state when resuming
			isTouchActive = false;
			touchTargetX = null;
			e.preventDefault();
		}
	}

	function touchStartHandler(e) {
		const coords = getCanvasCoordinates(e);
		if (!coords) return;

		// Priority 1: Check for tap on the Pause Button
		if (
			!isGameOver &&
			coords.x >= PAUSE_BUTTON_X &&
			coords.x <= PAUSE_BUTTON_X + PAUSE_BUTTON_SIZE &&
			coords.y >= PAUSE_BUTTON_Y &&
			coords.y <= PAUSE_BUTTON_Y + PAUSE_BUTTON_SIZE
		) {
			isPaused = !isPaused;
			// If unpausing via button, reset touch state
			if (!isPaused) {
				isTouchActive = false;
				touchTargetX = null;
			}
			e.preventDefault(); // Crucial for preventing unwanted scrolling/zooming
			return; // Don't process other touch actions if button was hit
		}

		// Priority 2: Check for tap anywhere when Game Over to restart
		if (isGameOver) {
			if (animationFrameId) cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
			initGame();
			e.preventDefault();
			return;
		}

		// Priority 3: Check for tap anywhere (not button) when Paused to resume
		if (isPaused) {
			isPaused = false;
			// Reset touch state, don't start moving paddle immediately
			isTouchActive = false;
			touchTargetX = null;
			e.preventDefault();
			return; // Don't process paddle movement on the same touch that unpauses
		}

		// Priority 4: Normal gameplay touch for paddle control
		if (!isPaused && !isAnimatingRows) {
			isTouchActive = true;
			touchTargetX = coords.x; // Set the target position for the paddle
			e.preventDefault();
		}
	}

	function touchMoveHandler(e) {
		// Update paddle target position if touch is active and game is running
		if (isTouchActive && !isPaused && !isGameOver && !isAnimatingRows) {
			const coords = getCanvasCoordinates(e);
			if (coords) {
				touchTargetX = coords.x;
				e.preventDefault(); // Prevent scrolling while dragging finger
			}
		}
	}

	function touchEndHandler(e) {
		// Stop tracking touch movement when finger is lifted
		// This check prevents resetting state if the touch end was related to the pause button tap
		if (isTouchActive) {
			isTouchActive = false;
			touchTargetX = null;
		}
		// e.preventDefault(); // Usually not needed for touchend, but can prevent potential issues
	}

	// --- Event Listeners Setup ---
	document.addEventListener("keydown", keyDownHandler, false);
	document.addEventListener("keyup", keyUpHandler, false);
	canvas.addEventListener("click", clickHandler, false);
	// Use passive: false for touch events to allow preventDefault()
	canvas.addEventListener("touchstart", touchStartHandler, {
		passive: false,
	});
	canvas.addEventListener("touchmove", touchMoveHandler, { passive: false });
	canvas.addEventListener("touchend", touchEndHandler, false);
	canvas.addEventListener("touchcancel", touchEndHandler, false); // Handle cancelled touches

	// --- Main Game Loop ---
	function gameLoop() {
		// 1. Clear Canvas
		ctx.fillStyle = BG_COLOR;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// 2. Update Game State (Physics, Input, Animations)
		updateRowAnimation(); // Handles brick shifting animation first
		updateLaunchDelay(); // Handles auto-launch timer
		updatePaddle(); // Updates paddle position based on input
		updateBall(); // Updates ball position and handles wall/paddle/bottom collisions
		const ballCollisionHappened = brickCollision(); // Updates brick state and checks for hits
		updateParticles(); // Updates simple particle effects
		updateShatterPieces(); // Updates shard effects

		// 3. Check Game Conditions (Post-updates)
		// If a brick was hit and game is active, check if rows need to shift
		if (
			ballCollisionHappened &&
			!isPaused &&
			!isGameOver &&
			!isAnimatingRows
		) {
			checkAndShiftRows();
		}

		// 4. Draw Elements (Order matters for layering)
		drawBricks(); // Bricks are drawn first (background layer)
		drawShatterPieces(); // Draw falling shards behind paddle/ball
		drawPaddle();
		drawBall();
		drawParticles(); // Draw small particles on top of most elements

		// 5. Draw UI Elements
		drawScore(); // Top Left
		drawLives(); // Top Right
		drawPauseButton(); // Top Center

		// 6. Draw Overlays (Game Over / Paused Messages)
		// These are drawn last to appear over all game elements
		if (isGameOver) {
			drawMessage("GAME OVER", GAMEOVER_COLOR);
		} else if (isPaused) {
			drawPauseMessage();
		}

		// 7. Request Next Frame
		// Store the ID so the loop can be cancelled if needed
		animationFrameId = requestAnimationFrame(gameLoop);
	}

	// --- Start Game ---
	initGame(); // Initialize and start the game loop
})(); // End of IIFE
