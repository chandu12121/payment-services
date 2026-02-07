const { Server } = require("socket.io");

let io;

const init = (server) => {
    io = new Server(server, {
        cors: {
            origin: [
                'https://paymentflowapp.vercel.app',
                'https://payment-app-rho-murex.vercel.app',
                'https://payment-services-z80b.onrender.com',
                'http://localhost:5173',
                'http://127.0.0.1:5173',
                'http://localhost:7000',
                'http://127.0.0.1:7000'
            ],
            methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
            credentials: true
        }
    });

    console.log("Socket.io initialized");

    io.on("connection", (socket) => {
        console.log(`User connected: ${socket.id}`);

        socket.on("join", (userId) => {
            const roomName = userId.toString();
            socket.join(roomName);
            console.log(`User ${roomName} joined room`);
        });

        socket.on("disconnect", () => {
            console.log("User disconnected");
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

/**
 * Send real-time notification to a specific user
 * @param {String} userId - User ID
 * @param {Object} notification - Notification data
 */
const sendNotification = (userId, notification) => {
    if (io) {
        const roomName = userId.toString();
        const notificationData = notification.toJSON ? notification.toJSON() : notification;
        io.to(roomName).emit("newNotification", notificationData);
        console.log(`Real-time notification sent to user room: ${roomName}`);
    }
};

module.exports = {
    init,
    getIO,
    sendNotification
};
