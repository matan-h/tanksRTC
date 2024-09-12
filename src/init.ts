import { Game } from "./Game";

// Constants for HTML element IDs
const ROOM_ID_INPUT_ID = 'roomId';
const ROOM_ID_FORM_ID = 'roomIdForm';
const ROOM_ID_BUTTON_ID = 'roomIdButton';

// Initialize URLSearchParams and retrieve the room ID from query parameters
const params = new URLSearchParams(location.search);
const queryId = params.get(ROOM_ID_INPUT_ID);

// Get HTML elements and cast them to the appropriate types
const roomIdInput = document.getElementById(ROOM_ID_INPUT_ID) as HTMLInputElement;
const htmlForm = document.getElementById(ROOM_ID_FORM_ID) as HTMLFormElement;
const roomIdButton = document.getElementById(ROOM_ID_BUTTON_ID) as HTMLButtonElement;

// Set the value of the input field if a room ID is provided in the query parameters
if (queryId) {
    roomIdInput.value = queryId;
}

// Enable the button (assuming it should be enabled when the page loads)
roomIdButton.disabled = false;

// Handle form submission
htmlForm.addEventListener('submit', (event) => {
    event.preventDefault();
    
    // Hide the form after submission
    htmlForm.style.display = 'none';

    // Get the room ID from the input or default to "public"
    const roomId = roomIdInput.value.trim() || "public";

    // Update URL parameters if the room ID has changed
    if (queryId !== roomId) {
        params.set(ROOM_ID_INPUT_ID, roomId);
        window.history.replaceState(null, '', "?" + params.toString());
    }

    // Initialize the Game instance
    new Game('gameCanvas', roomId);
});
