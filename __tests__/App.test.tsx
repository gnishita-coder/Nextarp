/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { HomeScreen } from '../src/screens/HomeScreen';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/documents',
  stat: jest.fn(() => Promise.resolve({ size: 0 })),
}));

jest.mock('react-native-linear-gradient', () => {
  const { View } = require('react-native');
  return View;
});

jest.mock('@react-native-vector-icons/ionicons/static', () => {
  const { Text } = require('react-native');
  const React = require('react');
  return {
    Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name),
  };
});

jest.mock('../src/storage', () => ({
  deleteDocument: jest.fn(() => Promise.resolve()),
  getSavedDocuments: jest.fn(() => Promise.resolve([])),
  persistCapturedPhoto: jest.fn(),
  renameDocument: jest.fn(() => Promise.resolve()),
  saveDocumentRecord: jest.fn(),
  clearAllDocuments: jest.fn(() => Promise.resolve()),
  formatFileSize: jest.fn(() => '0 KB'),
  formatRelativeTimestamp: jest.fn(() => 'Today'),
}));

jest.mock('../src/scanner', () => ({
  launchSinglePageScanner: jest.fn(),
}));

jest.mock('../src/permissions/cameraPermission', () => ({
  requestCameraPermission: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('../src/quality/imageQuality', () => ({
  analyzeImageQuality: jest.fn(),
}));

jest.mock('../src/vision/faceCheck', () => ({
  checkContainsFace: jest.fn(),
}));

jest.mock('../src/vision/nationalityCheck', () => ({
  checkNationalityMatch: jest.fn(),
}));

test('renders correctly', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  ReactTestRenderer.act(() => {
    renderer.unmount();
  });
});

test('starts the document scan flow from the home hero', async () => {
  const onRequestScan = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <HomeScreen
        documents={[]}
        captureMode="automatic"
        onChangeCaptureMode={jest.fn()}
        onRequestScan={onRequestScan}
        onViewAllDocuments={jest.fn()}
        onOpenDocument={jest.fn()}
        onDeleteDocument={jest.fn()}
        nationality="ES"
        onPressNationality={jest.fn()}
      />,
    );
  });

  ReactTestRenderer.act(() => {
    renderer.root.findByProps({ accessibilityLabel: 'Start scan' }).props.onPress();
  });

  expect(onRequestScan).toHaveBeenCalledTimes(1);
  ReactTestRenderer.act(() => {
    renderer.unmount();
  });
});
