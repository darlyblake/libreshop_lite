import { useCallback } from 'react';
import { Alert } from 'react-native';
import { errorHandler, AppError, ErrorSeverity } from '../utils/errorHandler';

interface UseErrorHandlerReturn {
  handleError: (error: Error | string, context?: string, showUserAlert?: boolean) => AppError;
  handleNetworkError: (error: Error, context?: string) => AppError;
  handleAuthError: (error: Error, context?: string) => AppError;
  handleValidationError: (message: string, context?: string, field?: string) => AppError;
  showErrorAlert: (error: AppError) => void;
  clearErrors: () => void;
  getRecentErrors: () => AppError[];
}

export const useErrorHandler = (): UseErrorHandlerReturn => {
  const handleError = useCallback((
    error: Error | string,
    context = 'Unknown',
    showUserAlert = false
  ): AppError => {
    const appError = errorHandler.handle(error, context);
    
    if (showUserAlert) {
      showErrorAlert(appError);
    }
    
    return appError;
  }, []);

  const handleNetworkError = useCallback((error: Error, context = 'Network'): AppError => {
    return errorHandler.handleNetworkError(error, context);
  }, []);

  const handleAuthError = useCallback((error: Error, context = 'Authentication'): AppError => {
    return errorHandler.handleAuthError(error, context);
  }, []);

  const handleValidationError = useCallback((
    message: string,
    context = 'Validation',
    field?: string
  ): AppError => {
    return errorHandler.handleValidationError(message, context, field);
  }, []);

  const showErrorAlert = useCallback((error: AppError): void => {
    const userMessage = errorHandler.getUserMessage(error);
    const title = error.severity === ErrorSeverity.CRITICAL ? 'Erreur Critique' : 'Erreur';
    
    Alert.alert(title, userMessage, [
      { text: 'OK', style: 'default' },
      ...(error.severity === ErrorSeverity.HIGH || error.severity === ErrorSeverity.CRITICAL
        ? [{ text: 'Réessayer', onPress: () => {/* Handle retry */} }]
        : []
      )
    ]);
  }, []);

  const clearErrors = useCallback((): void => {
    errorHandler.clearHistory();
  }, []);

  const getRecentErrors = useCallback((): AppError[] => {
    return errorHandler.getErrors(10); // 10 dernières erreurs
  }, []);

  return {
    handleError,
    handleNetworkError,
    handleAuthError,
    handleValidationError,
    showErrorAlert,
    clearErrors,
    getRecentErrors,
  };
};

export default useErrorHandler;
