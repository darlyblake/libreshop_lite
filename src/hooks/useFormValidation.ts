import React, { useState, useCallback } from 'react';
import { FormValidator, ValidationRules, ValidationResult } from '../utils/validation';

interface UseFormValidationProps {
  rules: ValidationRules;
  initialValues?: Record<string, any>;
  onSubmit?: (data: Record<string, any>) => void | Promise<void>;
  customMessages?: Record<string, string>;
}

interface UseFormValidationReturn {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  handleChange: (field: string, value: any) => void;
  handleBlur: (field: string) => void;
  handleSubmit: () => Promise<void>;
  validateField: (field: string) => string | null;
  validateAll: () => ValidationResult;
  resetForm: () => void;
  setFieldValue: (field: string, value: any) => void;
  setError: (field: string, error: string) => void;
  clearError: (field: string) => void;
}

export const useFormValidation = ({
  rules,
  initialValues = {},
  onSubmit,
  customMessages = {},
}: UseFormValidationProps): UseFormValidationReturn => {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Créer une instance du validateur
  const validator = new FormValidator(rules, customMessages);

  // Mettre à jour une valeur
  const handleChange = useCallback((field: string, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    
    // Valider le champ s'il a déjà été touché
    if (touched[field]) {
      const error = validator.validateField(field, value);
      setErrors(prev => ({
        ...prev,
        [field]: error || '',
      }));
    }
  }, [validator, touched]);

  // Gérer le blur (quand l'utilisateur quitte un champ)
  const handleBlur = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validator.validateField(field, values[field]);
    setErrors(prev => ({
      ...prev,
      [field]: error || '',
    }));
  }, [validator, values]);

  // Valider un champ spécifique
  const validateField = useCallback((field: string): string | null => {
    const error = validator.validateField(field, values[field]);
    setErrors(prev => ({
      ...prev,
      [field]: error || '',
    }));
    return error;
  }, [validator, values]);

  // Valider tous les champs
  const validateAll = useCallback((): ValidationResult => {
    const result = validator.validate(values);
    setErrors(result.errors);
    setTouched(Object.keys(rules).reduce((acc, field) => ({ ...acc, [field]: true }), {}));
    return result;
  }, [validator, values, rules]);

  // Soumettre le formulaire
  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;

    const result = validateAll();
    
    if (!result.isValid) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (onSubmit) {
        await onSubmit(values);
      }
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [validateAll, onSubmit, isSubmitting, values]);

  // Réinitialiser le formulaire
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  // Définir directement une valeur (pour les valeurs externes)
  const setFieldValue = useCallback((field: string, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);

  // Définir une erreur manuellement
  const setError = useCallback((field: string, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  // Effacer une erreur
  const clearError = useCallback((field: string) => {
    setErrors(prev => ({ ...prev, [field]: '' }));
  }, []);

  // Calculer si le formulaire est valide
  const isValid = Object.keys(errors).every(field => !errors[field]);

  return {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    validateField,
    validateAll,
    resetForm,
    setFieldValue,
    setError,
    clearError,
  };
};

export default useFormValidation;
