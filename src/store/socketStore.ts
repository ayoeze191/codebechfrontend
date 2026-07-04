import { writable } from "svelte/store";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { API_URL } from "$lib/api";

type SocketState = {
  isConnected: boolean;
  socket: Socket | null;
};

function createSocketStore() {
  const { subscribe, update } = writable<SocketState>({
    isConnected: false,
    socket: null,
  });

  let socket: Socket | null = null;

  return {
    subscribe,

    async connect(token = localStorage.getItem("codebench_token")) {
      if (socket) return;

      socket = io(API_URL, {
        auth: { token },
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socket.on("connect", () => {
        update((state) => ({ ...state, isConnected: true, socket }));
        console.log("Socket connected");
      });

      socket.on("disconnect", () => {
        update((state) => ({ ...state, isConnected: false }));
        console.log("Socket disconnected");
      });

      socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
      });

      return socket;
    },

    disconnect() {
      if (socket) {
        socket.disconnect();
        socket = null;
        update((state) => ({ ...state, isConnected: false, socket: null }));
      }
    },

    emit(event: string, data?: unknown) {
      if (socket) {
        socket.emit(event, data);
      } else {
        console.warn("Socket not connected");
      }
    },

    on(event: string, callback: (...args: unknown[]) => void) {
      if (socket) {
        socket.on(event, callback);
      }
    },

    off(event: string, callback?: (...args: unknown[]) => void) {
      if (socket) {
        if (callback) {
          socket.off(event, callback);
        } else {
          socket.off(event);
        }
      }
    },
  };
}

export const socketStore = createSocketStore();
