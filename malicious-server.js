const http = require("http");
const socketIo = require("socket.io");

const server = http.createServer();
const io = socketIo(server);

io.on("connection", (socket) => {
  console.log(`Client ${socket.id} connected`);

  socket.on("message", (data) => {
    let { username, message, hash } = data;
    
    // Server jahat mengacak/mengubah isi pesan
    message = message + " (sus?)";

    // Server meneruskan data yang sudah diubah (tetapi hash asli tetap dibawa)
    io.emit("message", { username, message, hash });
  });

  socket.on("disconnect", () => {
    console.log(`Client ${socket.id} disconnected`);
  });
});

const port = 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});