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
  if (scanning) return <View style={styles.root}><CameraView style={StyleSheet.absoluteFill} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={({ data }) => { try { const parsed = JSON.parse(data); setHost(parsed.host); setCode(parsed.pairingCode); setScanning(false); } catch { Alert.alert("Invalid QR code"); } }} /><Pressable style={styles.cancel} onPress={() => setScanning(false)}><Text style={styles.buttonText}>Cancel</Text></Pressable></View>;
  return <View style={styles.root}><StatusBar style={t.statusBar} /><View style={styles.card}><Text style={styles.logo}>CODEX MICRO</Text><Text style={styles.hint}>Pair this controller with the desktop Companion</Text><TextInput value={host} onChangeText={setHost} autoCapitalize="none" style={styles.input} placeholder="http://desktop:8787" placeholderTextColor={t.textMuted} /><TextInput value={code} onChangeText={setCode} style={styles.input} placeholder="000-000" keyboardType="number-pad" placeholderTextColor={t.textMuted} /><Pressable style={styles.primary} onPress={submit}><Text style={styles.buttonText}>PAIR</Text></Pressable><Pressable style={styles.secondary} onPress={scan}><Text style={styles.secondaryText}>SCAN QR</Text></Pressable><Text style={styles.note}>For USB debugging run: adb reverse tcp:8787 tcp:8787</Text></View></View>;
}

const createStyles = (t: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.appBg, alignItems: "center", justifyContent: "center" },
  card: { width: "88%", maxWidth: 460, padding: 28, borderRadius: 26, backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong, shadowColor: t.glow, shadowOpacity: t.mode === "dark" ? 0.35 : 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  logo: { color: t.accent, fontSize: 28, fontWeight: "900", letterSpacing: 3, textShadowColor: t.glow, textShadowRadius: t.mode === "dark" ? 14 : 0, textShadowOffset: { width: 0, height: 0 } },
  hint: { color: t.textSecondary, marginVertical: 18 },
  input: { color: t.textPrimary, backgroundColor: t.inputBg, borderColor: t.border, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  primary: { backgroundColor: t.primary, padding: 15, borderRadius: 14, alignItems: "center", shadowColor: t.glow, shadowOpacity: t.mode === "dark" ? 0.5 : 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  secondary: { backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.border, padding: 15, borderRadius: 14, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#ffffff", fontWeight: "800", letterSpacing: 1 },
  secondaryText: { color: t.accent, fontWeight: "800", letterSpacing: 1 },
  note: { color: t.textMuted, fontSize: 12, marginTop: 18 },
  cancel: { position: "absolute", bottom: 40, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, padding: 16, borderRadius: 14 },
});
