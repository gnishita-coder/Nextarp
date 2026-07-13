import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches JS-level render/lifecycle errors anywhere below it and shows the
 * actual error + stack instead of letting the app silently die. This only
 * catches JavaScript exceptions - a native (C++/JNI) crash in the camera
 * pipeline will still take the whole process down and won't be caught here,
 * but at least this rules out "it's just a JS bug" vs "it's a native crash".
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[NextarpSDK] Caught render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something crashed</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.message}>{this.state.error.message}</Text>
            <Text style={styles.stack}>{this.state.error.stack}</Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ error: null })}
          >
            <Text style={styles.buttonLabel}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
    padding: spacing.lg,
    paddingTop: 60,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  scroll: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  message: {
    color: '#FFB4B4',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  stack: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.purple,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
