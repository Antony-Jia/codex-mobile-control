import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useController } from "../store/controller";
import { useTheme, type Palette } from "../theme";

export function PairingScreen() {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const pair = useController((s) => s.pair); const [host, setHost] = useState("http://127.0.0.1:8787"); const [code, setCode] = useState(""); const [scanning, setScanning] = useState(false); const [permission, requestPermission] = useCameraPermissions();
  const submit = async () => { try { await pair(host, code); } catch (error) { Alert.alert("Pairing failed", error instanceof Error ? error.message : String(error)); } };
  const scan = async () => { if (!permission?.granted && !(await requestPermission()).granted) return; setScanning(true); };
  if (scanning) return <View style={styles.root}><CameraView style={StyleSheet.absoluteFill} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={({ data }) => { try { const parsed = JSON.parse(data); setHost(parsed.host); setCode(parsed.pairingCode); setScanning(false); } catch { Alert.alert("Invalid QR code"); } }} /><View style={styles.scanFrame}><View style={[styles.corner, styles.cornerTL]} /><View style={[styles.corner, styles.cornerTR]} /><View style={[styles.corner, styles.cornerBL]} /><View style={[styles.corner, styles.cornerBR]} /></View><Pressable style={styles.cancel} onPress={() => setScanning(false)}><Text style={styles.buttonText}>Cancel</Text></Pressable></View>;
  return <View style={styles.root}><StatusBar style={t.statusBar} /><View style={styles.ambient} /><View style={styles.card}><View style={[styles.corner, styles.cornerTL]} /><View style={[styles.corner, styles.cornerTR]} /><View style={[styles.corner, styles.cornerBL]} /><View style={[styles.corner, styles.cornerBR]} /><View style={styles.brandRow}><View style={styles.brandDot} /><Text style={styles.logo}>CODEX MICRO</Text></View><Text style={styles.hint}>Pair this controller with the desktop Companion</Text><View style={styles.fieldGroup}><Text style={styles.fieldLabel}>COMPANION HOST</Text><TextInput value={host} onChangeText={setHost} autoCapitalize="none" style={styles.input} placeholder="http://desktop:8787" placeholderTextColor={t.textMuted} /></View><View style={styles.fieldGroup}><Text style={styles.fieldLabel}>PAIRING CODE</Text><TextInput value={code} onChangeText={setCode} style={styles.input} placeholder="000-000" keyboardType="number-pad" placeholderTextColor={t.textMuted} /></View><Pressable style={styles.primary} onPress={submit}><Text style={styles.buttonText}>PAIR</Text></Pressable><Pressable style={styles.secondary} onPress={scan}><Text style={styles.secondaryText}>SCAN QR</Text></Pressable><Text style={styles.note}>For USB debugging run: adb reverse tcp:8787 tcp:8787</Text></View></View>;
}

const createStyles = (t: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.appBg, alignItems: "center", justifyContent: "center" },
  ambient: { position: "absolute", top: -120, left: -80, right: -80, height: 320, backgroundColor: t.gridline, borderRadius: 200, opacity: t.mode === "dark" ? 1 : 0.6 },
  card: { width: "88%", maxWidth: 460, padding: 28, borderRadius: 26, backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong, shadowColor: t.glow, shadowOpacity: t.mode === "dark" ? 0.45 : 0.18, shadowRadius: 28, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  corner: { position: "absolute", width: 18, height: 18, borderColor: t.glowStrong, borderWidth: 2 },
  cornerTL: { top: 10, left: 10, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 10, right: 10, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 10, left: 10, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 10, right: 10, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.accent, shadowColor: t.glow, shadowOpacity: 0.9, shadowRadius: 8, elevation: 4 },
  logo: { color: t.accent, fontSize: 28, fontWeight: "900", letterSpacing: 3, textShadowColor: t.glow, textShadowRadius: t.mode === "dark" ? 16 : 0, textShadowOffset: { width: 0, height: 0 } },
  hint: { color: t.textSecondary, marginVertical: 18, letterSpacing: 0.3 },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: { color: t.textFaint, fontSize: 9, fontWeight: "900", letterSpacing: 2, marginBottom: 6 },
  input: { color: t.textPrimary, backgroundColor: t.inputBg, borderColor: t.border, borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 14 },
  primary: { backgroundColor: t.primary, padding: 15, borderRadius: 14, alignItems: "center", marginTop: 4, shadowColor: t.glow, shadowOpacity: t.mode === "dark" ? 0.55 : 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 6, borderWidth: 1, borderColor: t.primaryBorder },
  secondary: { backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.accentBorder, padding: 15, borderRadius: 14, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#ffffff", fontWeight: "800", letterSpacing: 2 },
  secondaryText: { color: t.accent, fontWeight: "800", letterSpacing: 2 },
  note: { color: t.textMuted, fontSize: 12, marginTop: 18, textAlign: "center" },
  cancel: { position: "absolute", bottom: 40, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, padding: 16, borderRadius: 14 },
  scanFrame: { position: "absolute", top: "50%", left: "50%", marginLeft: -110, marginTop: -110, width: 220, height: 220, borderColor: "transparent" },
});
