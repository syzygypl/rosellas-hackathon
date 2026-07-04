export interface SolveRequest {
  problem: string;
}

export interface TrizParameter {
  id: number;
  name: string;
  description: string;
}

export interface SolveResult {
  problem: string;
  detectedParameters: TrizParameter[];
  contradiction: string;
  improvingParameter: TrizParameter | null;
  worseningParameter: TrizParameter | null;
  principlesFromMatrix: string;
  relatedPrinciples: string;
  trail: string[];
}
