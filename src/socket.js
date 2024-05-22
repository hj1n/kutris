import { io } from "socket.io-client";

const isBrowser = typeof window !== "undefined";

export const socket = isBrowser
  ? io("http://192.168.68.57:3001", { transports: ["websocket"] })
  : {};
