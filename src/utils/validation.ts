// Utilitaires de validation des données pour LibreShop
// Remplace toutes les validations manuelles par un système centralisé

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  min?: number;
  max?: number;
  custom?: (value: any) => string | null;
}

export interface ValidationRules {
  [key: string]: ValidationRule;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface FieldValidation {
  field: string;
  value: any;
  rule: ValidationRule;
}

// Patterns de validation réutilisables
export const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[1-9]\d{1,14}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
  slug: /^[a-z0-9-]+$/,
  price: /^\d+(\.\d{1,2})?$/,
  url: /^https?:\/\/.+/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  name: /^[a-zA-ZÀ-ÿ\s'-]{2,50}$/,
  reference: /^[A-Z0-9-_]{3,20}$/,
};

// Messages d'erreur par défaut
export const ERROR_MESSAGES = {
  required: 'Ce champ est obligatoire',
  minLength: (min: number) => `Ce champ doit contenir au moins ${min} caractères`,
  maxLength: (max: number) => `Ce champ ne peut pas dépasser ${max} caractères`,
  min: (min: number) => `La valeur minimale est ${min}`,
  max: (max: number) => `La valeur maximale est ${max}`,
  email: 'Veuillez entrer une adresse email valide',
  phone: 'Veuillez entrer un numéro de téléphone valide',
  password: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre',
  slug: 'Le slug ne peut contenir que des lettres minuscules, chiffres et tirets',
  price: 'Veuillez entrer un prix valide',
  url: 'Veuillez entrer une URL valide',
  alphanumeric: 'Ce champ ne peut contenir que des lettres et chiffres',
  name: 'Veuillez entrer un nom valide (2-50 caractères)',
  reference: 'La référence doit contenir 3-20 caractères alphanumériques',
};

// Classes de validation spécialisées
export class FormValidator {
  private rules: ValidationRules;
  private customMessages: Record<string, string>;

  constructor(rules: ValidationRules, customMessages: Record<string, string> = {}) {
    this.rules = rules;
    this.customMessages = customMessages;
  }

  /**
   * Valide un champ spécifique
   */
  validateField(field: string, value: any): string | null {
    const rule = this.rules[field];
    if (!rule) return null;

    // Validation required
    if (rule.required && (!value || value.toString().trim() === '')) {
      return this.customMessages[field] || ERROR_MESSAGES.required;
    }

    // Si le champ est vide et non requis, pas d'autres validations
    if (!value || value.toString().trim() === '') {
      return null;
    }

    const stringValue = value.toString();

    // Validation minLength
    if (rule.minLength && stringValue.length < rule.minLength) {
      return this.customMessages[`${field}_minLength`] || ERROR_MESSAGES.minLength(rule.minLength);
    }

    // Validation maxLength
    if (rule.maxLength && stringValue.length > rule.maxLength) {
      return this.customMessages[`${field}_maxLength`] || ERROR_MESSAGES.maxLength(rule.maxLength);
    }

    // Validation pattern
    if (rule.pattern && !rule.pattern.test(stringValue)) {
      const patternName = this.getPatternName(rule.pattern);
      return this.customMessages[`${field}_pattern`] || ERROR_MESSAGES[patternName] || 'Format invalide';
    }

    // Validation numérique
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        return this.customMessages[`${field}_min`] || ERROR_MESSAGES.min(rule.min);
      }
      if (rule.max !== undefined && value > rule.max) {
        return this.customMessages[`${field}_max`] || ERROR_MESSAGES.max(rule.max);
      }
    }

    // Validation custom
    if (rule.custom) {
      const customError = rule.custom(value);
      if (customError) return customError;
    }

    return null;
  }

  /**
   * Valide tous les champs d'un formulaire
   */
  validate(data: Record<string, any>): ValidationResult {
    const errors: Record<string, string> = {};

    for (const field in this.rules) {
      const error = this.validateField(field, data[field]);
      if (error) {
        errors[field] = error;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Identifie le nom d'un pattern pour les messages d'erreur
   */
  private getPatternName(pattern: RegExp): string {
    for (const [name, regex] of Object.entries(PATTERNS)) {
      if (regex.toString() === pattern.toString()) {
        return name;
      }
    }
    return 'unknown';
  }
}

// Fonctions utilitaires de validation
export const validateEmail = (email: string): string | null => {
  if (!email || email.trim() === '') return ERROR_MESSAGES.required;
  if (!PATTERNS.email.test(email)) return ERROR_MESSAGES.email;
  return null;
};

export const validatePhone = (phone: string): string | null => {
  if (!phone || phone.trim() === '') return null; // Phone is optional
  if (!PATTERNS.phone.test(phone)) return ERROR_MESSAGES.phone;
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password || password.trim() === '') return ERROR_MESSAGES.required;
  if (!PATTERNS.password.test(password)) return ERROR_MESSAGES.password;
  return null;
};

export const validatePrice = (price: string | number): string | null => {
  const value = typeof price === 'string' ? price : price.toString();
  if (!value || value.trim() === '') return ERROR_MESSAGES.required;
  if (!PATTERNS.price.test(value)) return ERROR_MESSAGES.price;
  const numValue = parseFloat(value);
  if (numValue <= 0) return 'Le prix doit être supérieur à 0';
  if (numValue > 999999) return 'Le prix ne peut pas dépasser 999999';
  return null;
};

export const validateSlug = (slug: string): string | null => {
  if (!slug || slug.trim() === '') return ERROR_MESSAGES.required;
  if (!PATTERNS.slug.test(slug)) return ERROR_MESSAGES.slug;
  return null;
};

export const validateName = (name: string): string | null => {
  if (!name || name.trim() === '') return ERROR_MESSAGES.required;
  if (!PATTERNS.name.test(name)) return ERROR_MESSAGES.name;
  return null;
};

export const validateReference = (reference: string): string | null => {
  if (!reference || reference.trim() === '') return null; // Optional
  if (!PATTERNS.reference.test(reference)) return ERROR_MESSAGES.reference;
  return null;
};

// Pré-configurations de validation pour les formulaires courants
export const VALIDATION_RULES = {
  // Authentification
  login: {
    email: { required: true, pattern: PATTERNS.email },
    password: { required: true, minLength: 6 },
  },
  register: {
    email: { required: true, pattern: PATTERNS.email },
    password: { required: true, pattern: PATTERNS.password },
    fullName: { required: true, minLength: 2, maxLength: 50, pattern: PATTERNS.name },
    phone: { required: false, pattern: PATTERNS.phone },
  },
  
  // Boutique
  store: {
    name: { required: true, minLength: 2, maxLength: 100, pattern: PATTERNS.name },
    slug: { required: true, minLength: 3, maxLength: 50, pattern: PATTERNS.slug },
    description: { required: false, maxLength: 500 },
    category: { required: true },
    email: { required: true, pattern: PATTERNS.email },
    phone: { required: true, pattern: PATTERNS.phone },
    address: { required: true, minLength: 10 },
  },
  
  // Produit
  product: {
    name: { required: true, minLength: 2, maxLength: 100 },
    description: { required: false, maxLength: 1000 },
    price: { required: true, pattern: PATTERNS.price, custom: validatePrice },
    comparePrice: { required: false, pattern: PATTERNS.price, custom: validatePrice },
    stock: { required: true, min: 0, max: 99999 },
    reference: { required: false, pattern: PATTERNS.reference },
    category: { required: true },
  },
  
  // Commande
  order: {
    customerName: { required: true, pattern: PATTERNS.name },
    customerEmail: { required: true, pattern: PATTERNS.email },
    customerPhone: { required: true, pattern: PATTERNS.phone },
    deliveryAddress: { required: true, minLength: 20 },
  },
};

export default FormValidator;
