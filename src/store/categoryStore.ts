import { create } from 'zustand';
import { Category } from '../lib/supabase';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { categoryService } from '../lib/categoryService';

interface CategoryState {
  categories: Category[];
  selectedCategory: Category | null;
  isLoading: boolean;
  setCategories: (categories: Category[]) => void;
  setSelectedCategory: (category: Category | null) => void;
  loadCategories: () => Promise<void>;
  loadSubcategories: (parentId: string) => Promise<Category[]>;
}

export const useCategoryStore = create<CategoryState>((set) => ({
  categories: [],
  selectedCategory: null,
  isLoading: false,

  setCategories: (categories) => set({ categories }),

  setSelectedCategory: (category) => set({ selectedCategory: category }),

  loadCategories: async () => {
    set({ isLoading: true });
    try {
      const categories = await categoryService.getAll();
      set({ categories, isLoading: false });
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error loading categories:');
      set({ isLoading: false });
    }
  },

  loadSubcategories: async (parentId: string) => {
    try {
      const subcategories = await categoryService.getByParent(parentId);
      return subcategories;
    } catch (error) {
      errorHandler.handleDatabaseError(error, 'Error loading subcategories:');
      return [];
    }
  },
}));

