import catalogJson from "../../APP/data/catalog.json";
import servicesJson from "../../APP/data/services.json";

export type Review = { author: string; stars: number; text: string };

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  mrp: number;
  rating: number;
  reviewCount: number;
  stock: number;
  offer: string;
  blurb: string;
  specs: string[];
  tags: string[];
  image: string;
  reviews: Review[];
};

export type Category = { id: string; name: string };

export type ServiceInfo = {
  id: string;
  name: string;
  layer: "frontend" | "edge" | "backend" | "platform";
  runtime: string;
  port: number | null;
  summary: string;
  owns: string[];
  calls: string[];
  endpoints: string[];
};

export const categories = catalogJson.categories as Category[];
export const products = catalogJson.products as Product[];
export const services = servicesJson as ServiceInfo[];

export function productById(id: string) {
  return products.find((product) => product.id === id);
}

export function categoryName(id: string) {
  return categories.find((category) => category.id === id)?.name ?? id;
}
