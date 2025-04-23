# HTML5 Brick Breaker Game

This project is a simple Brick Breaker game built with HTML5 Canvas and pure JavaScript. Designed to be playable on both desktop and mobile devices.  
The game is available to play at https://feldragon5.github.io/Brick-Breaker/.

## Features/Gameplay

-   **Classic Gameplay:** Control a paddle to bounce a ball and destroy bricks.
-   **No Brick Collision:** The ball destroys bricks without bouncing off them, allowing for less boring gameplay.
-   **Infinite:** Bricks shift down as rows are cleared.
-   **Lives:** Start with 3 lives. Gain an extra life every 50 points.
-   **Pause:** Pause the game using `ESC` or the pause button.
-   **Device Support:** Desktop and Mobile devices are both supported.
-   **Visual Effects:** Particle explosions and brick shard effects when a block is destroyed.
-   **Debug Mode (Desktop):** Press `T` to toggle debug mode. This prevents the ball from going off-screen and gives it 5x speed.

## Expansion Ideas:

-   **Better mobile support:** Mobile support is kinda scuffed right now
-   **Sidebar menu:** Hamburger style sidebar that has information/controlls, difficulty (from easy to extreme which increases or decreases the paddle size), and a link to the github repo. Another option could be to include icons for these functions under the pause text when the game is paused.
-   **Difficulty scaling:** (Possibly) have the blocks change color or have a number based on health. Higher health blocks appear the more rows are cleared. Blocks with more health will lose one health when the ball passes over it instead of breaking
-   **Autoplay/Cheat mode:** Remove the debug mode on desktop and replace with a button for "Autoplay" where the paddle moves itself to be under the ball automatically.
-   **Sound** Add sound effects for breaking a brick and bouncing off the paddle or a wall
