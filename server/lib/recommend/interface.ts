import type Media from '@server/entity/Media';

export interface Weights {
  name: string;
  score: number;
  tmdbId?: number;
}

export interface ItemWeights {
  genre: Weights[];
  productionYear: Weights[];
}

export interface RecommendRequest {
  page: number;
  genreId: number[];
  mostWatchedMovies?: Media[];
  recentlyWatchedMovies?: Media[];
  minReleaseDate?: string;
  maxReleaseDate?: string;
}
