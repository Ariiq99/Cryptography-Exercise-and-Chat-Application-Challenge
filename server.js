const http = require("http");
const socketIo = require("socket.io");

const server = http.createServer();
const io = socketIo(server);

// Map untuk menyimpan username dan public key
const users = new Map();

io.on("connection", (socket) => {
  console.log(`Client ${socket.id} connected`);

  // Kirim daftar pengguna beserta public key-nya ke client baru
  socket.emit("init", Array.from(users.entries()));

  // Pendaftaran public key client
  socket.on("registerPublicKey", (data) => {
    const { username, publicKey } = data;
    users.set(username, publicKey);
    console.log(`${username} registered with public key.`);

    // Broadcast user baru ke seluruh client
    io.emit("newUser", { username, publicKey });
  });

  // Meneruskan pesan (publik maupun rahasia)
  socket.on("message", (data) => {
    const { username, message, targetUsername } = data;
    io.emit("message", { username, message, targetUsername });
  });

  socket.on("disconnect", () => {
    console.log(`Client ${socket.id} disconnected`);
  });
});

const port = 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});