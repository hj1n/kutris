const express = require("express");
const app = express();
const server = require("http").createServer(app);
const socketIO = require("socket.io")(server);

const port = process.env.PORT || 3001;

server.listen(port, () => {
  console.log("Socket IO server listening on port" + port);
});

// socket이 연결되었을 때
socketIO.on("connection", (socket) => {
  // success라는 이벤트가 발생했을 때
  console.log("socket connected");
  socket.emit("success", "socket connected - succentEventA");

  socket.on("gameStart", () => {
    console.log("gameStart");
  });
});
