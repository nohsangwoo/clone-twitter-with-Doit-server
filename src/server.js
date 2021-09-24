import express from "express";
import http from "http";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
import FastSpeedtest from "fast-speedtest-api";
import dotenv from "dotenv";
// import cors from "cors";

// .env 사용설정
dotenv.config();

const app = express();

// app.use(cors());

const httpServer = http.createServer(app);

console.log("CLIENT_URL:", process.env.CLIENT_URL);
console.log("NODE_ENV:", process.env.NODE_ENV);

const PORT = process.env.PORT || 8000;

httpServer.listen(PORT, () => console.log(`server is running on port ${PORT}`));

// 백엔드가 프론트의 요청에대한 응답시
// 응답내용에 scheme정보를 같이 보내는데
// 원래 같은 출처가 아니라면 브라우저가 백엔드의 응답을 거부하는데
// 백엔드에서 해당 scheme에선 응답을 받아도된다라고 정보를 주고
// 그정보를 브라우저에서 인식한 이후 백엔드의 응답을 거부하지 않고 허용한다.

const URL_FOR_CORS =
  process.env.NODE_ENV === "dev"
    ? "http://localhost:3000"
    : process.env.CLIENT_URL;

const io = new Server(httpServer, {
  // cors설정도 해줌
  cors: {
    origin: ["https://admin.socket.io", URL_FOR_CORS],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

instrument(io, {
  auth: false,
});

// nodeje에 접속한 유저현황
let users = {};

// let adminUser = [
//   { socketId: "sdf", currentRoom }
// ];
let adminSocketIds = [];

// Nodejs에 만들어진 방 현황
let socketToRoom = [];
// socketToRoom:  [
//   {
//     socketId: 'GL2cT22KTs7SE6OxAAAH',
//     roomId: '311792a0-0af0-11ec-8f25-e3485be10586',
//     counselType: 'Video',
//     userType: 'Client'
//   }
// ]

let speedtest = new FastSpeedtest({
  token: "YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm", // required
  verbose: false, // default: false
  timeout: 10000, // default: 5000
  https: true, // default: true
  urlCount: 5, // default: 5
  bufferSize: 8, // default: 8
  unit: FastSpeedtest.UNITS.Mbps, // default: Bps
});

io.on("connection", (socket) => {
  // socket.emit("all users", socketToRoom);
  // console.log(socket);
  // 프론트단에서 uuid로 만들어진 roomId를 전달받음
  socket.on("admin check", (adminCheck) => {
    console.log("adminCheck", adminCheck);
    if (adminCheck) {
      console.log("어드민 아이디", socket.id);
      adminSocketIds.push(socket.id);
      console.log("어드민 현황: ", adminSocketIds);
      // console.log("어드민 현황:2 ", adminSocketIds[0]);
    }
    // socket.to(adminSocketIds[0]).emit("all users", socketToRoom);
    socket.emit("all users", socketToRoom);
  });

  socket.on("message", ({ name, message }) => {
    if (message === "speed") {
      const infoMessage = "속도 측정중입니다 잠시만 기다려주세요";
      io.emit("message", { name, message: infoMessage });
      (async function getSpeed() {
        try {
          const getSpeed = await speedtest.getSpeed();
          console.log("getSpeed", getSpeed);
          const getSpeedMessage = `속도 측정 완료 Speed: ${getSpeed} Mbps`;
          io.emit("message", { name, message: getSpeedMessage });
        } catch (e) {
          console.log(e.message);
        }
      })();
      console.log("speed message: ", message);
    } else {
      io.emit("message", { name, message });
    }
  });

  socket.on("join room", ({ roomID, counselType, userType }) => {
    console.log("userType?: ", roomID, counselType, userType);
    // 사용자가 roomID를 기준으로 방을 만들던가 기존에 방이 존재하면 기존 방에 접속하는 기능
    socket.join(roomID);

    // socketToRoom안에 같은 아이디로 만들어진 방이 존재하는지 유효성 검사
    // 이미 만들어진 방이 존재하면 join room 작동 금지(early return)
    const even = (el) => el.socketId === socket.id;
    console.log("방이 이미 존재하는지 체크", even);
    const validationCheck = socketToRoom.some(even);
    console.log("유효성 검사값: ", validationCheck);
    if (validationCheck) {
      return;
    }

    console.log("join room about the room id : ", roomID);

    // 사용자 현황 최신화 후 방에 누가 있는지 현황 추가
    // socket.id가 key : roomId가 value
    socketToRoom.push({
      socketId: socket.id,
      roomId: roomID,
      counselType,
      userType,
    });
    console.log("socketToRoom: ", socketToRoom);

    // 3. 사용자 현황(users) 최신화--------------
    // 4. 만약 users목록에 전달 받은 해당 roomId가 이미 존재한다면
    // 5. FE에서 전달받은 roomId로 usersobj에 해당 roomId가 존재한다면
    // 6. 이미 존재하는 방에 내 고유 socket.io의 키값을 push 해줌
    // ------------------- 방 접속자인 경우
    if (users[roomID]) {
      // 7.해당 방의 총인원을 계산하고
      const lengthInRoom = users[roomID].length;
      // 8. 이때 만약 같은방에 동시에 접속하는 사람수가 2명이상이면 return 시켜버림
      // 9. 혹시 room이 full일때 작동하는 것

      console.log(
        "방이 이미 존재하는군요. \n 접속하신 방이름은 ",
        roomID,
        "입니다."
      );
      console.log("해당 방엔 총 ", lengthInRoom, "명이 존재 합니다.");
      // 10. 뱡에 2명이상 참여하지 못하게(방장포함) 제한을 걸어두기위한 설정

      // early return  사용자의 길이가 1명을 초과 한다면 바로 리턴시켜서 아무작업도 못하게 해버림
      // 3명째부터는 아무런 동작도 못함
      // if (length > 1) {
      //   socket.emit('is reject');
      //   return;
      // }

      //
      users[roomID].push(socket.id);
      console.log("총 사용자 현황입니다: ", users);
      // 접속한 자신을 제외하고 모든 사용자에게 자신이 접속했다고 알린 이후 프로세스 진행
      socket.to(roomID).emit("comeInNewUser", socketToRoom);
    } else {
      // ------------------ 방 생성자인경우
      console.log(
        "방 생성자시군요. \n 방이름",
        roomID,
        "으로 방 생성하셨습니다."
      );
      users[roomID] = [socket.id];
      console.log("총 사용자의 방 정보 현황입니다: ", users);
    }
    // -----------------end of 사용자 현황(users) 최신화--------------

    // 자기자신의 정보를 제외하고 방안에 존재하는 모든 유저의 방정보를 최신화
    // const usersInThisRoom = users[roomID].filter((id) => id !== socket.id);

    // 최신화된 방정보를 client로 전달
    // console.log()

    // socket.to(roomID).emit("all users", socketToRoom);
    // 모든 admin에게 현재 접속한 유저의 현황 최신화
    adminSocketIds.forEach((adminId) => {
      socket.to(adminId).emit("all users", socketToRoom);
    });
  });
  //   -------------- end of join room

  // Peer B가 접속한 이후
  // Peer A는 PeerB에게 offer를 전달한다.
  socket.on("offer", (offer, roomName) => {
    console.log("sent offer to peer B from peer A");
    // offer를 전달하는 과정은 socket.io가 담당한다.
    socket.to(roomName).emit("offer", offer);
  });

  // 방에 새로 접속한 사람의 asnwer정보를 방안의 모든 유저에게 전달
  socket.on("answer", (answer, roomName) => {
    console.log("sent answer to peer A from peerB");
    socket.to(roomName).emit("answer", answer);
  });

  socket.on("ice", (ice, roomName) => {
    console.log("sent ice Candidate");
    socket.to(roomName).emit("ice", ice);
  });

  socket.on("sending signal", (payload) => {
    //접속한 유저를 제외한 나머지 유저의 정보를 중 signal을 기준으로 user joined 트리거를 건든다
    // 즉 두번째 접속한 유저부터 발동됨
    // 다른 유저중 한명의 아이디, 방주인의 아이디, 다른유저중 한명의 시그널을 전달 받음
    // 다른 유저중 한명의 아이디로 emit 함
    // emit을 특정 유저만 타게팅해서 해당 유저만 작동하게 함
    // (귓속말로 시그널 연결을 요청함)
    // 전달 받은 유저는 시그널 접속자의 시그널정보와 방주인의 아이디를 전달받음
    io.to(payload.userToSignal).emit("user joined", {
      // 새로 접속한 사람 자신의 시그널 정보와 방주인의 아이디를함께 보냄
      signal: payload.signal,
      callerID: payload.callerID,
    });
  });

  // 귓속말로 전달 받은 사람의 signal정보와 방주인의 아이디를 기준으로
  //   방주인에게 귓속말을 함
  // 방주인에게 귓속말 전달 받은 사람의 시그널과 , socket.id를 전달 한다
  socket.on("returning signal", (payload) => {
    //   귓속말 받은 사람의 시그널 정보와 socketid를 전달하여
    // 방장이 모든 peer의 정보를 최신화 할수있게 해줌
    // 즉 귓속말 받고 시그널 요청을 수락한 peer 상태를 방장에게 보내서 방장이 다시 최신화 할수있게끔함
    io.to(payload.callerID).emit("receiving returned signal", {
      signal: payload.signal,
      id: socket.id,
    });
  });

  // when user left(not host) at group call
  socket.on("group-call-user-left", (data) => {
    console.log(socket.id);
    console.log("유저가 방을 나갔습니다.", data);
    if (!data.roomHostInfo) {
      console.log("연결된 통화가 없습니다.");
      return;
    }
    // console.log(`id:${streamId}, 유저가 방을 나갔습니다.`);
    if (data?.roomHostInfo?.roomId) {
      socket.leave(data?.roomHostInfo?.roomId);
    }
    // 유저 방 현황 최신화
    const newSocketToRoom = socketToRoom.filter((element) => {
      return element.socketId !== socket.id;
    });

    let CurrentUsersInRoom = users[data.roomHostInfo.roomId];
    let newCurrentUsersInRoom;
    if (CurrentUsersInRoom) {
      newCurrentUsersInRoom = CurrentUsersInRoom.filter(
        (id) => id !== socket.id
      );
      // users[roomID] = room;
    }

    console.log("전처리된 유저 현황: newSocketToRoom", newSocketToRoom);

    console.log(
      "전처리된 유저 현황: newCurrentUsersInRoom",
      newCurrentUsersInRoom
    );

    io.to(data?.roomHostInfo?.roomId).emit("group-call-user-left", {
      leftUserSocketId: data.leftUserSocketId,
    });
    users[data.roomHostInfo.roomId] = newCurrentUsersInRoom;
    socketToRoom = newSocketToRoom;

    if (newCurrentUsersInRoom.length === 0) {
      delete users[data?.roomHostInfo?.roomId];
    }
    adminSocketIds.forEach((adminId) => {
      socket.to(adminId).emit("all users", socketToRoom);
    });
    console.log("최신화된 유저 현황 socketToRoom: ", socketToRoom);

    console.log("최신화된 유저 현황 users: ", users);
  });

  // end of user left group call

  //접속이 끊어질때 행동 뭔가 실시간은 아님
  // disconnect는 기본 기능 사용자가 나가는걸 자동으로 감지해줌
  socket.on("disconnect", () => {
    // emit cheatsheet
    // socket.broadcast.emit('user left');
    // io.sockets.emit('user left');
    // io.to(adminSocketIds[0]).emit('all users', socketToRoom);
    // io.to(adminSocketIds[0]).emit('user left');

    console.log("사용자가 나갔습니다", socket.id);
    console.log("나간 사용자의 socketId 및 roomId: ", socketToRoom);

    console.log("어드민 리스트 현황: ", adminSocketIds);

    const found = socketToRoom.find(
      (element) => element.socketId === socket.id
    );

    if (found) {
      console.log("존재하는 유저가 나감");
    }

    if (adminSocketIds.includes(socket.id)) {
      adminSocketIds = adminSocketIds.filter(
        (socketId) => socketId !== socket.id
      );
      console.log("어드민 나감 그리고 어드민 현황: ", adminSocketIds);
    }

    // 유저 방 현황 최신화
    const newSocketToRoom = socketToRoom.filter((element) => {
      return element.socketId == socket.id;
    });

    // 나간사용자가 속한 방을 찾음 (roomId)
    const roomID = newSocketToRoom[0]?.roomId;
    // // 찾은 roomId로 사용자 접속현황에서 해당 방에 속한 사람을 최신화
    let room = users[roomID];

    if (room) {
      room = room.filter((id) => id !== socket.id);
      users[roomID] = room;
      socketToRoom = socketToRoom.filter((element) => {
        return element.socketId !== socket.id;
      });
      if (room.length === 0) {
        delete users[roomID];
      }
      console.error("--------------------------");

      // console.log('asdfasf: ', socketToRoom2);
      console.log("socketToRoom: ", socketToRoom);
      console.log("사용자현황", users);

      // 방 현황을 모든 admin에게 전달
      adminSocketIds.forEach((adminId) => {
        io.to(adminId).emit("all users", socketToRoom);
      });
    }
    //방 최신화 끝
  });
});
