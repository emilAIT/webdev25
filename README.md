# TalkFlowChat

TalkFlowChat is a real-time chat application with user authentication and a dynamic chat interface for both individual and group conversations. This project uses **FastAPI** for the backend, vanilla **JavaScript** for frontend interactions, **Socket.IO** for real-time messaging, **HTML/CSS with Tailwind** for styling, and **JWT tokens** for secure authentication. Optionally, Hero UI elements (such as Heroicons) can be used for consistent, visually appealing icons.

---

## Project Overview

TalkFlowChat replicates the design from provided Figma mockups, offering:

- **Authentication**: Sign Up and Sign In screens with secure password handling and JWT token generation.
- **Chat Interface**: A dynamic sidebar with a chat list and a conversation view that supports real-time messaging.
- **Real-Time Communication**: Leveraging Socket.IO, users can send and receive messages instantly.
- **Responsive Design**: Uses Tailwind CSS to match Figma designs and support responsive layouts.
- **Optional Enhancements**: Incorporates Hero UI elements to improve iconography and overall design consistency.
- Command to run : uvicorn backend.main:socket_app --reload

---

## Technologies

- **FastAPI**: Backend API server and WebSocket handler.
- **Vanilla JavaScript**: For client-side logic and DOM manipulation.
- **Socket.IO**: Enabling real-time communication between clients.
- **HTML**: For structuring the UI.
- **CSS with Tailwind**: For design styling that follows the Figma mockups.
- **JWT Tokens**: For secure authentication and API protection.
- **Hero UI Elements**: (Optional) For enhanced UI icons and elements.

---

## Project Architecture

### Frontend
- **Static Files**: HTML, CSS, and JavaScript served by FastAPI.
- **User Interface**: Dynamic UI updates via JavaScript and Socket.IO, including sections for sign up, sign in, and chatting.
- **Authentication**: JWT tokens stored in `localStorage` for maintaining sessions.

### Backend
- **FastAPI Server**: Serves API endpoints, static files, and manages WebSocket connections.
- **Authentication**: Routes for user registration, login, and JWT token generation.
- **Chat Management**: Handles individual and group chat routes, along with message history and real-time updates using Socket.IO.
- **Database**: Utilizes SQLAlchemy models for persisting users, conversations, and messages.

### File Structure

