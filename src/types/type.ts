export interface RideDetails {
  category: string;
  eta: number;
  fare: number;
}

export interface OlaResponse {
  categories: {
    eta: number;
  }[];
  ride_estimate: {
    category: string;
    upfront: {
      fare: number;
    };
  }[];
}

export interface KVGetWithMetaData {
  value: string | Object | ArrayBuffer | ReadableStream | null;
  metadata: Object | null;
}
