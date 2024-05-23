import { io } from "socket.io-client";

const isBrowser = typeof window !== "undefined";

const getSocketHost = () => {
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3001";
  } else {
    return "https://kutrisserver.hjhj.kr";
  }
};

export const socket = isBrowser
  ? io(getSocketHost(), { transports: ["websocket"] })
  : {};
