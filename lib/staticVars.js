import { v4 as uuidv4 } from "uuid";

export const staticVars = {
    current_time: () => new Date().toISOString(),
    current_date: () => new Date().toLocaleDateString(),
    uuid: () => uuidv4(),
    random_number: (min = 0, max = 100) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      },
    
    solve: (expr) => {
    try {
        return Function(`"use strict"; return (${expr});`)();
    } catch {
        return "";
    }
    },
    charCount: (str) => {
      try {
        return str.toString().length;
      } catch {
        return "";
      }
    },
  };