import { supabase } from './supabase';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../utils/errorHandler';
import { Category } from './supabase';

// Category Service
export const categoryService = {
  async getAll(): Promise<Category[]> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Category> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getBySlug(slug: string): Promise<Category> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error) throw error;
    return data;
  },

  async getByParent(parentId: string | null): Promise<Category[]> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data, error } = parentId
      ? await supabase
          .from('categories')
          .select('*')
          .eq('parent_id', parentId)
          .order('name', { ascending: true })
      : await supabase
          .from('categories')
          .select('*')
          .is('parent_id', null)
          .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async create(category: Partial<Category>): Promise<Category> {
    if (!supabase) throw new Error('Supabase not initialized');
    
    // Générer le slug automatiquement si non fourni
    const slug = category.slug || 
      category.name?.toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '') || 
      '';
    
    // Nettoyer les données pour n'envoyer que les champs valides
    const { id, createdAt, ...validData } = category as any;
    
    const { data, error } = await supabase
      .from('categories')
      .insert({
        ...validData,
        slug,
      })
      .select('*')
      .single();
    
    if (error) {
      // INSERT ERROR:: error;
      throw error;
    }
    return data;
  },

  async update(id: string, category: Partial<Category>): Promise<Category> {
    if (!supabase) throw new Error('Supabase not initialized');
    
    // Nettoyer les données pour n'envoyer que les champs valides
    const { id: _, createdAt, ...validData } = category as any;
    
    const { data, error } = await supabase
      .from('categories')
      .update(validData)
      .eq('id', id)
      .select('*')
      .single();
    
    if (error) {
      // UPDATE ERROR:: error;
      throw error;
    }
    return data;
  },

  async delete(id: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized');
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

