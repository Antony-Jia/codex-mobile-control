import { useColorScheme } from "react-native";
import type { AgentSlot } from "@codex-micro/protocol";

export type SlotState = AgentSlot["state"];

export type Palette = {
  mode: "dark" | "light";
  statusBar: "light" | "dark";

  // Surfaces
  appBg: string;
  appBgAccent: string; // subtle tinted layer behind the app
  surface: string; // cards
  surfaceAlt: string; // sunken / console
  inputBg: string;
  sheet: string; // modal sheet

  // Lines
  border: string;
  borderStrong: string;
  divider: string;

  // Accent (cyan)
  accent: string;
  accentDim: string;
  accentBg: string;
  accentBorder: string;
  glow: string;

  // Actions
  primary: string;
  primaryBorder: string;
  onAccent: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;

  // Semantic
  success: string;
  warning: string;
  danger: string;
  running: string;

  // Error box
  errorBg: string;
  errorBorder: string;
  errorTitle: string;
  errorText: string;
  errorHint: string;

  // Approval box
  approvalBg: string;
  approvalBorder: string;
  approvalTitle: string;
  approvalBody: string;
  approvalReason: string;
  approveBtn: string;
  declineBtn: string;

  overlay: string;

  slot: Record<SlotState, string>;
};

export const dark: Palette = {
  mode: "dark",
  statusBar: "light",

  appBg: "#04090e",
  appBgAccent: "#071722",
  surface: "#0a141b",
  surfaceAlt: "#071119",
  inputBg: "#061019",
  sheet: "#081218",

  border: "#153040",
  borderStrong: "#1d4152",
  divider: "#122a36",

  accent: "#5fe0ff",
  accentDim: "#5f97a8",
  accentBg: "#0e2f3d",
  accentBorder: "#3ccdec",
  glow: "#25c9ec",

  primary: "#0a86a8",
  primaryBorder: "#3fc5e0",
  onAccent: "#ffffff",

  textPrimary: "#e6f7fd",
  textSecondary: "#8fa8b3",
  textMuted: "#61808c",
  textFaint: "#47616c",

  success: "#2ee08a",
  warning: "#ffb020",
  danger: "#ff4d63",
  running: "#2f9cff",

  errorBg: "#271017",
  errorBorder: "#98394a",
  errorTitle: "#ff7386",
  errorText: "#ffc0c9",
  errorHint: "#925764",

  approvalBg: "#251d0b",
  approvalBorder: "#9b6813",
  approvalTitle: "#ffbd45",
  approvalBody: "#ffe7bd",
  approvalReason: "#a98a55",
  approveBtn: "#16784c",
  declineBtn: "#8a2938",

  overlay: "rgba(2, 6, 10, 0.82)",

  slot: {
    unassigned: "#26333b",
    idle: "#cddde4",
    running: "#2f9cff",
    needs_input: "#ffb020",
    completed_unread: "#2ee08a",
    error: "#ff4d63",
  },
};

export const light: Palette = {
  mode: "light",
  statusBar: "dark",

  appBg: "#eaf1f5",
  appBgAccent: "#dbe9f0",
  surface: "#ffffff",
  surfaceAlt: "#f2f7fa",
  inputBg: "#eef4f7",
  sheet: "#ffffff",

  border: "#d6e2e8",
  borderStrong: "#a7d6e4",
  divider: "#e3ecf0",

  accent: "#0a8fb5",
  accentDim: "#4b7480",
  accentBg: "#dbf3fa",
  accentBorder: "#2bb6d4",
  glow: "#4fc9e4",

  primary: "#0a86a8",
  primaryBorder: "#2bb6d4",
  onAccent: "#ffffff",

  textPrimary: "#0c2530",
  textSecondary: "#3f5a64",
  textMuted: "#6a828c",
  textFaint: "#93a7b0",

  success: "#12a866",
  warning: "#c9820a",
  danger: "#e0374f",
  running: "#1d7fe0",

  errorBg: "#fdecef",
  errorBorder: "#f2b8c1",
  errorTitle: "#c9283e",
  errorText: "#9c2f3d",
  errorHint: "#bd7f8b",

  approvalBg: "#fff5e0",
  approvalBorder: "#ecca86",
  approvalTitle: "#a9750d",
  approvalBody: "#5f4a12",
  approvalReason: "#8c7238",
  approveBtn: "#12a866",
  declineBtn: "#e0374f",

  overlay: "rgba(18, 38, 48, 0.38)",

  slot: {
    unassigned: "#c4d0d6",
    idle: "#5f7d88",
    running: "#1d7fe0",
    needs_input: "#c9820a",
    completed_unread: "#12a866",
    error: "#e0374f",
  },
};

export function useTheme(): Palette {
  const scheme = useColorScheme();
  return scheme === "light" ? light : dark;
}
