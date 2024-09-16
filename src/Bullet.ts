import { GameSize, Wall } from './Types';
import { Constants } from './Constants';

/**
 * Represents a Bullet in the game, with its position, direction, and owner.
 * Handles movement, reflection, and rendering on the canvas.
 */
export class Bullet {
    id: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
    alpha: number;
    creationTime: number;
    owner: string;
    color: string;

    constructor(id: number, x: number, y: number, dx: number, dy: number, owner: string) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.dx = dx*Constants.BULLET_SPEED;
        this.dy = dy*Constants.BULLET_SPEED;
        this.alpha = 1.0; // Bullet starts fully opaque
        this.creationTime = Date.now(); // Time of bullet creation
        this.owner = owner; // Identifier for the bullet's owner
        this.color = Constants.BULLET_COLOR
    }

    /**
     * Updates the bullet's position, checks for reflections, and applies fade based on its age.
     * Returns whether the bullet is still active.
     */
    update(walls: Wall[], gameSize: GameSize): boolean {
        this.x += this.dx;
        this.y += this.dy;
        const age = (Date.now() - this.creationTime) / 1000;

        // Start fading the bullet after a certain age
        if (age > Constants.BULLET_FADE_START) {
            this.alpha = Math.max(
                0.4,
                (Constants.BULLET_LIFE - age) / (Constants.BULLET_LIFE - Constants.BULLET_FADE_START)
            );
        }

        this.reflectEdges(gameSize);
        this.reflectWalls(walls);

        // Return whether the bullet should still be alive
        return age < Constants.BULLET_LIFE;
    }

    /**
     * Reflects the bullet off the walls if it collides with any.
     */
    reflectWalls(walls: Wall[]): void {
        const bulletHalfSize = Constants.BULLET_SIZE / 2;
        const bulletLeft = this.x - bulletHalfSize;
        const bulletRight = this.x + bulletHalfSize;
        const bulletTop = this.y - bulletHalfSize;
        const bulletBottom = this.y + bulletHalfSize;

        walls.forEach((wall) => {
            const wallRight = wall.x + wall.width;
            const wallBottom = wall.y + wall.height;

            // Check if bullet is colliding with wall
            if (bulletRight > wall.x && bulletLeft < wallRight && bulletBottom > wall.y && bulletTop < wallBottom) {
                // Calculate the normal vector based on which side was hit
                const normal = this.calculateNormal(bulletLeft, bulletRight, bulletTop, bulletBottom, wall);

                // Reflect bullet's velocity using the normal vector
                const dotProduct = this.dx * normal.x + this.dy * normal.y;
                this.dx -= 2 * dotProduct * normal.x;
                this.dy -= 2 * dotProduct * normal.y;
            }
        });
    }

    /**
     * Reflects the bullet off the game edges if it hits them.
     */
    reflectEdges(gameSize: GameSize): void {
        // Reflect bullet if it hits the horizontal or vertical game boundaries
        if (this.x <= 0 || this.x >= gameSize.width) this.dx *= -1;
        if (this.y <= 0 || this.y >= gameSize.height) this.dy *= -1;
    }

    /**
     * Draws the bullet on the canvas, with opacity based on its age.
     */
    draw(ctx: CanvasRenderingContext2D): void {
        const age = (Date.now() - this.creationTime) / 1000;

        if (age <= Constants.BULLET_LIFE) {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle = this.color;
            ctx.fillRect(
                this.x - Constants.BULLET_SIZE / 2,
                this.y - Constants.BULLET_SIZE / 2,
                Constants.BULLET_SIZE,
                Constants.BULLET_SIZE
            );
            ctx.restore();
        }
    }

    /**
     * Determines the normal vector for the side of the wall the bullet collided with.
     * Used to reflect the bullet off the wall.
     */
    private calculateNormal(bulletLeft: number, bulletRight: number, bulletTop: number, bulletBottom: number, wall: Wall) {
        const leftDistance = Math.abs(bulletRight - wall.x);
        const rightDistance = Math.abs(bulletLeft - (wall.x + wall.width));
        const topDistance = Math.abs(bulletBottom - wall.y);
        const bottomDistance = Math.abs(bulletTop - (wall.y + wall.height));

        if (leftDistance < rightDistance && leftDistance < topDistance && leftDistance < bottomDistance) {
            return { x: -1, y: 0 }; // Hit the left side of the wall
        } else if (rightDistance < topDistance && rightDistance < bottomDistance) {
            return { x: 1, y: 0 }; // Hit the right side of the wall
        } else if (topDistance < bottomDistance) {
            return { x: 0, y: -1 }; // Hit the top side of the wall
        } else {
            return { x: 0, y: 1 }; // Hit the bottom side of the wall
        }
    }
}
