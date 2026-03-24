import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { reloadPage } from '../utils/platformUtils';

interface Props {
  children: ReactNode;
  styles?: any;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryInner extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    errorHandler.handle(error, 'ErrorBoundary', ErrorCategory.SYSTEM, ErrorSeverity.CRITICAL, { errorInfo });
  }

  render() {
    if (this.state.hasError) {
      const { styles } = this.props;
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>⚠️ Une erreur est survenue</Text>
            <Text style={styles.message}>
              L'application a rencontré un problème. Veuillez redémarrer.
            </Text>
            {__DEV__ && this.state.error && (
              <Text style={styles.errorDetails}>{this.state.error.toString()}</Text>
            )}
            <TouchableOpacity 
              style={styles.button}
              onPress={() => reloadPage()}
            >
              <Text style={styles.buttonText}>Recharger l'application</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary: React.FC<{children: ReactNode}> = ({ children }) => {
  const themeContext = useTheme();
  const styles = React.useMemo(() => getStyles(themeContext), [themeContext]);
  
  return <ErrorBoundaryInner styles={styles}>{children}</ErrorBoundaryInner>;
};

const getStyles = (theme: any) => {
  const COLORS = theme.getColor;
  const SPACING = theme.spacing;
  const RADIUS = theme.radius;
  const FONT_SIZE = theme.fontSize;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  content: {
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  errorDetails: {
    fontSize: 12,
    color: COLORS.danger,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.danger + '10',
    borderRadius: 8,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: COLORS.accent,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
};
