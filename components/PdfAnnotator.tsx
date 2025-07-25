import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform, StatusBar } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import Pdf from 'react-native-pdf';

interface Props {
  uri: string;
  onClose: () => void;
}

type DrawPath = { d: string };
type TextNote = { text: string; x: number; y: number };

export default function PdfAnnotator({ uri, onClose }: Props) {
  const safeTop = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 20;
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [addingText, setAddingText] = useState(false);
  const [text, setText] = useState('');
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [texts, setTexts] = useState<TextNote[]>([]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !addingText,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        setCurrentPath(`M${locationX},${locationY}`);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        setCurrentPath((p) => `${p} L${locationX},${locationY}`);
      },
      onPanResponderRelease: () => {
        if (currentPath) {
          setPaths((ps) => [...ps, { d: currentPath }]);
          setCurrentPath('');
        }
      },
    })
  ).current;

  const handleAddText = (e: any) => {
    if (!addingText) return;
    const { locationX, locationY } = e.nativeEvent;
    setTextPos({ x: locationX, y: locationY });
  };

  const confirmText = () => {
    if (textPos && text.trim()) {
      setTexts((ts) => [...ts, { text, x: textPos.x, y: textPos.y }]);
    }
    setText('');
    setTextPos(null);
    setAddingText(false);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: safeTop }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.btnText}>Close</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setAddingText(false)} style={styles.headerBtn} {...panResponder.panHandlers}>
          <Text style={styles.btnText}>Draw</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setAddingText(true); }} style={styles.headerBtn}>
          <Text style={styles.btnText}>Add Text</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.viewer} onStartShouldSetResponder={() => addingText} onResponderRelease={handleAddText} {...(!addingText ? panResponder.panHandlers : {})}>
        <Pdf source={{ uri }} style={styles.pdf} />
        <Svg style={StyleSheet.absoluteFill}>
          {paths.map((p, i) => <Path key={i} d={p.d} stroke="red" strokeWidth={2} fill="none" />)}
          {currentPath ? <Path d={currentPath} stroke="red" strokeWidth={2} fill="none" /> : null}
          {texts.map((t, i) => (
            <SvgText key={i} x={t.x} y={t.y} fill="blue" fontSize="16">{t.text}</SvgText>
          ))}
        </Svg>
      </View>
      {textPos && addingText && (
        <View style={styles.textInputContainer}>
          <TextInput value={text} onChangeText={setText} placeholder="Enter text" style={styles.input} autoFocus />
          <TouchableOpacity onPress={confirmText} style={styles.addTextBtn}>
            <Text style={styles.btnText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: '#f5f5f5' },
  closeBtn: { padding: 10 },
  headerBtn: { padding: 10 },
  btnText: { color: '#007AFF', fontWeight: 'bold' },
  viewer: { flex: 1 },
  pdf: { flex: 1 },
  textInputContainer: { position: 'absolute', bottom: 40, left: 20, right: 20, flexDirection: 'row', backgroundColor: 'white', padding: 10, borderRadius: 8, elevation: 2 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', marginRight: 10, padding: 8, borderRadius: 4 },
  addTextBtn: { justifyContent: 'center', paddingHorizontal: 10 },
});