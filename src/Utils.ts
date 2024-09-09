// Utils.ts

import { Constants } from "./Constants";
import { GameSize, Wall } from "./Types";

/**
 * Generates a UUID v4.
 * @returns A randomly generated UUID v4 string.
 */
export function uuidv4(): string {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
        ((+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4) >>> 0).toString(16)
    );
}

/**
 * Checks if a given point is inside a rectangular boundary.
 * @param x The x-coordinate of the point.
 * @param y The y-coordinate of the point.
 * @param rect The rectangle boundary.
 * @returns True if the point is inside the rectangle, otherwise false.
 */
export function isPointInRect(x: number, y: number, rect: { x: number, y: number, width: number, height: number }): boolean {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
// Rotate a point around a given center by a certain angle
export function rotatePoint(point: { x: number, y: number }, center: { x: number, y: number }, angle: number): { x: number, y: number } {
    const cosTheta = Math.cos(angle);
    const sinTheta = Math.sin(angle);

    const dx = point.x - center.x;
    const dy = point.y - center.y;

    return {
        x: cosTheta * dx - sinTheta * dy + center.x,
        y: sinTheta * dx + cosTheta * dy + center.y
    };
}

// Check if a point (e.g., bullet) is inside a rotated rectangle using SAT
export function pointInRotatedRectangle(px: number, py: number, corners: { x: number, y: number }[]): boolean {
    // Function to calculate the dot product of two vectors
    const dotProduct = (v1: { x: number, y: number }, v2: { x: number, y: number }) => v1.x * v2.x + v1.y * v2.y;

    // Function to subtract two points to create a vector
    const subtract = (p1: { x: number, y: number }, p2: { x: number, y: number }) => ({ x: p1.x - p2.x, y: p1.y - p2.y });

    // Create axes (normals) for the rectangle edges
    const axes = [
        subtract(corners[1], corners[0]), // Edge between corner 0 and corner 1
        subtract(corners[3], corners[0])  // Edge between corner 0 and corner 3
    ];

    // For each axis, project the point and rectangle corners, and check for overlap
    for (const axis of axes) {
        const projections = corners.map(corner => dotProduct(corner, axis));
        const minRectProj = Math.min(...projections);
        const maxRectProj = Math.max(...projections);

        const bulletProj = dotProduct({ x: px, y: py }, axis);

        if (bulletProj < minRectProj || bulletProj > maxRectProj) {
            // No overlap on this axis, so no collision
            return false;
        }
    }

    // Overlaps on both axes, so there is a collision
    return true;
}

/**
 * Reflects a vector off a surface defined by its normal vector.
 * @param vector The vector to be reflected.
 * @param normal The normal vector of the surface.
 * @returns The reflected vector.
 */
export function reflectVector(vector: { dx: number, dy: number }, normal: { x: number, y: number }): { dx: number, dy: number } {
    const dotProduct = vector.dx * normal.x + vector.dy * normal.y;
    return {
        dx: vector.dx - 2 * dotProduct * normal.x,
        dy: vector.dy - 2 * dotProduct * normal.y
    };
}

/**
 * Clamps a value between a minimum and maximum value.
 * @param value The value to clamp.
 * @param min The minimum allowable value.
 * @param max The maximum allowable value.
 * @returns The clamped value.
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Calculates the distance between two points.
 * @param p1 The first point.
 * @param p2 The second point.
 * @returns The distance between the two points.
 */
export function distance(p1: { x: number, y: number }, p2: { x: number, y: number }): number {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

/**
 * Generates a random color from a predefined set of colors.
 * @returns A random color string.
 */
export function getRandomColor(): string {
    const colors = ['red', 'green', 'yellow', 'purple', 'orange', 'pink'];
    return colors[Math.floor(Math.random() * colors.length)];
}
export function findGroupEnd(angle:number,startX: number, startY: number, walls: Wall[], size: GameSize, isMovingBackward: boolean): { x: number; y: number, group: Wall[] } | null {
    const group: Wall[] = [];

    const tankMinSize = Constants.TANK_SIZE / 16;
    let endX = startX;
    let endY = startY;

    // Determine direction of movement based on angle
    if (isMovingBackward){
        // angle = angle+180
        angle = angle+Math.PI
    }
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    // Define the direction based on the angle (4 possible directions)
    const isMovingRight = cosAngle > 0 && Math.abs(cosAngle) > Math.abs(sinAngle);
    const isMovingLeft = cosAngle < 0 && Math.abs(cosAngle) > Math.abs(sinAngle);
    const isMovingDown = sinAngle > 0 && Math.abs(sinAngle) > Math.abs(cosAngle);
    const isMovingUp = sinAngle < 0 && Math.abs(sinAngle) > Math.abs(cosAngle);

    // Define movement offsets for each direction
    const offsetX = isMovingRight ? 1 : isMovingLeft ? -1 : 0;
    const offsetY = isMovingDown ? 1 : isMovingUp ? -1 : 0;

    // const degrees45 = Math.PI / 4; // 45 degrees in radians

    // Function to calculate the angle between two vectors
    const angleBetweenVectors = (v1x: number, v1y: number, v2x: number, v2y: number): number => {
        const dotProduct = v1x * v2x + v1y * v2y;
        const magnitudeV1 = Math.sqrt(v1x * v1x + v1y * v1y);
        const magnitudeV2 = Math.sqrt(v2x * v2x + v2y * v2y);
        return Math.acos(dotProduct / (magnitudeV1 * magnitudeV2));
    };

    // Keep extending in the direction of movement while walls are consecutive
    for (let i = 0; i < Constants.MAX_TELEPORT_DISTANCE; i++) {
        const nextWall = walls.find(wall => {
            const withinX = (endX + offsetX * tankMinSize) >= wall.x && (endX + offsetX * tankMinSize) <= (wall.x + wall.width);
            const withinY = (endY + offsetY * tankMinSize) >= wall.y && (endY + offsetY * tankMinSize) <= (wall.y + wall.height);
            return withinX && withinY;
        });

        if (nextWall) {
        const wallVector = { x: nextWall.x + nextWall.width / 2 - endX, y: nextWall.y + nextWall.height / 2 - endY };
        const movementVector = { x: offsetX, y: offsetY };

        const angleToWall = angleBetweenVectors(movementVector.x, movementVector.y, wallVector.x, wallVector.y);

        if (angleToWall > Constants.MAX_TELEPORT_DEGREES) {
            console.log("[45] blocked",(angleToWall*(Math.PI/180)))
            return null;
        }

            
            group.push(nextWall);
            // If a wall is found, extend the position further in that direction

            if (isMovingRight) {
                endX = nextWall.x + nextWall.width + tankMinSize;
            } else if (isMovingLeft) {
                endX = nextWall.x - tankMinSize;
            } else if (isMovingDown) {
                endY = nextWall.y + nextWall.height + tankMinSize;
            } else if (isMovingUp) {
                endY = nextWall.y - tankMinSize;
            }

        } else {
            // Stop if no more consecutive walls are found
            break;
        }
    }

    // Ensure the final position is within the canvas bounds
    if (endX < tankMinSize || endX > (size.width - tankMinSize) ||
        endY < tankMinSize || endY > (size.height - tankMinSize)) {
        return null;
    }

    return { x: endX, y: endY, group: group };
} 
export function dummyrandom(seed:number) { // so/a:19303725 : This isn't a uniform sampler. the '10000' is the amount of 'uniformness' it have
    const x = Math.sin(seed++) * 1000000;
    return x - Math.floor(x);
}
/**
 * Utility function to generate a random maze based on a given width and height.
 * 
 * @param width - The width of the maze in pixels.
 * @param height - The height of the maze in pixels.
 * @param wallSize - The size of each wall block in pixels.
 * @param seed - the seed to do the dummyrandom on each random.
 * @returns An array of `Wall` objects representing the maze.
 */
export function generateMaze(size: GameSize, wallSize: number,seed:number): Wall[] {
    const maze: Wall[] = [];
    const mazeWidth = Math.floor(size.width / wallSize);
    const mazeHeight = Math.floor(size.height / wallSize);

    for (let i = 0; i < mazeWidth; i++) {
        for (let j = 0; j < mazeHeight; j++) {
            if (dummyrandom((seed+i)/(j+1)) < 0.3) { // Adjust density of walls
                maze.push({
                    x: i * wallSize,
                    y: j * wallSize,
                    width: wallSize,
                    height: wallSize,
                    originalColor: 'gray'
                });
            }
        }
    }

    return maze;
}