import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { parsePoster, type OcrBlock, type PosterGuess } from '../ocr/parsePoster';

type ScanState =
  | { phase: 'idle' }
  | { phase: 'recognizing' }
  | { phase: 'done'; guess: PosterGuess; blocks: OcrBlock[] }
  | { phase: 'error'; message: string };

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>({ phase: 'idle' });
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need camera access to scan a poster.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant access</Text>
        </Pressable>
      </View>
    );
  }

  async function runOcr(uri: string) {
    setState({ phase: 'recognizing' });
    try {
      const result = await TextRecognition.recognize(uri);
      const blocks: OcrBlock[] = result.blocks.map((b) => ({
        text: b.text,
        height: b.frame?.height ?? 0,
        top: b.frame?.top ?? 0,
      }));

      const guess = parsePoster(blocks);
      setState({ phase: 'done', guess, blocks });
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  async function handleCapture() {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
    if (!photo) return;
    await runOcr(photo.uri);
  }

  async function handlePickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    await runOcr(result.assets[0].uri);
  }

  if (state.phase === 'done' || state.phase === 'error') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.results}>
        <Pressable style={styles.button} onPress={() => setState({ phase: 'idle' })}>
          <Text style={styles.buttonText}>Scan again</Text>
        </Pressable>

        {state.phase === 'error' ? (
          <Text style={styles.error}>{state.message}</Text>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Best guess</Text>
            <Text style={styles.field}>Title: {state.guess.title ?? '—'}</Text>
            <Text style={styles.field}>Dates: {state.guess.dateRange ?? '—'}</Text>
            <Text style={styles.field}>Lineup: {state.guess.lineup.join(', ') || '—'}</Text>

            <Text style={styles.sectionTitle}>Raw OCR blocks</Text>
            {state.blocks.map((b, i) => (
              <Text key={i} style={styles.blockText}>
                [{Math.round(b.height)}px] {b.text}
              </Text>
            ))}
          </>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} />
      <View style={styles.captureBar}>
        {state.phase === 'recognizing' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Pressable style={styles.captureButton} onPress={handleCapture} />
            <Pressable style={styles.libraryButton} onPress={handlePickFromLibrary}>
              <Text style={styles.libraryButtonText}>Choose from library</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  captureBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  libraryButton: { marginTop: 18, paddingVertical: 8, paddingHorizontal: 14 },
  libraryButtonText: { color: '#fff', fontWeight: '600', textDecorationLine: 'underline' },
  message: { textAlign: 'center', color: '#fff', marginBottom: 16 },
  button: {
    alignSelf: 'center',
    backgroundColor: '#FF5A3C',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    margin: 16,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
  results: { padding: 20, paddingTop: 60 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  field: { color: '#fff', marginBottom: 4 },
  blockText: { color: '#aaa', fontSize: 12, marginBottom: 4 },
  error: { color: '#FF5A3C', marginTop: 20 },
});
