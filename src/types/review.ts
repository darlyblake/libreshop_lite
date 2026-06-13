/**
 * Types pour le système d'évaluation/avis
 */

export interface OrderReview {
  id: string;
  order_id: string;
  user_id: string;
  store_id: string;
  rating: number; // 1-5
  comment?: string;
  seller_response?: string;
  created_at: string;
  updated_at?: string;
  
  // Relations
  orders?: any;
  stores?: any;
  users?: any;
}

export interface ReviewStats {
  average_rating: number;
  total_reviews: number;
  rating_distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface CreateReviewPayload {
  order_id: string;
  user_id: string;
  store_id: string;
  rating: number;
  comment?: string;
}

export interface UpdateReviewPayload {
  seller_response?: string;
}
