// Utils.ts
import { Constants } from "./Constants";
import { GameSize, Point, Wall } from "./Types";

/**
 * Calculates the normal (direction of collision) when an object hits a wall.
 * @param objectLeft - The left coordinate of the object.
 * @param objectRight - The right coordinate of the object.
 * @param objectTop - The top coordinate of the object.
 * @param objectBottom - The bottom coordinate of the object.
 * @param wall - The wall that the object is colliding with.
 * @returns A Point representing the normal vector.
 */
export function calculateNormal(
    objectLeft: number,
    objectRight: number,
    objectTop: number,
    objectBottom: number,
    wall: Wall
): Point {
    const leftDistance = Math.abs(objectRight - wall.x);
    const rightDistance = Math.abs(objectLeft - (wall.x + wall.width));
    const topDistance = Math.abs(objectBottom - wall.y);
    const bottomDistance = Math.abs(objectTop - (wall.y + wall.height));

    if (leftDistance < rightDistance && leftDistance < topDistance && leftDistance < bottomDistance) {
        return { x: -1, y: 0 }; // Collision on the left side
    } else if (rightDistance < topDistance && rightDistance < bottomDistance) {
        return { x: 1, y: 0 }; // Collision on the right side
    } else if (topDistance < bottomDistance) {
        return { x: 0, y: -1 }; // Collision on the top side
    } else {
        return { x: 0, y: 1 }; // Collision on the bottom side
    }
}

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
 * Utility function to generate a random maze based on a given width and height.
 * 
 * @param width - The width of the maze in pixels.
 * @param height - The height of the maze in pixels.
 * @param wallSize - The size of each wall block in pixels.
 * @param seed - the seed to do the dummyrandom on each random.
 * @returns An array of Wall objects representing the maze.
 */
export function generateMaze(size: GameSize, wallSize: number, seed: number): Wall[] {
    const maze: Wall[] = [];
    const mazeWidth = Math.floor(size.width / wallSize);
    const mazeHeight = Math.floor(size.height / wallSize);

    for (let i = 0; i < mazeWidth; i++) {
        for (let j = 0; j < mazeHeight; j++) {
            if (dummyrandom((seed + i) / (j + 1)) < 0.3) { // Adjust density of walls
                maze.push({
                    x: i * wallSize,
                    y: j * wallSize,
                    width: wallSize,
                    height: wallSize,
                    originalColor: Constants.WALL_COLOR
                });
            }
        }
    }

    return maze;
}


/**
 * Clamps the game size between the minimum and maximum dimensions.
 * @param size - The game size object.
 * @returns The clamped game size.
 */
export function fixSize(size: GameSize): GameSize {
    size.height = clamp(size.height, Constants.MIN_GAME_HEIGHT, Constants.MAX_GAME_HEIGHT);
    size.width = clamp(size.width, Constants.MIN_GAME_WIDTH, Constants.MAX_GAME_WIDTH);
    return size;
}

/**
 * Checks if a given point is inside a rectangular boundary.
 * @param x - The x-coordinate of the point.
 * @param y - The y-coordinate of the point.
 * @param rect - The rectangle boundary.
 * @returns True if the point is inside the rectangle, otherwise false.
 */
export function isPointInRect(x: number, y: number, rect: { x: number, y: number, width: number, height: number }): boolean {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

/**
 * Rotates a point around a given center by a specified angle.
 * @param point - The point to rotate.
 * @param center - The center of rotation.
 * @param angle - The angle in radians.
 * @returns The rotated point.
 */
export function rotatePoint(point: Point, center: Point, angle: number): Point {
    const cosTheta = Math.cos(angle);
    const sinTheta = Math.sin(angle);
    const dx = point.x - center.x;
    const dy = point.y - center.y;

    return {
        x: cosTheta * dx - sinTheta * dy + center.x,
        y: sinTheta * dx + cosTheta * dy + center.y
    };
}

/**
 * Checks if a point is inside a triangle using the barycentric method.
 * @param px - The x-coordinate of the point.
 * @param py - The y-coordinate of the point.
 * @param v1 - The first vertex of the triangle.
 * @param v2 - The second vertex of the triangle.
 * @param v3 - The third vertex of the triangle.
 * @returns True if the point is inside the triangle, otherwise false.
 */
export function isPointInTriangle(px: number, py: number, v1: Point, v2: Point, v3: Point): boolean {
    const area = (v1.x * (v2.y - v3.y) + v2.x * (v3.y - v1.y) + v3.x * (v1.y - v2.y)) / 2;
    const s = 1 / (2 * area) * (v1.x * (v2.y - py) + v2.x * (py - v1.y) + px * (v1.y - v2.y));
    const t = 1 / (2 * area) * (v1.x * (py - v3.y) + px * (v3.y - v1.y) + v3.x * (v1.y - py));
    return s >= 0 && t >= 0 && (s + t) <= 1;
}

/**
 * Checks if a point is inside a rotated rectangle using Separating Axis Theorem (SAT).
 * @param px - The x-coordinate of the point.
 * @param py - The y-coordinate of the point.
 * @param corners - The four corners of the rotated rectangle.
 * @returns True if the point is inside the rectangle, otherwise false.
 */
export function pointInRotatedRectangle(px: number, py: number, corners: Point[]): boolean {
    const dotProduct = (v1: Point, v2: Point) => v1.x * v2.x + v1.y * v2.y;
    const subtract = (p1: Point, p2: Point) => ({ x: p1.x - p2.x, y: p1.y - p2.y });

    const axes = [
        subtract(corners[1], corners[0]), // Edge between corner 0 and corner 1
        subtract(corners[3], corners[0])  // Edge between corner 0 and corner 3
    ];

    for (const axis of axes) {
        const projections = corners.map(corner => dotProduct(corner, axis));
        const minRectProj = Math.min(...projections);
        const maxRectProj = Math.max(...projections);
        const bulletProj = dotProduct({ x: px, y: py }, axis);

        if (bulletProj < minRectProj || bulletProj > maxRectProj) {
            return false; // No overlap on this axis, no collision
        }
    }

    return true; // Overlap on both axes, collision detected
}

/**
 * Reflects a vector off a surface defined by its normal vector.
 * @param vector - The vector to be reflected.
 * @param normal - The normal vector of the surface.
 * @returns The reflected vector.
 */
export function reflectVector(vector: { dx: number, dy: number }, normal: Point): { dx: number, dy: number } {
    const dotProduct = vector.dx * normal.x + vector.dy * normal.y;
    return {
        dx: vector.dx - 2 * dotProduct * normal.x,
        dy: vector.dy - 2 * dotProduct * normal.y
    };
}

/**
 * Clamps a value between a minimum and maximum value.
 * @param value - The value to clamp.
 * @param min - The minimum allowable value.
 * @param max - The maximum allowable value.
 * @returns The clamped value.
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Calculates the distance between two points.
 * @param p1 - The first point.
 * @param p2 - The second point.
 * @returns The distance between the two points.
 */
export function distance(p1: Point, p2: Point): number {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

/**
 * Converts a string to a numerical seed value by summing its character codes.
 * @param str - The input string.
 * @returns A numerical seed value.
 */
export function StringToSeed(str: string): number {
    return Array.from(str, c => c.charCodeAt(0)).reduce((a, b) => a + b, 0);
}

/**
 * Generates a random color based on a seed value.
 * @param seed - The seed for generating randomness.
 * @returns A random color from the predefined set.
 */
export function getRandomColor(seed: number): string {
    const colors = ['red', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan', 'magenta', 'gold'];
    return colors[Math.floor(dummyrandom(seed) * colors.length)];
}

/**
 * Finds the end of a wall group based on movement direction and teleportation mechanics.
 * @param angle - The movement angle in radians.
 * @param startX - The starting X coordinate.
 * @param startY - The starting Y coordinate.
 * @param walls - An array of walls to check for collisions.
 * @param size - The size of the game area.
 * @param isMovingBackward - Indicates if the movement is in reverse.
 * @returns An object containing the end position and the group of walls, or null if invalid.
 */
export function findGroupEnd(angle: number, startX: number, startY: number, walls: Wall[], size: GameSize, isMovingBackward: boolean): { x: number; y: number; group: Wall[] } | null {
    const group: Wall[] = [];
    const tankMinSize = Constants.TANK_SIZE / 16;
    let endX = startX;
    let endY = startY;

    // Adjust angle for backward movement
    if (isMovingBackward) {
        angle += Math.PI; // Move in the opposite direction
    }

    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    // Determine movement direction
    const isMovingRight = cosAngle > 0 && Math.abs(cosAngle) > Math.abs(sinAngle);
    const isMovingLeft = cosAngle < 0 && Math.abs(cosAngle) > Math.abs(sinAngle);
    const isMovingDown = sinAngle > 0 && Math.abs(sinAngle) > Math.abs(cosAngle);
    const isMovingUp = sinAngle < 0 && Math.abs(sinAngle) > Math.abs(cosAngle);

    // Determine movement offsets based on direction
    const offsetX = isMovingRight ? 1 : isMovingLeft ? -1 : 0;
    const offsetY = isMovingDown ? 1 : isMovingUp ? -1 : 0;

    // Extend in the movement direction while consecutive walls are found
    for (let i = 0; i < Constants.MAX_TELEPORT_DISTANCE; i++) {
        const nextWall = walls.find(wall => {
            const withinX = (endX + offsetX * tankMinSize) >= wall.x && (endX + offsetX * tankMinSize) <= (wall.x + wall.width);
            const withinY = (endY + offsetY * tankMinSize) >= wall.y && (endY + offsetY * tankMinSize) <= (wall.y + wall.height);
            return withinX && withinY;
        });

        if (nextWall) {
            group.push(nextWall);

            // Update end position based on movement direction
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
            // No more consecutive walls found, stop extending
            break;
        }
    }

    // Ensure the final position is within the game bounds
    if (endX < tankMinSize || endX > (size.width - tankMinSize) ||
        endY < tankMinSize || endY > (size.height - tankMinSize)) {
        return null;
    }

    return { x: endX, y: endY, group };
}


// so/a:19303725 : This isn't a uniform sampler. the '10000' is the amount of 'uniformness' it have
export function dummyrandom(seed: number) { 
    const x = Math.sin(seed++) * 1000000;
    return x - Math.floor(x);
}