export type Listing = {
  id: string;
  material: string;
  quantity: number;
  unit: string;
  grade: "A" | "B" | "C";
  price: number;
  location: string;
  availability: string;
  seller: string;
};

export const listings: Listing[] = [
  {
    id: "L001",
    material: "Cardboard",
    quantity: 2000,
    unit: "kg",
    grade: "B",
    price: 8,
    location: "Ahmedabad",
    availability: "Available now",
    seller: "GreenPack Industries",
  },
  {
    id: "L002",
    material: "Plastic",
    quantity: 800,
    unit: "kg",
    grade: "A",
    price: 12,
    location: "Vadodara",
    availability: "Available now",
    seller: "EcoPolymer Ltd.",
  },
  {
    id: "L003",
    material: "Wooden Pallets",
    quantity: 50,
    unit: "units",
    grade: "A",
    price: 250,
    location: "Surat",
    availability: "Available now",
    seller: "Westline Logistics",
  },
  {
    id: "L004",
    material: "Cardboard",
    quantity: 1200,
    unit: "kg",
    grade: "A",
    price: 10,
    location: "Rajkot",
    availability: "Available from 15 Sep",
    seller: "PackRight Manufacturing",
  },
  {
    id: "L005",
    material: "Plastic",
    quantity: 1500,
    unit: "kg",
    grade: "B",
    price: 9,
    location: "Ahmedabad",
    availability: "Available now",
    seller: "ReForm Materials",
  },
  {
    id: "L006",
    material: "Wooden Pallets",
    quantity: 35,
    unit: "units",
    grade: "B",
    price: 180,
    location: "Vadodara",
    availability: "Available now",
    seller: "Circular Supply Co.",
  },
];
