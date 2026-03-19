import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import axios from "axios";

const app = express();

const server = http.createServer(app);

const url = `https://realtime-code-editor-final.onrender.com`;
const interval = 30000;

function reloadWebsite() {
  axios
    .get(url)
    .then((response) => {
      console.log("website reloded");
    })
    .catch((error) => {
      console.error(`Error : ${error.message}`);
    });
}

setInterval(reloadWebsite, interval);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User Connected", socket.id);

let currentRoom = null;
  let currentUser = null;

   socket.on("join", ({ roomId, userName }) => {
    if (currentRoom) {
      socket.leave(currentRoom);
      rooms.get(currentRoom).delete(currentUser);
      io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
    }

     currentRoom = roomId;
    currentUser = userName;

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    rooms.get(roomId).add(userName);

    io.to(roomId).emit("userJoined", Array.from(rooms.get(currentRoom)));
  });

  socket.on("codeChange", ({ roomId, code }) => {
    socket.to(roomId).emit("codeUpdate", code);
  });

  socket.on("leaveRoom", () => {
    if (currentRoom && currentUser) {
      rooms.get(currentRoom).delete(currentUser);
      io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));

      socket.leave(currentRoom);

      currentRoom = null;
      currentUser = null;
    }
  });

  socket.on("typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("userTyping", userName);
  });

  socket.on("languageChange", ({ roomId, language }) => {
    io.to(roomId).emit("languageUpdate", language);
  });


socket.on("compileCode", async ({ code, roomId, language }) => {

  const languageMap = {
    javascript: 63,
    python: 71,
    java: 62,
    cpp: 54
  };

  try {

    const response = await axios.post(
  "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
  {
    source_code: code,
    language_id: languageMap[language]
  },
  {
    headers: {
      "Content-Type": "application/json"
    }
  }
);

    const result = response.data;

    const output =
      result.stdout ||
      result.stderr ||
      result.compile_output ||
      "No Output";

    io.to(roomId).emit("codeResponse", {
      run: {
        output: output
      }
    });

  } catch (error) {

    console.error("API ERROR:", error.response?.data || error.message);

    io.to(roomId).emit("codeResponse", {
      run: {
        output: "Error executing code"
      }
    });

  }

});
 
  socket.on("disconnect", () => {
    if (currentRoom && currentUser) {
      rooms.get(currentRoom).delete(currentUser);
      io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
    }
    console.log("user Disconnected");
  });
});

const port = process.env.PORT || 5000;

const __dirname = path.resolve();

app.use(express.static(path.join(__dirname, "/Frontend/dist")));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "Frontend", "dist", "index.html"));
});

server.listen(port, () => {
  console.log("server is working on port 5000");
});
