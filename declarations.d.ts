declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  };
  export default AsyncStorage;
}

declare module 'react-native-color-picker' {
  import React from 'react';
  export interface ColorPickerProps {
    onColorSelected?: (color: string) => void;
    style?: any;
  }
  export class ColorPicker extends React.Component<ColorPickerProps> {}
}
