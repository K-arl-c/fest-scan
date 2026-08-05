import { StatusBar } from 'expo-status-bar';
import ScanScreen from './src/screens/ScanScreen';

export default function App() {
  return (
    <>
      <ScanScreen />
      <StatusBar style="light" />
    </>
  );
}
