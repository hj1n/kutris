import { io } from "socket.io-client";

const isBrowser = typeof window !== "undefined";

export const socket = isBrowser
  ? io("https://kutrisserver.hjhj.kr", { transports: ["websocket"] })
  : {};
